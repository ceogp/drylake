import { env } from "@/lib/env";
import { getBedrockApiKey } from "@/lib/security/runtime-secrets";

export type BedrockAnthropicTextFormat = {
  type: "json_schema";
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

type ConversePayload = {
  output?: {
    message?: {
      content?: Array<{
        text?: string;
      }>;
    };
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

function trimmed(value: string | undefined) {
  return value?.trim() ?? "";
}

export function bedrockAnthropicRegion() {
  const region = trimmed(env.BEDROCK_REGION) || trimmed(env.BEDROCK_OPENAI_REGION) || trimmed(env.AWS_REGION);
  if (!region) {
    throw new Error("Bedrock Anthropic is not configured: BEDROCK_REGION, BEDROCK_OPENAI_REGION, or AWS_REGION is missing.");
  }

  return region;
}

export function bedrockConverseEndpoint(model: string) {
  return `https://bedrock-runtime.${bedrockAnthropicRegion()}.amazonaws.com/model/${encodeURIComponent(model)}/converse`;
}

function inferredInferenceProfileModelId(model: string) {
  if (!model.startsWith("anthropic.")) {
    return null;
  }

  const region = bedrockAnthropicRegion();
  if (region.startsWith("us-")) {
    return `us.${model}`;
  }

  if (region.startsWith("eu-")) {
    return `eu.${model}`;
  }

  if (region.startsWith("ap-")) {
    return `apac.${model}`;
  }

  return null;
}

function shouldRetryWithInferenceProfile(errorText: string) {
  return errorText.toLowerCase().includes("inference profile") ||
    errorText.toLowerCase().includes("on-demand throughput");
}

function schemaInstruction(textFormat: BedrockAnthropicTextFormat | undefined) {
  if (!textFormat) {
    return "";
  }

  return [
    "",
    "Output contract:",
    "Return only valid JSON. Do not wrap it in Markdown fences.",
    `The JSON must match this schema named ${textFormat.name}:`,
    JSON.stringify(textFormat.schema),
  ].join("\n");
}

export function extractBedrockConverseText(payload: ConversePayload) {
  return payload.output?.message?.content?.find((item) => typeof item.text === "string")?.text;
}

export async function createBedrockAnthropicResponse(params: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  textFormat?: BedrockAnthropicTextFormat;
}) {
  const apiKey = await getBedrockApiKey({ required: true });
  const body = JSON.stringify({
    system: [
      {
        text: [params.systemPrompt, schemaInstruction(params.textFormat)].filter(Boolean).join("\n"),
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            text: params.userPrompt,
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0,
    },
    requestMetadata: {
      application: "drylake",
      provider: "bedrock_anthropic",
    },
  });
  const request = async (model: string) => fetch(bedrockConverseEndpoint(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });

  let response = await request(params.model);

  if (!response.ok) {
    const errorText = await response.text();
    const fallbackModel = inferredInferenceProfileModelId(params.model);
    if (fallbackModel && shouldRetryWithInferenceProfile(errorText)) {
      response = await request(fallbackModel);

      if (response.ok) {
        return await response.json() as ConversePayload;
      }

      const fallbackErrorText = await response.text();
      throw new Error(
        `Bedrock Anthropic Converse failed (${response.status}) after retrying inference profile ${fallbackModel}: ${fallbackErrorText.slice(0, 500)}`,
      );
    }

    throw new Error(`Bedrock Anthropic Converse failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return await response.json() as ConversePayload;
}
