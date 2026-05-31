import { env } from "@/lib/env";
import { getOpenAiApiKey } from "@/lib/security/runtime-secrets";

export type OpenAiModelHealth = {
  model: string;
  configured: boolean;
  ok: boolean;
  status?: number;
  message?: string;
};

function sanitizeOpenAiError(value: string) {
  return value.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").slice(0, 500);
}

export async function checkOpenAiModelAccess(model: string): Promise<OpenAiModelHealth> {
  const normalizedModel = model.trim();

  if (!normalizedModel) {
    return {
      model: normalizedModel,
      configured: false,
      ok: false,
      message: "Model is not configured.",
    };
  }

  const apiKey = await getOpenAiApiKey().catch(() => "");
  if (!apiKey) {
    return {
      model: normalizedModel,
      configured: false,
      ok: false,
      message: "OPENAI_API_KEY is not configured.",
    };
  }

  try {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(normalizedModel)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return {
        model: normalizedModel,
        configured: true,
        ok: true,
        status: response.status,
      };
    }

    return {
      model: normalizedModel,
      configured: true,
      ok: false,
      status: response.status,
      message: sanitizeOpenAiError(await response.text()),
    };
  } catch (error) {
    return {
      model: normalizedModel,
      configured: true,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkPlanningModelAccess() {
  const [foundation, nano] = await Promise.all([
    checkOpenAiModelAccess(env.OPENAI_MODEL),
    checkOpenAiModelAccess(env.OPENAI_FREE_MODEL),
  ]);

  return {
    foundation,
    nano,
    ok: foundation.ok && nano.ok,
  };
}
