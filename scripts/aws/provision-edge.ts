import { loadEnvConfig } from "@next/env";
import {
  ACMClient,
  DescribeCertificateCommand,
  RequestCertificateCommand,
} from "@aws-sdk/client-acm";
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
  AuthorizeSecurityGroupIngressCommand,
  CreateSecurityGroupCommand,
  DescribeInstancesCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import fs from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd());

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const ec2 = new EC2Client({ region });
const acm = new ACMClient({ region });
const elbv2 = new ElasticLoadBalancingV2Client({ region });

const stagingManifestPath = path.join(process.cwd(), "storage", "staging", "staging-manifest.json");
const edgeManifestPath = path.join(process.cwd(), "storage", "staging", "edge-manifest.json");

const edgeSecurityGroupName = "xupra-drylake-edge-sg";
const loadBalancerName = "xupra-drylake-edge";
const targetGroupName = "xupra-drylake-edge-https";

type StagingManifest = {
  instanceId?: string;
  publicIp?: string;
};

type DnsRecord = {
  domain: string;
  name: string;
  type: string;
  value: string;
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

async function readStagingManifest() {
  const raw = await fs.readFile(stagingManifestPath, "utf8");
  return JSON.parse(raw) as StagingManifest;
}

function getHosts() {
  const baseUrl = process.env.APP_BASE_URL;

  if (!baseUrl) {
    throw new Error("APP_BASE_URL is required.");
  }

  const url = new URL(baseUrl);
  const appHost = url.host;
  const marketingHost = appHost.startsWith("drylake.") ? appHost.slice("drylake.".length) : null;
  const domains = [
    marketingHost,
    appHost,
    marketingHost ? `www.${marketingHost}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    appHost,
    marketingHost,
    domains,
    primaryCertificateDomain: marketingHost ?? appHost,
  };
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

async function resolveAlbSubnets(vpcId: string) {
  const response = await ec2.send(
    new DescribeSubnetsCommand({
      Filters: [{ Name: "vpc-id", Values: [vpcId] }],
    }),
  );

  const byAz = new Map<string, string>();

  for (const subnet of response.Subnets ?? []) {
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
    throw new Error("ALB setup requires at least two subnets in distinct availability zones.");
  }

  return subnetIds;
}

async function ensureSecurityGroup(vpcId: string) {
  const existing = await ec2.send(
    new DescribeSecurityGroupsCommand({
      Filters: [
        { Name: "group-name", Values: [edgeSecurityGroupName] },
        { Name: "vpc-id", Values: [vpcId] },
      ],
    }),
  );

  const groupId =
    existing.SecurityGroups?.[0]?.GroupId ??
    (
      await ec2.send(
        new CreateSecurityGroupCommand({
          GroupName: edgeSecurityGroupName,
          Description: "Internet-facing ALB for Xupra DryLake",
          VpcId: vpcId,
          TagSpecifications: [
            {
              ResourceType: "security-group",
              Tags: [
                { Key: "Name", Value: edgeSecurityGroupName },
                { Key: "Project", Value: "xupra-drylake" },
                { Key: "Environment", Value: "staging" },
              ],
            },
          ],
        }),
      )
    ).GroupId;

  if (!groupId) {
    throw new Error("Failed to create edge security group.");
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
    if (!hasAwsErrorCode(error, "InvalidPermission.Duplicate")) {
      throw error;
    }
  }

  return groupId;
}

async function ensureTargetGroup(vpcId: string) {
  try {
    const existing = await elbv2.send(
      new DescribeTargetGroupsCommand({
        Names: [targetGroupName],
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
      Name: targetGroupName,
      Protocol: "HTTPS",
      Port: 443,
      VpcId: vpcId,
      TargetType: "instance",
      HealthCheckProtocol: "HTTPS",
      HealthCheckPath: "/api/v1/health",
      Matcher: {
        HttpCode: "200",
      },
      Tags: [
        { Key: "Name", Value: targetGroupName },
        { Key: "Project", Value: "xupra-drylake" },
        { Key: "Environment", Value: "staging" },
      ],
    }),
  );

  const targetGroup = created.TargetGroups?.[0];

  if (!targetGroup?.TargetGroupArn) {
    throw new Error("Failed to create target group.");
  }

  return targetGroup;
}

async function ensureLoadBalancer(subnetIds: string[], securityGroupId: string) {
  try {
    const existing = await elbv2.send(
      new DescribeLoadBalancersCommand({
        Names: [loadBalancerName],
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
      Name: loadBalancerName,
      Type: "application",
      Scheme: "internet-facing",
      IpAddressType: "ipv4",
      Subnets: subnetIds,
      SecurityGroups: [securityGroupId],
      Tags: [
        { Key: "Name", Value: loadBalancerName },
        { Key: "Project", Value: "xupra-drylake" },
        { Key: "Environment", Value: "staging" },
      ],
    }),
  );

  const loadBalancer = created.LoadBalancers?.[0];

  if (!loadBalancer?.LoadBalancerArn) {
    throw new Error("Failed to create load balancer.");
  }

  return loadBalancer;
}

async function ensureCertificate(domains: string[], primaryDomain: string, existingArn?: string) {
  if (existingArn) {
    try {
      const described = await acm.send(
        new DescribeCertificateCommand({
          CertificateArn: existingArn,
        }),
      );

      if (described.Certificate?.CertificateArn) {
        return described.Certificate;
      }
    } catch {
      // fall through and request a replacement
    }
  }

  const requested = await acm.send(
    new RequestCertificateCommand({
      DomainName: primaryDomain,
      ValidationMethod: "DNS",
      SubjectAlternativeNames: domains.filter((domain) => domain !== primaryDomain),
      IdempotencyToken: "xupradrylakeedge",
      Tags: [
        { Key: "Name", Value: "xupra-drylake-edge" },
        { Key: "Project", Value: "xupra-drylake" },
        { Key: "Environment", Value: "staging" },
      ],
    }),
  );

  if (!requested.CertificateArn) {
    throw new Error("Failed to request ACM certificate.");
  }

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const described = await acm.send(
    new DescribeCertificateCommand({
      CertificateArn: requested.CertificateArn,
    }),
  );

  if (!described.Certificate?.CertificateArn) {
    throw new Error("Failed to describe ACM certificate.");
  }

  return described.Certificate;
}

function getValidationRecords(certificate: Awaited<ReturnType<typeof ensureCertificate>>) {
  const records: DnsRecord[] = [];

  for (const option of certificate.DomainValidationOptions ?? []) {
    const record = option.ResourceRecord;

    if (!option.DomainName || !record?.Name || !record.Value || !record.Type) {
      continue;
    }

    records.push({
      domain: option.DomainName,
      name: record.Name,
      type: record.Type,
      value: record.Value,
    });
  }

  return records;
}

async function ensureListeners(input: {
  loadBalancerArn: string;
  targetGroupArn: string;
  certificateArn?: string;
  certificateIssued: boolean;
}) {
  const described = await elbv2.send(
    new DescribeListenersCommand({
      LoadBalancerArn: input.loadBalancerArn,
    }),
  );

  const listeners = described.Listeners ?? [];
  const httpListener = listeners.find((listener) => listener.Port === 80);
  const httpsListener = listeners.find((listener) => listener.Port === 443);

  if (input.certificateIssued && input.certificateArn) {
    const httpsPayload = {
      Certificates: [{ CertificateArn: input.certificateArn }],
      DefaultActions: [{ Type: "forward" as const, TargetGroupArn: input.targetGroupArn }],
      Protocol: "HTTPS" as const,
      Port: 443,
      SslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
    };

    if (httpsListener?.ListenerArn) {
      await elbv2.send(
        new ModifyListenerCommand({
          ListenerArn: httpsListener.ListenerArn,
          ...httpsPayload,
        }),
      );
    } else {
      await elbv2.send(
        new CreateListenerCommand({
          LoadBalancerArn: input.loadBalancerArn,
          ...httpsPayload,
        }),
      );
    }

    const httpPayload = {
      DefaultActions: [
        {
          Type: "redirect" as const,
          RedirectConfig: {
            Protocol: "HTTPS",
            Port: "443",
            StatusCode: "HTTP_301" as const,
          },
        },
      ],
      Protocol: "HTTP" as const,
      Port: 80,
    };

    if (httpListener?.ListenerArn) {
      await elbv2.send(
        new ModifyListenerCommand({
          ListenerArn: httpListener.ListenerArn,
          ...httpPayload,
        }),
      );
    } else {
      await elbv2.send(
        new CreateListenerCommand({
          LoadBalancerArn: input.loadBalancerArn,
          ...httpPayload,
        }),
      );
    }

    return;
  }

  const httpPayload = {
    DefaultActions: [{ Type: "forward" as const, TargetGroupArn: input.targetGroupArn }],
    Protocol: "HTTP" as const,
    Port: 80,
  };

  if (httpListener?.ListenerArn) {
    await elbv2.send(
      new ModifyListenerCommand({
        ListenerArn: httpListener.ListenerArn,
        ...httpPayload,
      }),
    );
  } else {
    await elbv2.send(
      new CreateListenerCommand({
        LoadBalancerArn: input.loadBalancerArn,
        ...httpPayload,
      }),
    );
  }
}

async function main() {
  const staging = await readStagingManifest();

  if (!staging.instanceId) {
    throw new Error("Missing staging instance. Run npm run aws:provision-staging first.");
  }

  const { appHost, marketingHost, domains, primaryCertificateDomain } = getHosts();
  const instance = await getInstance(staging.instanceId);
  const subnetIds = await resolveAlbSubnets(instance.VpcId!);
  const securityGroupId = await ensureSecurityGroup(instance.VpcId!);
  const targetGroup = await ensureTargetGroup(instance.VpcId!);
  const loadBalancer = await ensureLoadBalancer(subnetIds, securityGroupId);

  await elbv2.send(
    new RegisterTargetsCommand({
      TargetGroupArn: targetGroup.TargetGroupArn!,
      Targets: [{ Id: staging.instanceId, Port: 443 }],
    }),
  );

  let existingCertificateArn: string | undefined;

  try {
    const listeners = await elbv2.send(
      new DescribeListenersCommand({
        LoadBalancerArn: loadBalancer.LoadBalancerArn!,
      }),
    );
    const httpsListener = listeners.Listeners?.find((listener) => listener.Port === 443);
    existingCertificateArn = httpsListener?.Certificates?.[0]?.CertificateArn;
  } catch {
    existingCertificateArn = undefined;
  }

  const certificate = await ensureCertificate(domains, primaryCertificateDomain, existingCertificateArn);
  const validationRecords = getValidationRecords(certificate);
  const certificateIssued = certificate.Status === "ISSUED";

  await ensureListeners({
    loadBalancerArn: loadBalancer.LoadBalancerArn!,
    targetGroupArn: targetGroup.TargetGroupArn!,
    certificateArn: certificate.CertificateArn,
    certificateIssued,
  });

  const manifest = {
    region,
    appHost,
    marketingHost,
    loadBalancer: {
      arn: loadBalancer.LoadBalancerArn,
      dnsName: loadBalancer.DNSName,
      canonicalHostedZoneId: loadBalancer.CanonicalHostedZoneId,
      securityGroupId,
      subnets: subnetIds,
      state: loadBalancer.State?.Code ?? null,
    },
    targetGroup: {
      arn: targetGroup.TargetGroupArn,
      protocol: targetGroup.Protocol,
      port: targetGroup.Port,
    },
    certificate: {
      arn: certificate.CertificateArn,
      status: certificate.Status ?? null,
      validationRecords,
    },
    cloudflareCutover: {
      apexTarget: loadBalancer.DNSName,
      appTarget: loadBalancer.DNSName,
      note: "Switch xupracorp.com and drylake.xupracorp.com from EC2-origin records to proxied CNAMEs after the ACM certificate reaches ISSUED.",
    },
  };

  await fs.writeFile(edgeManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
