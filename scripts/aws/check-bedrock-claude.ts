import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as {
  loadEnvConfig: (dir: string, dev?: boolean) => void;
};

loadEnvConfig(process.cwd(), true);

function endpointFor(bedrock: typeof import("../../lib/services/bedrock-anthropic"), model: string) {
  try {
    return bedrock.bedrockConverseEndpoint(model);
  } catch (error) {
    return error instanceof Error ? `unavailable (${error.message})` : "unavailable";
  }
}

async function main() {
  const [{ env }, bedrock] = await Promise.all([
    import("../../lib/env"),
    import("../../lib/services/bedrock-anthropic"),
  ]);

  const models = [
    env.BEDROCK_FREE_MODEL,
    env.BEDROCK_MODEL,
    env.BEDROCK_CODING_MODEL,
  ].filter((model, index, allModels) => Boolean(model) && allModels.indexOf(model) === index);

  if (models.length === 0) {
    console.error("No Bedrock Anthropic model IDs are configured.");
    process.exitCode = 1;
    return;
  }

  for (const model of models) {
    try {
      const payload = await bedrock.createBedrockAnthropicResponse({
        model,
        systemPrompt: "Return exactly OK.",
        userPrompt: "Return exactly OK.",
      });
      const text = bedrock.extractBedrockConverseText(payload)?.trim() ?? "";

      console.log(`${model}: ok`);
      console.log(`  endpoint: ${endpointFor(bedrock, model)}`);
      console.log(`  response: ${text.slice(0, 80)}`);
    } catch (error) {
      console.error(`${model}: failed`);
      console.error(`  endpoint: ${endpointFor(bedrock, model)}`);
      console.error(`  error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}

void main();
