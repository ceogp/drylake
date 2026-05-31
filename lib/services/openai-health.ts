import { getOpenAiApiKey } from "@/lib/security/runtime-secrets";
import { resolvePlanningModels } from "@/lib/services/planning-models";

export type OpenAiModelHealth = {
  configuredModel: string;
  model: string;
  aliasApplied?: boolean;
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
      configuredModel: normalizedModel,
      model: normalizedModel,
      configured: false,
      ok: false,
      message: "Model is not configured.",
    };
  }

  const apiKey = await getOpenAiApiKey().catch(() => "");
  if (!apiKey) {
    return {
      configuredModel: normalizedModel,
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
        configuredModel: normalizedModel,
        model: normalizedModel,
        configured: true,
        ok: true,
        status: response.status,
      };
    }

    return {
      configuredModel: normalizedModel,
      model: normalizedModel,
      configured: true,
      ok: false,
      status: response.status,
      message: sanitizeOpenAiError(await response.text()),
    };
  } catch (error) {
    return {
      configuredModel: normalizedModel,
      model: normalizedModel,
      configured: true,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkPlanningModelAccess() {
  const models = resolvePlanningModels();
  const [foundation, nano] = await Promise.all([
    checkOpenAiModelAccess(models.foundation.model).then((result) => ({
      ...result,
      configuredModel: models.foundation.configuredModel,
      model: models.foundation.model,
      aliasApplied: models.foundation.aliasApplied,
    })),
    checkOpenAiModelAccess(models.nano.model).then((result) => ({
      ...result,
      configuredModel: models.nano.configuredModel,
      model: models.nano.model,
      aliasApplied: models.nano.aliasApplied,
    })),
  ]);

  return {
    foundation,
    nano,
    ok: foundation.ok && nano.ok,
  };
}
