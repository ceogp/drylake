import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_PROVIDER: z.enum(["sqlite", "postgresql"]).default("sqlite"),
  DATABASE_URL: z.string().min(1),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  APP_ENCRYPTION_KEY: z.string().default(""),
  AUTH_MODE: z.enum(["dev", "clerk"]).default("dev"),
  DEFAULT_DEV_USER_EMAIL: z.email().default("owner@xupra.local"),
  DEFAULT_DEV_USER_NAME: z.string().min(1).default("Xupra Owner"),
  PLATFORM_ADMIN_EMAILS: z.string().default(""),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
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
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.4-mini"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_ENTERPRISE_PRICE_ID: z.string().optional(),
  BILLING_PROVIDER: z.enum(["stripe", "clerk"]).default("stripe"),
  BILLING_ENFORCEMENT_MODE: z.enum(["development", "strict"]).default("development"),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

if (parsed.data.SECRETS_PROVIDER === "env" && parsed.data.APP_ENCRYPTION_KEY.length < 32) {
  throw new Error("APP_ENCRYPTION_KEY must be at least 32 characters when SECRETS_PROVIDER=env");
}

export const env = parsed.data;
