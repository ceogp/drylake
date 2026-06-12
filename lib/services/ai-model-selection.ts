import { env } from "@/lib/env";

export function foundationPlanningModel() {
  if (env.AI_PROVIDER === "anthropic") {
    return env.ANTHROPIC_MODEL;
  }

  return env.OPENAI_MODEL;
}

export function freePlanningModel() {
  if (env.AI_PROVIDER === "anthropic") {
    return env.ANTHROPIC_FREE_MODEL;
  }

  return env.OPENAI_FREE_MODEL;
}

export function canonicalizationModel() {
  if (env.AI_PROVIDER === "kimi") {
    return env.KIMI_MODEL;
  }

  if (env.AI_PROVIDER === "anthropic") {
    return env.ANTHROPIC_MODEL;
  }

  return env.OPENAI_MODEL;
}
