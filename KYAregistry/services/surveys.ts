import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getTrustRegistryUrl, sha256Hex } from "@/KYAregistry/services/registry";
import { submitTrustKyaQuestionnaire } from "@/KYAregistry/services/submissions";

const SURVEY_TOKEN_PREFIX = "xupra-trust-survey";
const DEFAULT_SURVEY_TTL_DAYS = 14;

export const createKyaSurveyInviteSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  productId: z.string().trim().min(1).optional(),
  registryCaseId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().max(320),
  expiresInDays: z.number().int().min(1).max(90).default(DEFAULT_SURVEY_TTL_DAYS),
}).strict();

export const submitKyaSurveyInviteSchema = z.object({
  token: z.string().trim().min(24).max(500),
  answers: z.record(z.string(), z.unknown()),
}).strict();

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function newSurveyToken() {
  return `${SURVEY_TOKEN_PREFIX}_${crypto.randomBytes(32).toString("base64url")}`;
}

function tokenHash(rawToken: string) {
  return sha256Hex(`${SURVEY_TOKEN_PREFIX}:${rawToken}`);
}

function expiresAt(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function createKyaSurveyInvite(input: {
  organizationId?: string | null;
  companyId?: string | null;
  productId?: string | null;
  registryCaseId?: string | null;
  email: string;
  expiresInDays?: number;
}) {
  const parsed = createKyaSurveyInviteSchema.parse({
    companyId: input.companyId ?? undefined,
    productId: input.productId ?? undefined,
    registryCaseId: input.registryCaseId ?? undefined,
    email: input.email,
    expiresInDays: input.expiresInDays ?? DEFAULT_SURVEY_TTL_DAYS,
  });

  if (parsed.companyId) {
    const company = await prisma.trustCompany.findFirst({
      where: {
        id: parsed.companyId,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      },
      select: { id: true },
    });

    if (!company) {
      throw new Error("Trust company profile not found.");
    }
  }

  if (parsed.productId) {
    const product = await prisma.trustProduct.findFirst({
      where: {
        id: parsed.productId,
        ...(input.organizationId ? { company: { organizationId: input.organizationId } } : {}),
      },
      select: { id: true, companyId: true },
    });

    if (!product) {
      throw new Error("Trust product not found.");
    }
  }

  let registryCaseCompanyId: string | null = null;
  if (parsed.registryCaseId) {
    const registryCase = await prisma.trustRegistryCase.findFirst({
      where: {
        id: parsed.registryCaseId,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      },
      select: { id: true, companyId: true },
    });

    if (!registryCase) {
      throw new Error("KYA registry case not found.");
    }

    registryCaseCompanyId = registryCase.companyId;
  }

  const rawToken = newSurveyToken();
  const invite = await prisma.trustSurveyInvite.create({
    data: {
      organizationId: input.organizationId ?? null,
      companyId: parsed.companyId ?? registryCaseCompanyId,
      productId: parsed.productId ?? null,
      registryCaseId: parsed.registryCaseId ?? null,
      email: parsed.email,
      tokenHash: tokenHash(rawToken),
      surveyType: "kya_controls",
      status: "pending",
      expiresAt: expiresAt(parsed.expiresInDays),
      metadataJson: toJson({
        delivery: "email_link",
      }),
    },
  });

  return {
    invite,
    token: rawToken,
    surveyUrl: getTrustRegistryUrl(`/survey/kya/${encodeURIComponent(rawToken)}`, env.XUPRA_TRUST_REGISTRY_BASE_URL),
  };
}

export async function submitKyaSurveyInvite(input: unknown) {
  const parsed = submitKyaSurveyInviteSchema.parse(input);
  const invite = await prisma.trustSurveyInvite.findUnique({
    where: { tokenHash: tokenHash(parsed.token) },
  });

  if (!invite || invite.status !== "pending") {
    throw new Error("KYA survey invite is invalid or already used.");
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    await prisma.trustSurveyInvite.update({
      where: { id: invite.id },
      data: { status: "expired" },
    });
    throw new Error("KYA survey invite has expired.");
  }

  if (!invite.organizationId && !invite.companyId) {
    throw new Error("KYA survey invite is missing a registration target.");
  }

  const result = await submitTrustKyaQuestionnaire({
    organizationId: invite.organizationId,
    companyId: invite.companyId,
    productId: invite.productId,
    answers: parsed.answers,
  });

  await prisma.trustSurveyInvite.update({
    where: { id: invite.id },
    data: {
      status: "submitted",
      submittedAt: new Date(),
      companyId: result.company.id,
      productId: result.product?.id ?? invite.productId,
    },
  });

  return {
    inviteId: invite.id,
    companyId: result.company.id,
    productId: result.product?.id ?? null,
    questionnaireId: result.questionnaire.id,
    score: result.questionnaire.score,
    kyaLevel: result.questionnaire.kyaLevel,
  };
}
