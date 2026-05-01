import { loadEnvConfig } from "@next/env";
import {
  AuthorizeSecurityGroupIngressCommand,
  CreateSecurityGroupCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import {
  CreateDBInstanceCommand,
  CreateDBSubnetGroupCommand,
  DescribeDBInstancesCommand,
  DescribeDBSubnetGroupsCommand,
  RDSClient,
  waitUntilDBInstanceAvailable,
} from "@aws-sdk/client-rds";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd());

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const ec2 = new EC2Client({ region });
const rds = new RDSClient({ region });

const storageDir = path.join(process.cwd(), "storage", "staging");
const manifestPath = path.join(storageDir, "staging-manifest.json");
const dbInstanceIdentifier = "xupra-drylake-staging-postgres";
const dbSubnetGroupName = "xupra-drylake-staging-db-subnets";
const dbSecurityGroupName = "xupra-drylake-staging-rds-sg";
const databaseName = "xupra_drylake";
const databaseUser = "xupraapp";

type Manifest = {
  region: string;
  securityGroupId?: string;
  rdsDatabase?: {
    dbInstanceIdentifier: string;
    dbSubnetGroupName: string;
    securityGroupId: string;
    endpointAddress?: string;
    endpointPort?: number;
    name: string;
    user: string;
    password: string;
  };
};

function randomPassword() {
  return crypto.randomBytes(24).toString("hex");
}

async function readManifest(): Promise<Manifest> {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as Manifest;
}

async function writeManifest(manifest: Manifest) {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

async function resolveDefaultVpc() {
  const response = await ec2.send(
    new DescribeVpcsCommand({
      Filters: [{ Name: "isDefault", Values: ["true"] }],
    }),
  );

  const vpc = response.Vpcs?.[0];
  if (!vpc?.VpcId) {
    throw new Error("No default VPC found in the target AWS region.");
  }

  return vpc.VpcId;
}

async function resolveSubnetIds(vpcId: string) {
  const response = await ec2.send(
    new DescribeSubnetsCommand({
      Filters: [{ Name: "vpc-id", Values: [vpcId] }],
    }),
  );

  const subnetIds = [...(response.Subnets ?? [])]
    .filter((subnet) => Boolean(subnet.SubnetId && subnet.AvailabilityZone))
    .sort((left, right) => (left.AvailabilityZone || "").localeCompare(right.AvailabilityZone || ""))
    .map((subnet) => subnet.SubnetId as string);

  if (new Set(subnetIds).size < 2) {
    throw new Error("RDS requires subnets in at least two availability zones.");
  }

  return subnetIds;
}

async function ensureDbSecurityGroup(vpcId: string, appSecurityGroupId: string) {
  const existing = await ec2.send(
    new DescribeSecurityGroupsCommand({
      Filters: [
        { Name: "group-name", Values: [dbSecurityGroupName] },
        { Name: "vpc-id", Values: [vpcId] },
      ],
    }),
  );

  let securityGroupId = existing.SecurityGroups?.[0]?.GroupId;

  if (!securityGroupId) {
    const created = await ec2.send(
      new CreateSecurityGroupCommand({
        GroupName: dbSecurityGroupName,
        Description: "RDS PostgreSQL access for Xupra DryLake staging",
        VpcId: vpcId,
        TagSpecifications: [
          {
            ResourceType: "security-group",
            Tags: [
              { Key: "Name", Value: dbSecurityGroupName },
              { Key: "Project", Value: "xupra-drylake" },
              { Key: "Environment", Value: "staging" },
            ],
          },
        ],
      }),
    );

    securityGroupId = created.GroupId;
  }

  if (!securityGroupId) {
    throw new Error("Failed to create or resolve RDS security group.");
  }

  try {
    await ec2.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: securityGroupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 5432,
            ToPort: 5432,
            UserIdGroupPairs: [
              {
                GroupId: appSecurityGroupId,
                Description: "PostgreSQL from staging app host",
              },
            ],
          },
        ],
      }),
    );
  } catch (error) {
    const code = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
    const awsCode =
      typeof error === "object" && error !== null && "Code" in error ? String(error.Code) : "";
    const message = error instanceof Error ? error.message : String(error);
    if (code !== "InvalidPermission.Duplicate" && awsCode !== "InvalidPermission.Duplicate" && !message.includes("InvalidPermission.Duplicate")) {
      throw error;
    }
  }

  return securityGroupId;
}

async function ensureDbSubnetGroup(subnetIds: string[]) {
  try {
    await rds.send(new DescribeDBSubnetGroupsCommand({ DBSubnetGroupName: dbSubnetGroupName }));
    return dbSubnetGroupName;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
    const message = error instanceof Error ? error.message : String(error);
    if (code !== "DBSubnetGroupNotFoundFault" && !message.includes("DBSubnetGroupNotFoundFault")) {
      throw error;
    }
  }

  await rds.send(
    new CreateDBSubnetGroupCommand({
      DBSubnetGroupName: dbSubnetGroupName,
      DBSubnetGroupDescription: "Subnets for Xupra DryLake staging PostgreSQL",
      SubnetIds: subnetIds,
      Tags: [
        { Key: "Name", Value: dbSubnetGroupName },
        { Key: "Project", Value: "xupra-drylake" },
        { Key: "Environment", Value: "staging" },
      ],
    }),
  );

  return dbSubnetGroupName;
}

async function describeDbInstance() {
  try {
    const response = await rds.send(
      new DescribeDBInstancesCommand({
        DBInstanceIdentifier: dbInstanceIdentifier,
      }),
    );

    return response.DBInstances?.[0] ?? null;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
    const message = error instanceof Error ? error.message : String(error);
    if (code === "DBInstanceNotFoundFault" || message.includes("DBInstanceNotFound")) {
      return null;
    }
    throw error;
  }
}

async function ensureDbInstance(params: {
  dbSubnetGroupName: string;
  securityGroupId: string;
  password: string;
}) {
  const existing = await describeDbInstance();

  if (existing) {
    return existing;
  }

  await rds.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: dbInstanceIdentifier,
      DBName: databaseName,
      Engine: "postgres",
      DBInstanceClass: "db.t4g.micro",
      AllocatedStorage: 20,
      StorageType: "gp3",
      StorageEncrypted: true,
      MasterUsername: databaseUser,
      MasterUserPassword: params.password,
      DBSubnetGroupName: params.dbSubnetGroupName,
      VpcSecurityGroupIds: [params.securityGroupId],
      PubliclyAccessible: false,
      BackupRetentionPeriod: 7,
      DeletionProtection: true,
      AutoMinorVersionUpgrade: true,
      CopyTagsToSnapshot: true,
      Tags: [
        { Key: "Name", Value: dbInstanceIdentifier },
        { Key: "Project", Value: "xupra-drylake" },
        { Key: "Environment", Value: "staging" },
      ],
    }),
  );

  await waitUntilDBInstanceAvailable(
    { client: rds, maxWaitTime: 1800 },
    { DBInstanceIdentifier: dbInstanceIdentifier },
  );

  const created = await describeDbInstance();
  if (!created) {
    throw new Error("RDS instance was created but could not be described.");
  }

  return created;
}

async function main() {
  const manifest = await readManifest();
  manifest.region = region;

  if (!manifest.securityGroupId) {
    throw new Error("Staging app security group is missing. Run aws:provision-staging first.");
  }

  const vpcId = await resolveDefaultVpc();
  const subnetIds = await resolveSubnetIds(vpcId);
  const securityGroupId = await ensureDbSecurityGroup(vpcId, manifest.securityGroupId);
  const subnetGroupName = await ensureDbSubnetGroup(subnetIds);

  const existingPassword = manifest.rdsDatabase?.password;
  const password = existingPassword || randomPassword();

  const dbInstance = await ensureDbInstance({
    dbSubnetGroupName: subnetGroupName,
    securityGroupId,
    password,
  });

  manifest.rdsDatabase = {
    dbInstanceIdentifier,
    dbSubnetGroupName: subnetGroupName,
    securityGroupId,
    endpointAddress: dbInstance.Endpoint?.Address,
    endpointPort: dbInstance.Endpoint?.Port ?? 5432,
    name: databaseName,
    user: databaseUser,
    password,
  };

  await writeManifest(manifest);

  console.log(
    JSON.stringify(
      {
        region,
        dbInstanceIdentifier,
        dbSubnetGroupName: subnetGroupName,
        securityGroupId,
        endpointAddress: manifest.rdsDatabase.endpointAddress,
        endpointPort: manifest.rdsDatabase.endpointPort,
        databaseName,
        databaseUser,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
