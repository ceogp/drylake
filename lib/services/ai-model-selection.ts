import { env } from "@/lib/env";

export function foundationPlanningModel() {
  return env.OPENAI_MODEL;
}

export function freePlanningModel() {
  return env.OPENAI_FREE_MODEL;
}

export function canonicalizationModel() {
  if (env.AI_PROVIDER === "kimi") {
    return env.KIMI_MODEL;
  }

  return env.OPENAI_MODEL;
}
