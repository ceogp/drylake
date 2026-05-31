import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { checkPlanningModelAccess } = await import("@/lib/services/openai-health");
  const health = await checkPlanningModelAccess();

  console.log(JSON.stringify({
    ok: health.ok,
    foundation: {
      model: health.foundation.model,
      configured: health.foundation.configured,
      ok: health.foundation.ok,
      status: health.foundation.status ?? null,
      message: health.foundation.message ?? null,
    },
    nano: {
      model: health.nano.model,
      configured: health.nano.configured,
      ok: health.nano.ok,
      status: health.nano.status ?? null,
      message: health.nano.message ?? null,
    },
  }, null, 2));

  if (!health.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
