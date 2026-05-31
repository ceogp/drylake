import { env } from "@/lib/env";

export const FOUNDATION_PLANNING_MODEL = "gpt-5.4";
export const FREE_PLANNING_MODEL = "gpt-5.4-nano";

function normalizeModel(raw: string | undefined, fallback: string) {
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

let warnedFoundationOverride = false;

function foundationModel() {
  const configuredModel = normalizeModel(env.OPENAI_MODEL, FOUNDATION_PLANNING_MODEL);
  const overrideApplied = configuredModel !== FOUNDATION_PLANNING_MODEL;

  if (overrideApplied && !warnedFoundationOverride) {
    warnedFoundationOverride = true;
    console.warn("[planning-models] forcing paid planning model", {
      configuredModel,
      effectiveModel: FOUNDATION_PLANNING_MODEL,
    });
  }

  return {
    configuredModel,
    model: FOUNDATION_PLANNING_MODEL,
    aliasApplied: overrideApplied,
  };
}

export type ResolvedPlanningModel = {
  configuredModel: string;
  model: string;
  aliasApplied: boolean;
};

export function resolvePlanningModels(): {
  foundation: ResolvedPlanningModel;
  nano: ResolvedPlanningModel;
} {
  const configuredNanoModel = normalizeModel(env.OPENAI_FREE_MODEL, FREE_PLANNING_MODEL);

  return {
    foundation: foundationModel(),
    nano: {
      configuredModel: configuredNanoModel,
      model: configuredNanoModel,
      aliasApplied: false,
    },
  };
}
