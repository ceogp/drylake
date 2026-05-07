import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
      message: "DATABASE_URL must be a PostgreSQL connection string.",
    }),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  ADMIN_INTERNAL_HOST: z.string().optional(),
  ADMIN_INTERNAL_ORIGIN: z.string().optional(),
  ADMIN_INTERNAL_BASIC_AUTH_USERNAME: z.string().optional(),
  ADMIN_INTERNAL_BASIC_AUTH_PASSWORD: z.string().optional(),
  APP_ENCRYPTION_KEY: z.string().default(""),
  AUTH_MODE: z.enum(["dev", "clerk"]).default("dev"),
  DEFAULT_DEV_USER_EMAIL: z.email().default("owner@xupra.local"),
  DEFAULT_DEV_USER_NAME: z.string().min(1).default("Xupra Owner"),
  PLATFORM_ADMIN_EMAILS: z.string().default(""),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),
  CLERK_SIGN_IN_URL: z.string().optional(),
  CLERK_SIGN_UP_URL: z.string().optional(),
  ARTIFACT_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  SECRETS_PROVIDER: z.enum(["env", "aws_secrets_manager"]).default("env"),
  JOB_EXECUTION_MODE: z.enum(["inline", "worker"]).default("inline"),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_PREFIX: z.string().default("xupra-drylake"),
  AWS_SECRETS_PREFIX: z.string().default("xupra-drylake"),
  AWS_KMS_KEY_ID: z.string().optional(),
  AI_PROVIDER: z.enum(["openai", "kimi", "anthropic"]).default("openai"),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  claudetoken: z.string().optional(),
  ANTHROPIC_BASE_URL: z.url().default("https://api.anthropic.com"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  KIMI_API_KEY: z.string().optional(),
  KIMI_BASE_URL: z.url().default("https://api.moonshot.ai/v1"),
  KIMI_MODEL: z.string().default("kimi-k2.6"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.4-mini"),
  SKILLS_SH_API_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_ENTERPRISE_PRICE_ID: z.string().optional(),
  BILLING_PROVIDER: z.enum(["stripe", "clerk"]).default("stripe"),
  BILLING_ENFORCEMENT_MODE: z.enum(["development", "strict"]).default("development"),
  XUPRA_RELEASE_SHA: z.string().optional(),
  XUPRA_RELEASE_SHORT_SHA: z.string().optional(),
  XUPRA_RELEASE_REF: z.string().optional(),
  XUPRA_RELEASE_PIPELINE_ID: z.string().optional(),
  XUPRA_RELEASE_DEPLOYED_AT: z.string().optional(),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

if (parsed.data.SECRETS_PROVIDER === "env" && parsed.data.APP_ENCRYPTION_KEY.length < 32) {
  throw new Error("APP_ENCRYPTION_KEY must be at least 32 characters when SECRETS_PROVIDER=env");
}

// Production-only cross-field validation — fail fast rather than silently misbehave
if (parsed.data.NODE_ENV === "production") {
  const prod = parsed.data;
  const errors: string[] = [];

  if (prod.AUTH_MODE === "clerk") {
    if (!prod.CLERK_SECRET_KEY)
      errors.push("CLERK_SECRET_KEY is required when AUTH_MODE=clerk");
    if (!prod.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
      errors.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required when AUTH_MODE=clerk");
    if (!prod.CLERK_WEBHOOK_SIGNING_SECRET)
      errors.push("CLERK_WEBHOOK_SIGNING_SECRET is required when AUTH_MODE=clerk");
  }

  if (prod.BILLING_PROVIDER === "stripe") {
    if (!prod.STRIPE_SECRET_KEY)
      errors.push("STRIPE_SECRET_KEY is required when BILLING_PROVIDER=stripe");
    if (!prod.STRIPE_WEBHOOK_SECRET)
      errors.push("STRIPE_WEBHOOK_SECRET is required when BILLING_PROVIDER=stripe");
    if (!prod.STRIPE_PRO_PRICE_ID)
      errors.push("STRIPE_PRO_PRICE_ID is required when BILLING_PROVIDER=stripe");
  }

  if (prod.BILLING_ENFORCEMENT_MODE === "development") {
    console.warn(
      "[security] WARNING: BILLING_ENFORCEMENT_MODE=development in a production environment. " +
        "All entitlement checks will be bypassed — set BILLING_ENFORCEMENT_MODE=strict.",
    );
  }

  if (errors.length > 0) {
    console.error(
      "Production environment validation failed:\n" +
        errors.map((e) => `  - ${e}`).join("\n"),
    );
    throw new Error("Production environment validation failed — check server logs for details");
  }
}

export const env = parsed.data;
