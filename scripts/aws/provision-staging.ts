import { loadEnvConfig } from "@next/env";
import {
  AllocateAddressCommand,
  AssociateAddressCommand,
  AuthorizeSecurityGroupIngressCommand,
  CreateSecurityGroupCommand,
  DescribeAddressesCommand,
  DescribeImagesCommand,
  DescribeInstancesCommand,
  DescribeKeyPairsCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
  EC2Client,
  ImportKeyPairCommand,
  RunInstancesCommand,
  waitUntilInstanceRunning,
  waitUntilInstanceStatusOk,
} from "@aws-sdk/client-ec2";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

loadEnvConfig(process.cwd());

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const ec2 = new EC2Client({ region });

const storageDir = path.join(process.cwd(), "storage", "staging");
const manifestPath = path.join(storageDir, "staging-manifest.json");
const keyName = "xupra-drylake-staging";
const securityGroupName = "xupra-drylake-staging-sg";
const instanceName = "xupra-drylake-staging";
const elasticIpTag = "xupra-drylake-staging-eip";
const defaultInstanceType = "t3.large";

type Manifest = {
  region: string;
  instanceId?: string;
  publicIp?: string;
  securityGroupId?: string;
  subnetId?: string;
  keyName: string;
  sshUser: string;
  sshKeyPath: string;
  allocationId?: string;
  associationId?: string;
  database: {
    name: string;
    user: string;
    password: string;
  };
  appEncryptionKey: string;
};

function randomSecret(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

async function readManifest(): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

async function writeManifest(manifest: Manifest) {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

async function resolveUbuntuAmi() {
  const response = await ec2.send(
    new DescribeImagesCommand({
      Owners: ["099720109477"],
      Filters: [
        {
          Name: "name",
          Values: ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"],
        },
        { Name: "state", Values: ["available"] },
        { Name: "architecture", Values: ["x86_64"] },
        { Name: "root-device-type", Values: ["ebs"] },
        { Name: "virtualization-type", Values: ["hvm"] },
      ],
    }),
  );

  const latest = [...(response.Images ?? [])]
    .sort((left, right) => (right.CreationDate || "").localeCompare(left.CreationDate || ""))[0];

  if (!latest?.ImageId) {
    throw new Error("Unable to resolve a current Ubuntu 24.04 AMI in the configured region.");
  }

  return latest.ImageId;
}

async function resolveDefaultSubnet() {
  const vpcResponse = await ec2.send(
    new DescribeVpcsCommand({
      Filters: [{ Name: "isDefault", Values: ["true"] }],
    }),
  );

  const vpc = vpcResponse.Vpcs?.[0];
  if (!vpc?.VpcId) {
    throw new Error("No default VPC found in the target AWS region.");
  }

  const subnetResponse = await ec2.send(
    new DescribeSubnetsCommand({
      Filters: [{ Name: "vpc-id", Values: [vpc.VpcId] }],
    }),
  );

  const subnet = [...(subnetResponse.Subnets ?? [])]
    .sort((left, right) => (left.AvailabilityZone || "").localeCompare(right.AvailabilityZone || ""))[0];

  if (!subnet?.SubnetId) {
    throw new Error("No subnet found in the default VPC.");
  }

  return {
    vpcId: vpc.VpcId,
    subnetId: subnet.SubnetId,
  };
}

async function ensureKeyPair(sshPublicKeyPath: string) {
  const existing = await ec2.send(
    new DescribeKeyPairsCommand({
      Filters: [{ Name: "key-name", Values: [keyName] }],
    }),
  );

  if (existing.KeyPairs?.some((item) => item.KeyName === keyName)) {
    return keyName;
  }

  const publicKeyMaterial = await fs.readFile(sshPublicKeyPath, "utf8");

  await ec2.send(
    new ImportKeyPairCommand({
      KeyName: keyName,
      PublicKeyMaterial: Buffer.from(publicKeyMaterial),
      TagSpecifications: [
        {
          ResourceType: "key-pair",
          Tags: [
            { Key: "Name", Value: keyName },
            { Key: "Project", Value: "xupra-drylake" },
          ],
        },
      ],
    }),
  );

  return keyName;
}

async function ensureSecurityGroup(vpcId: string) {
  const existing = await ec2.send(
    new DescribeSecurityGroupsCommand({
      Filters: [
        { Name: "group-name", Values: [securityGroupName] },
        { Name: "vpc-id", Values: [vpcId] },
      ],
    }),
  );

  const existingGroup = existing.SecurityGroups?.[0];
  if (existingGroup?.GroupId) {
    return existingGroup.GroupId;
  }

  const created = await ec2.send(
    new CreateSecurityGroupCommand({
      GroupName: securityGroupName,
      Description: "Security group for Xupra DryLake staging",
      VpcId: vpcId,
      TagSpecifications: [
        {
          ResourceType: "security-group",
          Tags: [
            { Key: "Name", Value: securityGroupName },
            { Key: "Project", Value: "xupra-drylake" },
          ],
        },
      ],
    }),
  );

  if (!created.GroupId) {
    throw new Error("Failed to create the staging security group.");
  }

  try {
    await ec2.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: created.GroupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 22,
            ToPort: 22,
            IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "Temporary SSH access" }],
          },
          {
            IpProtocol: "tcp",
            FromPort: 80,
            ToPort: 80,
            IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "HTTP" }],
          },
          {
            IpProtocol: "tcp",
            FromPort: 443,
            ToPort: 443,
            IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "HTTPS" }],
          },
        ],
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("InvalidPermission.Duplicate")) {
      throw error;
    }
  }

  return created.GroupId;
}

function userDataScript() {
  return `#!/bin/bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git build-essential nginx postgresql postgresql-contrib
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if systemctl list-unit-files amazon-ssm-agent.service >/dev/null 2>&1; then
  systemctl enable amazon-ssm-agent
  systemctl start amazon-ssm-agent
elif command -v snap >/dev/null 2>&1; then
  snap install amazon-ssm-agent --classic || true
  systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service || true
  systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service || true
fi
id -u xupra >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash xupra
mkdir -p /srv/xupra-drylake
chown -R xupra:xupra /srv/xupra-drylake
systemctl enable nginx
systemctl enable postgresql
systemctl start nginx
systemctl start postgresql
`;
}

async function describeInstance(instanceId: string) {
  const response = await ec2.send(
    new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    }),
  );

  return response.Reservations?.flatMap((reservation) => reservation.Instances ?? [])[0];
}

async function ensureInstance(
  manifest: Manifest,
  amiId: string,
  subnetId: string,
  securityGroupId: string,
) {
  if (manifest.instanceId) {
    const existing = await describeInstance(manifest.instanceId);
    const state = existing?.State?.Name;
    if (existing?.InstanceId && state && state !== "terminated" && state !== "shutting-down") {
      return existing.InstanceId;
    }
  }

  const response = await ec2.send(
    new RunInstancesCommand({
      ImageId: amiId,
      InstanceType: defaultInstanceType,
      KeyName: manifest.keyName,
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: [securityGroupId],
      SubnetId: subnetId,
      UserData: Buffer.from(userDataScript()).toString("base64"),
      BlockDeviceMappings: [
        {
          DeviceName: "/dev/sda1",
          Ebs: {
            DeleteOnTermination: true,
            VolumeSize: 30,
            VolumeType: "gp3",
          },
        },
      ],
      TagSpecifications: [
        {
          ResourceType: "instance",
          Tags: [
            { Key: "Name", Value: instanceName },
            { Key: "Project", Value: "xupra-drylake" },
            { Key: "Environment", Value: "staging" },
          ],
        },
      ],
    }),
  );

  const instanceId = response.Instances?.[0]?.InstanceId;
  if (!instanceId) {
    throw new Error("Failed to create the staging instance.");
  }

  await waitUntilInstanceRunning(
    { client: ec2, maxWaitTime: 300 },
    { InstanceIds: [instanceId] },
  );
  await waitUntilInstanceStatusOk(
    { client: ec2, maxWaitTime: 300 },
    { InstanceIds: [instanceId] },
  );

  return instanceId;
}

async function ensureElasticIp(manifest: Manifest, instanceId: string) {
  if (manifest.allocationId) {
    const existing = await ec2.send(
      new DescribeAddressesCommand({
        AllocationIds: [manifest.allocationId],
      }),
    );
    const address = existing.Addresses?.[0];
    if (address?.AllocationId && address.PublicIp) {
      if (!address.AssociationId || address.InstanceId !== instanceId) {
        const associated = await ec2.send(
          new AssociateAddressCommand({
            AllocationId: address.AllocationId,
            InstanceId: instanceId,
          }),
        );
        manifest.associationId = associated.AssociationId;
      }

      manifest.publicIp = address.PublicIp;
      manifest.allocationId = address.AllocationId;
      return manifest;
    }
  }

  const allocated = await ec2.send(
    new AllocateAddressCommand({
      Domain: "vpc",
      TagSpecifications: [
        {
          ResourceType: "elastic-ip",
          Tags: [
            { Key: "Name", Value: elasticIpTag },
            { Key: "Project", Value: "xupra-drylake" },
          ],
        },
      ],
    }),
  );

  if (!allocated.AllocationId || !allocated.PublicIp) {
    throw new Error("Failed to allocate an Elastic IP for staging.");
  }

  const associated = await ec2.send(
    new AssociateAddressCommand({
      AllocationId: allocated.AllocationId,
      InstanceId: instanceId,
    }),
  );

  manifest.allocationId = allocated.AllocationId;
  manifest.associationId = associated.AssociationId;
  manifest.publicIp = allocated.PublicIp;

  return manifest;
}

async function main() {
  const homeDirectory = os.homedir();
  const sshPrivateKeyPath = path.join(homeDirectory, ".ssh", "id_ed25519");
  const sshPublicKeyPath = path.join(homeDirectory, ".ssh", "id_ed25519.pub");

  const existingManifest = await readManifest();
  const manifest: Manifest = existingManifest ?? {
    region,
    keyName,
    sshUser: "ubuntu",
    sshKeyPath: sshPrivateKeyPath,
    database: {
      name: "xupra_drylake",
      user: "xupra_app",
      password: randomSecret(18),
    },
    appEncryptionKey: randomSecret(32),
  };

  manifest.region = region;
  manifest.keyName = await ensureKeyPair(sshPublicKeyPath);

  const { vpcId, subnetId } = await resolveDefaultSubnet();
  manifest.subnetId = subnetId;
  manifest.securityGroupId = await ensureSecurityGroup(vpcId);

  const amiId = await resolveUbuntuAmi();
  manifest.instanceId = await ensureInstance(manifest, amiId, subnetId, manifest.securityGroupId);

  const instance = await describeInstance(manifest.instanceId);
  if (!instance?.InstanceId) {
    throw new Error("Unable to describe the staging instance after provisioning.");
  }

  await ensureElasticIp(manifest, instance.InstanceId);

  await writeManifest(manifest);

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
