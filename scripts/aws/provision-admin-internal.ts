import { loadEnvConfig } from "@next/env";
import {
  AuthorizeSecurityGroupIngressCommand,
  CreateSecurityGroupCommand,
  DescribeInstancesCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import {
  CreateListenerCommand,
  CreateLoadBalancerCommand,
  CreateTargetGroupCommand,
  DescribeListenersCommand,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  ElasticLoadBalancingV2Client,
  ModifyListenerCommand,
  RegisterTargetsCommand,
  SetSecurityGroupsCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import {
  AssociateVPCWithHostedZoneCommand,
  ChangeResourceRecordSetsCommand,
  CreateHostedZoneCommand,
  GetHostedZoneCommand,
  ListHostedZonesByNameCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd());

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const ec2 = new EC2Client({ region });
const elbv2 = new ElasticLoadBalancingV2Client({ region });
const route53 = new Route53Client({ region });

const stagingManifestPath = path.join(process.cwd(), "storage", "staging", "staging-manifest.json");
const internalManifestPath = path.join(process.cwd(), "storage", "staging", "internal-admin-manifest.json");

const internalLoadBalancerName = "xupra-admin-internal";
const internalTargetGroupName = "xupra-admin-int-http";
const internalSecurityGroupName = "xupra-admin-internal-sg";

type StagingManifest = {
  instanceId?: string;
  securityGroupId?: string;
};

function hasAwsErrorCode(error: unknown, code: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const value = error as {
    name?: string;
    Code?: string;
    code?: string;
    message?: string;
  };

  return (
    value.name === code ||
    value.Code === code ||
    value.code === code ||
    value.message?.includes(code) === true
  );
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeZoneName(value: string) {
  return value.trim().replace(/\.+$/, "").toLowerCase();
}

function normalizeHostname(value: string) {
  return value.trim().replace(/\.+$/, "").toLowerCase();
}

function route53ZoneId(value: string) {
  return value.replace("/hostedzone/", "");
}

async function readStagingManifest() {
  const raw = await fs.readFile(stagingManifestPath, "utf8");
  return JSON.parse(raw) as StagingManifest;
}

async function getInstance(instanceId: string) {
  const response = await ec2.send(
    new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    }),
  );

  const instance = response.Reservations?.flatMap((reservation) => reservation.Instances ?? [])[0];

  if (!instance?.InstanceId || !instance.VpcId) {
    throw new Error(`Unable to resolve staging instance ${instanceId}.`);
  }

  return instance;
}

async function resolvePrivateSubnets(vpcId: string) {
  const response = await ec2.send(
    new DescribeSubnetsCommand({
      Filters: [{ Name: "vpc-id", Values: [vpcId] }],
    }),
  );

  const allSubnets = (response.Subnets ?? []).filter(
    (subnet) => Boolean(subnet.SubnetId && subnet.AvailabilityZone),
  );
  const preferredSubnets = allSubnets.filter((subnet) => subnet.MapPublicIpOnLaunch === false);
  const candidateSubnets = preferredSubnets.length >= 2 ? preferredSubnets : allSubnets;

  const byAz = new Map<string, string>();

  for (const subnet of candidateSubnets) {
    if (!subnet.SubnetId || !subnet.AvailabilityZone) {
      continue;
    }

    if (!byAz.has(subnet.AvailabilityZone)) {
      byAz.set(subnet.AvailabilityZone, subnet.SubnetId);
    }
  }

  const subnetIds = [...byAz.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, subnetId]) => subnetId)
    .slice(0, 2);

  if (subnetIds.length < 2) {
    throw new Error("Internal ALB requires at least two subnets in distinct availability zones.");
  }

  return subnetIds;
}

async function ensureInternalAlbSecurityGroup(vpcId: string, allowedCidr: string) {
  const existing = await ec2.send(
    new DescribeSecurityGroupsCommand({
      Filters: [
        { Name: "group-name", Values: [internalSecurityGroupName] },
        { Name: "vpc-id", Values: [vpcId] },
      ],
    }),
  );

  const groupId =
    existing.SecurityGroups?.[0]?.GroupId ??
    (
      await ec2.send(
        new CreateSecurityGroupCommand({
          GroupName: internalSecurityGroupName,
          Description: "Private ALB security group for internal admin access",
          VpcId: vpcId,
          TagSpecifications: [
            {
              ResourceType: "security-group",
              Tags: [
                { Key: "Name", Value: internalSecurityGroupName },
                { Key: "Project", Value: "xupra-drylake" },
                { Key: "Environment", Value: "staging" },
              ],
            },
          ],
        }),
      )
    ).GroupId;

  if (!groupId) {
    throw new Error("Failed to create internal admin security group.");
  }

  try {
    await ec2.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: groupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 80,
            ToPort: 80,
            IpRanges: [
              {
                CidrIp: allowedCidr,
                Description: "Admin ingress CIDR (Client VPN / internal network)",
              },
            ],
          },
        ],
      }),
    );
  } catch (error) {
    if (!hasAwsErrorCode(error, "InvalidPermission.Duplicate")) {
      throw error;
    }
  }

  return groupId;
}

async function ensureInstanceIngressFromAlb(instanceSecurityGroupId: string, albSecurityGroupId: string) {
  try {
    await ec2.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: instanceSecurityGroupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 80,
            ToPort: 80,
            UserIdGroupPairs: [
              {
                GroupId: albSecurityGroupId,
                Description: "Internal admin ALB access",
              },
            ],
          },
        ],
      }),
    );
  } catch (error) {
    if (!hasAwsErrorCode(error, "InvalidPermission.Duplicate")) {
      throw error;
    }
  }
}

async function ensureInternalTargetGroup(vpcId: string) {
  try {
    const existing = await elbv2.send(
      new DescribeTargetGroupsCommand({
        Names: [internalTargetGroupName],
      }),
    );
    const targetGroup = existing.TargetGroups?.[0];

    if (targetGroup?.TargetGroupArn) {
      return targetGroup;
    }
  } catch (error) {
    if (!hasAwsErrorCode(error, "TargetGroupNotFound") && !hasAwsErrorCode(error, "TargetGroupNotFoundException")) {
      throw error;
    }
  }

  const created = await elbv2.send(
    new CreateTargetGroupCommand({
      Name: internalTargetGroupName,
      Protocol: "HTTP",
      Port: 80,
      VpcId: vpcId,
      TargetType: "instance",
      HealthCheckProtocol: "HTTP",
      HealthCheckPath: "/api/v1/health",
      Matcher: {
        HttpCode: "200-399",
      },
      Tags: [
        { Key: "Name", Value: internalTargetGroupName },
        { Key: "Project", Value: "xupra-drylake" },
        { Key: "Environment", Value: "staging" },
      ],
    }),
  );

  const targetGroup = created.TargetGroups?.[0];

  if (!targetGroup?.TargetGroupArn) {
    throw new Error("Failed to create internal admin target group.");
  }

  return targetGroup;
}

async function ensureInternalLoadBalancer(subnetIds: string[], securityGroupId: string) {
  try {
    const existing = await elbv2.send(
      new DescribeLoadBalancersCommand({
        Names: [internalLoadBalancerName],
      }),
    );
    const loadBalancer = existing.LoadBalancers?.[0];

    if (loadBalancer?.LoadBalancerArn) {
      await elbv2.send(
        new SetSecurityGroupsCommand({
          LoadBalancerArn: loadBalancer.LoadBalancerArn,
          SecurityGroups: [securityGroupId],
        }),
      );

      return loadBalancer;
    }
  } catch (error) {
    if (!hasAwsErrorCode(error, "LoadBalancerNotFound") && !hasAwsErrorCode(error, "LoadBalancerNotFoundException")) {
      throw error;
    }
  }

  const created = await elbv2.send(
    new CreateLoadBalancerCommand({
      Name: internalLoadBalancerName,
      Type: "application",
      Scheme: "internal",
      IpAddressType: "ipv4",
      Subnets: subnetIds,
      SecurityGroups: [securityGroupId],
      Tags: [
        { Key: "Name", Value: internalLoadBalancerName },
        { Key: "Project", Value: "xupra-drylake" },
        { Key: "Environment", Value: "staging" },
      ],
    }),
  );

  const loadBalancer = created.LoadBalancers?.[0];

  if (!loadBalancer?.LoadBalancerArn) {
    throw new Error("Failed to create internal admin load balancer.");
  }

  return loadBalancer;
}

async function ensureInternalHttpListener(loadBalancerArn: string, targetGroupArn: string) {
  const described = await elbv2.send(
    new DescribeListenersCommand({
      LoadBalancerArn: loadBalancerArn,
    }),
  );

  const listeners = described.Listeners ?? [];
  const listener = listeners.find((item) => item.Port === 80);

  const payload = {
    DefaultActions: [{ Type: "forward" as const, TargetGroupArn: targetGroupArn }],
    Protocol: "HTTP" as const,
    Port: 80,
  };

  if (listener?.ListenerArn) {
    await elbv2.send(
      new ModifyListenerCommand({
        ListenerArn: listener.ListenerArn,
        ...payload,
      }),
    );
    return;
  }

  await elbv2.send(
    new CreateListenerCommand({
      LoadBalancerArn: loadBalancerArn,
      ...payload,
    }),
  );
}

async function ensurePrivateHostedZone(vpcId: string, zoneName: string) {
  const normalizedZoneName = `${normalizeZoneName(zoneName)}.`;
  const listed = await route53.send(
    new ListHostedZonesByNameCommand({
      DNSName: normalizedZoneName,
      MaxItems: 10,
    }),
  );

  const existing = (listed.HostedZones ?? []).find(
    (zone) => zone.Config?.PrivateZone && zone.Name === normalizedZoneName,
  );

  if (existing?.Id) {
    const hostedZoneId = route53ZoneId(existing.Id);
    const hostedZone = await route53.send(
      new GetHostedZoneCommand({
        Id: hostedZoneId,
      }),
    );
    const associated = (hostedZone.VPCs ?? []).some((vpc) => vpc.VPCId === vpcId);

    if (!associated) {
      await route53.send(
        new AssociateVPCWithHostedZoneCommand({
          HostedZoneId: hostedZoneId,
          VPC: {
            VPCId: vpcId,
            VPCRegion: region as never,
          },
        }),
      );
    }

    return hostedZoneId;
  }

  const created = await route53.send(
    new CreateHostedZoneCommand({
      Name: normalizeZoneName(zoneName),
      CallerReference: `xupra-admin-internal-${crypto.randomUUID()}`,
      HostedZoneConfig: {
        PrivateZone: true,
        Comment: "Private zone for Xupra internal admin access",
      },
      VPC: {
        VPCId: vpcId,
        VPCRegion: region as never,
      },
    }),
  );

  if (!created.HostedZone?.Id) {
    throw new Error("Failed to create private hosted zone.");
  }

  return route53ZoneId(created.HostedZone.Id);
}

async function upsertAdminAliasRecord(
  hostedZoneId: string,
  adminHost: string,
  albDnsName: string,
  albHostedZoneId: string,
) {
  await route53.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: `${adminHost}.`,
              Type: "A",
              AliasTarget: {
                DNSName: albDnsName,
                HostedZoneId: albHostedZoneId,
                EvaluateTargetHealth: false,
              },
            },
          },
        ],
      },
    }),
  );
}

async function main() {
  const adminHost = normalizeHostname(requireEnv("ADMIN_INTERNAL_HOST"));
  const zoneName = normalizeZoneName(requireEnv("ADMIN_INTERNAL_ZONE_NAME"));
  const allowedCidr = process.env.ADMIN_INTERNAL_ALLOWED_CIDR?.trim() || "10.90.0.0/22";

  if (!adminHost.endsWith(`.${zoneName}`) && adminHost !== zoneName) {
    throw new Error(
      `ADMIN_INTERNAL_HOST (${adminHost}) must be within ADMIN_INTERNAL_ZONE_NAME (${zoneName}).`,
    );
  }

  const staging = await readStagingManifest();

  if (!staging.instanceId) {
    throw new Error("Missing staging instance. Run npm run aws:provision-staging first.");
  }

  const instance = await getInstance(staging.instanceId);
  const instanceSecurityGroupId =
    staging.securityGroupId ?? instance.SecurityGroups?.[0]?.GroupId;

  if (!instanceSecurityGroupId) {
    throw new Error("Unable to resolve the staging instance security group.");
  }

  const subnetIds = await resolvePrivateSubnets(instance.VpcId!);
  const albSecurityGroupId = await ensureInternalAlbSecurityGroup(instance.VpcId!, allowedCidr);
  await ensureInstanceIngressFromAlb(instanceSecurityGroupId, albSecurityGroupId);
  const targetGroup = await ensureInternalTargetGroup(instance.VpcId!);
  const loadBalancer = await ensureInternalLoadBalancer(subnetIds, albSecurityGroupId);

  await elbv2.send(
    new RegisterTargetsCommand({
      TargetGroupArn: targetGroup.TargetGroupArn!,
      Targets: [{ Id: staging.instanceId, Port: 80 }],
    }),
  );

  await ensureInternalHttpListener(loadBalancer.LoadBalancerArn!, targetGroup.TargetGroupArn!);

  const privateHostedZoneId = await ensurePrivateHostedZone(instance.VpcId!, zoneName);

  if (!loadBalancer.DNSName || !loadBalancer.CanonicalHostedZoneId) {
    throw new Error("Failed to resolve internal ALB DNS metadata.");
  }

  await upsertAdminAliasRecord(
    privateHostedZoneId,
    adminHost,
    loadBalancer.DNSName,
    loadBalancer.CanonicalHostedZoneId,
  );

  const manifest = {
    region,
    adminHost,
    zoneName,
    allowedCidr,
    privateHostedZoneId,
    loadBalancer: {
      arn: loadBalancer.LoadBalancerArn,
      dnsName: loadBalancer.DNSName,
      canonicalHostedZoneId: loadBalancer.CanonicalHostedZoneId,
      scheme: loadBalancer.Scheme,
      state: loadBalancer.State?.Code ?? null,
      securityGroupId: albSecurityGroupId,
      subnets: subnetIds,
    },
    targetGroup: {
      arn: targetGroup.TargetGroupArn,
      protocol: targetGroup.Protocol,
      port: targetGroup.Port,
      healthCheckPath: targetGroup.HealthCheckPath,
    },
    appIntegration: {
      adminInternalOrigin: `http://${adminHost}`,
      adminRoute: "/admin",
      note: "Set ADMIN_INTERNAL_HOST and ADMIN_INTERNAL_ORIGIN in your staging environment and redeploy the app.",
    },
    nextSteps: [
      "Configure AWS Client VPN or AWS SSO network access to this VPC.",
      "Route your workstation DNS for the private hosted zone while connected to VPN.",
      "Set ADMIN_INTERNAL_BASIC_AUTH_USERNAME and ADMIN_INTERNAL_BASIC_AUTH_PASSWORD in the app env.",
    ],
  };

  await fs.writeFile(internalManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
