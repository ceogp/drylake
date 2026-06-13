import { Prisma } from "@prisma/client";
import { z } from "zod";

import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import {
  getRequestOrganizationContext,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";

const jsonObjectSchema = z.record(z.string(), z.unknown());

const cloudAnalysisSchema = z.object({
  guardScanId: z.string().min(1).optional(),
  approvedPayload: z.object({
    scanManifest: jsonObjectSchema.optional(),
    redactedFindings: z.array(jsonObjectSchema).max(500).default([]),
    dependencyMetadata: jsonObjectSchema.optional(),
    mcpMetadata: jsonObjectSchema.optional(),
    extensionMetadata: jsonObjectSchema.optional(),
    filePathInventory: z.array(z.string().trim().min(1).max(1000)).max(5000).default([]),
    selectedPromptFiles: z.array(z.object({
      path: z.string().trim().min(1).max(1000),
      content: z.string().max(50_000),
    })).max(50).default([]),
  }).strict(),
}).strict();

type ApprovedCloudPayload = z.infer<typeof cloudAnalysisSchema>["approvedPayload"];

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function redactString(value: string) {
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED PRIVATE KEY]")
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED AWS ACCESS KEY]")
    .replace(/\b(?:sk|rk|pk|xox[baprs]|gh[pousr])_[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*)[^\s"'`]+/gi, "$1[REDACTED]");
}

function redactDeep(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactDeep);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactDeep(item)]));
  }

  return value;
}

function countBy(items: Array<Record<string, unknown>>, key: string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = typeof item[key] === "string" ? item[key] : "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function compactStrings(value: unknown, keys: string[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    return keys
      .map((key) => record[key])
      .filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)
      .map((candidate) => candidate.trim());
  });
}

function dependencySignals(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const record = metadata as Record<string, unknown>;
  const fromDependencies = compactStrings(record.dependencies, ["name", "package", "id"]);
  const packageManagers = Array.isArray(record.packageManagers)
    ? record.packageManagers.filter((item): item is string => typeof item === "string")
    : [];
  const packageScripts = Array.isArray(record.packageScripts)
    ? record.packageScripts.filter((item): item is string => typeof item === "string")
    : [];
  const riskyPackageScripts = compactStrings(record.riskyPackageScripts, ["path", "name", "risk"]);

  return [
    ...fromDependencies,
    ...packageManagers.map((item) => `package-manager:${item}`),
    ...packageScripts.map((item) => `script:${item}`),
    ...riskyPackageScripts.map((item) => `risky-script:${item}`),
  ];
}

function promptRiskSignals(files: ApprovedCloudPayload["selectedPromptFiles"]) {
  return files.flatMap((file) => {
    const content = file.content.toLowerCase();
    const signals = [
      content.includes("ignore previous") ? "override_instructions" : null,
      content.includes("secret") || content.includes("token") || content.includes("credential") ? "secret_access_request" : null,
      content.includes("curl") || content.includes("wget") || content.includes("http") ? "remote_or_network_instruction" : null,
      content.includes("shell") || content.includes("powershell") || content.includes("bash") ? "shell_escalation_instruction" : null,
    ].filter((signal): signal is string => Boolean(signal));

    return signals.length ? [{ path: file.path, signals }] : [];
  });
}

function buildCloudResult(payload: ApprovedCloudPayload) {
  const findingCount = payload.redactedFindings.length;
  const fileCount = payload.filePathInventory.length;
  const promptCount = payload.selectedPromptFiles.length;
  const severityCounts = countBy(payload.redactedFindings, "severity");
  const categoryCounts = countBy(payload.redactedFindings, "category");
  const criticalAndHigh = payload.redactedFindings.filter((finding) =>
    finding.severity === "critical" || finding.severity === "high",
  );
  const dependencyNames = dependencySignals(payload.dependencyMetadata);
  const mcpTools = compactStrings((payload.mcpMetadata as Record<string, unknown> | undefined)?.servers, ["name", "command"]);
  const extensions = compactStrings((payload.extensionMetadata as Record<string, unknown> | undefined)?.extensions, ["id", "displayName", "name"]);
  const promptSignals = promptRiskSignals(payload.selectedPromptFiles);

  return {
    summary: "Deep Cloud Analysis completed from approved, redacted Guard metadata only.",
    uploadAssurance: {
      rawSecretsAllowed: false,
      fullSourceTreeAllowed: false,
      approvedPromptFileCount: promptCount,
      filePathInventoryCount: fileCount,
    },
    riskCorrelation: {
      findingCount,
      severityCounts,
      categoryCounts,
      criticalAndHighCount: criticalAndHigh.length,
      correlatedRisk: criticalAndHigh.length > 0 && (mcpTools.length > 0 || extensions.length > 0 || promptSignals.length > 0),
    },
    crossScanComparison: {
      mode: "single_workspace_snapshot",
      note: "Team baseline and personal previous-scan comparison are handled by saved Guard reports and baseline diff.",
    },
    supplyChainReview: {
      packageSignals: dependencyNames.slice(0, 50),
      recommendation: dependencyNames.length
        ? "Review dependency metadata for unpinned execution, install hooks, and unknown tool launchers."
        : "No dependency metadata was approved for upload.",
    },
    promptRuleRiskReview: {
      selectedPromptFileCount: promptCount,
      promptSignals,
      recommendation: promptSignals.length
        ? "Remove safety overrides, remote includes, secret access requests, and shell/network escalation from prompt/rule files."
        : "No prompt/rule escalation signals were found in approved prompt files.",
    },
    agentToolGraph: {
      mcpTools: mcpTools.slice(0, 50),
      extensions: extensions.slice(0, 50),
      recommendation: "Reduce agent tool blast radius by pinning launch commands, scoping env vars, and denying broad terminal/cloud/browser tools by default.",
    },
    blastRadiusGraph: {
      filePathInventoryCount: fileCount,
      sensitivePathSignals: payload.filePathInventory.filter((path) =>
        /(^|\/)(\.env|\.github|terraform|docker|k8s|kubernetes|deploy|scripts)(\/|$)/i.test(path),
      ).slice(0, 100),
    },
    remediationPlan: {
      executiveSummary: criticalAndHigh.length
        ? "Address critical/high Guard findings before allowing agents to run tools against this workspace."
        : "No critical/high approved findings were present; focus on reducing tool scope and context waste.",
      criticalRisks: criticalAndHigh.slice(0, 25),
      quickFixes: [
        "Pin MCP and package-launch versions.",
        "Remove prompt/rule instructions that override safety or request secrets.",
        "Move secrets out of agent-readable files and rotate exposed credentials.",
        "Add generated/vendor/build outputs to agent ignore files.",
      ],
      configChanges: [
        "Apply MCP allowlists for approved team tools.",
        "Apply extension allowlists for agent, terminal, remote, and cloud-capable extensions.",
        "Require review for deploy scripts, CI/CD, Docker, Kubernetes, Terraform, and CDK changes.",
      ],
    },
  };
}

export async function GET(request: Request) {
  try {
    const context = await getRequestOrganizationContext(request);
    const jobs = await prisma.cloudAnalysisJob.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        guardScanId: true,
        status: true,
        resultJson: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok({
      jobs: jobs.map((job) => ({
        ...job,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to list cloud analysis jobs");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = cloudAnalysisSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await getRequestOrganizationContext(request);
    const { resolved } = await getEntitlementsForOrganization(context.organizationId);

    if (!resolved.canUseApprovedUpload || !resolved.canUseDeepCloudAnalysis) {
      return forbidden("Approved upload and Deep Cloud Analysis require Security Pro.");
    }

    if (parsed.data.guardScanId) {
      const scan = await prisma.guardScan.findFirst({
        where: {
          id: parsed.data.guardScanId,
          organizationId: context.organizationId,
        },
        select: { id: true },
      });

      if (!scan) {
        return forbidden("The requested Guard scan does not belong to this account.");
      }
    }

    const approvedPayload = redactDeep(parsed.data.approvedPayload);
    const result = buildCloudResult(approvedPayload as ApprovedCloudPayload);
    const job = await prisma.cloudAnalysisJob.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        guardScanId: parsed.data.guardScanId,
        status: "succeeded",
        approvedPayloadJson: asJson(approvedPayload),
        resultJson: asJson(result),
      },
      select: {
        id: true,
        guardScanId: true,
        status: true,
        resultJson: true,
        createdAt: true,
      },
    });

    return ok({
      job: {
        ...job,
        createdAt: job.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized("Connect the extension before starting Deep Cloud Analysis.");
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to start Deep Cloud Analysis");
  }
}
