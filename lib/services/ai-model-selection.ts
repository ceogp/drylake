import { env } from "@/lib/env";

export function foundationPlanningModel() {
  return env.AI_PROVIDER === "bedrock_openai"
    ? env.BEDROCK_OPENAI_MODEL
    : env.OPENAI_MODEL;
}

export function freePlanningModel() {
  return env.AI_PROVIDER === "bedrock_openai"
    ? env.BEDROCK_OPENAI_FREE_MODEL
    : env.OPENAI_FREE_MODEL;
}

export function canonicalizationModel() {
  if (env.AI_PROVIDER === "kimi") {
    return env.KIMI_MODEL;
  }

  if (env.AI_PROVIDER === "bedrock_openai") {
    return env.BEDROCK_OPENAI_MODEL;
  }

  return env.OPENAI_MODEL;
}
