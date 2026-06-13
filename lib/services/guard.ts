import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { saveGuardArtifactText } from "@/lib/storage/artifacts";

const guardSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
const safeDeveloperRankSchema = z.enum(["Scout", "Builder", "Operator", "Guardian", "Sentinel"]);
const artifactKindSchema = z.enum(["mcp-config", "skill", "agent-rule", "instruction", "guard-report"]);

const jsonObjectSchema = z.record(z.string(), z.unknown());

const guardFindingSchema = z.object({
  id: z.string().max(500),
  category: z.string().max(80),
  severity: guardSeveritySchema,
  title: z.string().max(500),
  evidence: z.string().max(2000),
  recommendation: z.string().max(2000),
  safeToShare: z.boolean().optional(),
  source: z.string().max(80).optional(),
  path: z.string().max(1000).optional(),
  line: z.number().int().min(1).max(10_000_000).optional(),
}).passthrough();

const guardArtifactSchema = z.object({
  kind: artifactKindSchema,
  logicalPath: z.string().trim().min(1).max(1000),
  content: z.string().min(1).max(500_000),
  mimeType: z.string().trim().min(1).max(120).optional(),
});

export const guardScanUploadSchema = z.object({
  workspaceHash: z.string().trim().min(8).max(160).optional(),
  sourceClient: z.string().trim().min(1).max(40).default("vscode"),
  consentMode: z.enum(["local", "baseline_upload", "active_guard"]).default("local"),
  scan: z.object({
    scannedAt: z.string().datetime(),
    score: z.number().int().min(0).max(100),
    rank: safeDeveloperRankSchema,
    summary: jsonObjectSchema,
    categoryScores: jsonObjectSchema,
    findings: z.array(guardFindingSchema).max(500),
    connectionMap: jsonObjectSchema.optional(),
    extensions: z.array(jsonObjectSchema).max(1000).default([]),
    mcpServers: z.array(jsonObjectSchema).max(500).default([]),
    workspaceSurface: jsonObjectSchema.optional(),
    packageManagers: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
    packageScripts: z.array(z.string().trim().min(1).max(200)).max(500).default([]),
  }),
  artifacts: z.array(guardArtifactSchema).max(120).default([]),
}).strict();

export type GuardScanUploadInput = z.infer<typeof guardScanUploadSchema>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function redactGuardArtifact(value: string) {
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED PRIVATE KEY]")
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED AWS ACCESS KEY]")
    .replace(/\b(?:sk|rk|pk|xox[baprs]|gh[pousr])_[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s"'`]+/gi, "$1[REDACTED]")
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*)[^\s"'`]+/gi, "$1[REDACTED]")
    .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s`]+["']?/gi, "$1=[REDACTED]")
    .replace(/("?(?:api[_-]?key|token|secret|password|private[_-]?key|client[_-]?secret|access[_-]?token)"?\s*:\s*)"[^"]*"/gi, "$1\"[REDACTED]\"")
    .replace(/('?(?:api[_-]?key|token|secret|password|private[_-]?key|client[_-]?secret|access[_-]?token)'?\s*:\s*)'[^']*'/gi, "$1'[REDACTED]'")
    .replace(/\b((?:api[_-]?key|token|secret|password|private[_-]?key|client[_-]?secret|access[_-]?token)\s*=\s*)[^\s"'`]+/gi, "$1[REDACTED]");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function recordGuardScanUpload(input: {
  organizationId: string;
  actorUserId: string;
  payload: GuardScanUploadInput;
}) {
  const artifactUploadAllowed = input.payload.consentMode !== "local";
  const artifacts = artifactUploadAllowed ? input.payload.artifacts : [];

  const guardScan = await prisma.guardScan.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      sourceClient: input.payload.sourceClient,
      workspaceHash: input.payload.workspaceHash,
      score: input.payload.scan.score,
      rank: input.payload.scan.rank,
      consentMode: input.payload.consentMode,
      uploadedArtifactCount: artifacts.length,
      scannedAt: new Date(input.payload.scan.scannedAt),
      summaryJson: toJson(input.payload.scan.summary),
      categoryScoresJson: toJson(input.payload.scan.categoryScores),
      findingsJson: toJson(input.payload.scan.findings),
      connectionMapJson: input.payload.scan.connectionMap ? toJson(input.payload.scan.connectionMap) : undefined,
      extensionsJson: toJson(input.payload.scan.extensions),
      mcpServersJson: toJson(input.payload.scan.mcpServers),
      workspaceSurfaceJson: input.payload.scan.workspaceSurface ? toJson(input.payload.scan.workspaceSurface) : undefined,
      packageManagersJson: toJson(input.payload.scan.packageManagers),
      packageScriptsJson: toJson(input.payload.scan.packageScripts),
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  const savedArtifacts = [];
  for (const artifact of artifacts) {
    const redactedContent = redactGuardArtifact(artifact.content);
    const stored = await saveGuardArtifactText({
      guardScanId: guardScan.id,
      logicalPath: artifact.logicalPath,
      text: redactedContent,
      mimeType: artifact.mimeType,
    });

    const saved = await prisma.guardArtifact.create({
      data: {
        guardScanId: guardScan.id,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        kind: artifact.kind,
        logicalPath: artifact.logicalPath,
        contentHash: sha256(artifact.content),
        redacted: redactedContent !== artifact.content,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        checksumSha256: stored.checksumSha256,
      },
      select: {
        id: true,
        kind: true,
        logicalPath: true,
        sizeBytes: true,
        redacted: true,
      },
    });
    savedArtifacts.push(saved);
  }

  return {
    guardScan,
    artifacts: savedArtifacts,
  };
}
