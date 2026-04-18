import { ok } from "@/lib/api/http";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getAuthSetup } from "@/lib/services/auth";

export async function GET() {
  const db = await prisma.$queryRawUnsafe("SELECT 1 as ok").then(() => "ok").catch(() => "error");
  const auth = getAuthSetup();

  return ok({
    service: "xupra-drylake",
    status: "ok",
    environment: env.NODE_ENV,
    connections: {
      database: db,
      authMode: auth.mode,
      authConfigured: auth.configured,
      artifactStorage: env.ARTIFACT_STORAGE_DRIVER,
      stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
      openaiConfigured: Boolean(env.OPENAI_API_KEY),
      storageConfigured:
        env.ARTIFACT_STORAGE_DRIVER === "local"
          ? true
          : Boolean(env.AWS_REGION && env.AWS_S3_BUCKET),
    },
    timestamp: new Date().toISOString(),
  });
}
