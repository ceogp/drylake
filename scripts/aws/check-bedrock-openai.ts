import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as {
  loadEnvConfig: (dir: string, dev?: boolean) => void;
};

loadEnvConfig(process.cwd(), true);

async function main() {
  const [{ env }, bedrock] = await Promise.all([
    import("../../lib/env"),
    import("../../lib/services/bedrock-openai"),
  ]);

  const expectedModels = [
    env.BEDROCK_OPENAI_MODEL,
    env.BEDROCK_OPENAI_FREE_MODEL,
  ].filter((model, index, models) => model && models.indexOf(model) === index);

  try {
    const models = await bedrock.listBedrockOpenAiModels();
    const modelIds = new Set((models.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id)));

    console.log(`Bedrock OpenAI endpoint: ${bedrock.bedrockOpenAiEndpoint("responses")}`);
    console.log(`Models returned: ${modelIds.size}`);

    for (const model of expectedModels) {
      console.log(`${model}: ${modelIds.has(model) ? "available" : "not returned by /models"}`);
    }

    const missing = expectedModels.filter((model) => !modelIds.has(model));
    if (missing.length) {
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
