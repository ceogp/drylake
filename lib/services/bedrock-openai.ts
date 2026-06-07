import { env } from "@/lib/env";
import { getBedrockOpenAiApiKey } from "@/lib/security/runtime-secrets";

export type BedrockOpenAiTextFormat = {
  type: "json_schema";
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type BedrockOpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function trimmed(value: string | undefined) {
  return value?.trim() ?? "";
}

export function bedrockOpenAiApiRoot() {
  const configuredBaseUrl = trimmed(env.BEDROCK_OPENAI_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl
      .replace(/\/(?:responses|models)\/?$/i, "")
      .replace(/\/+$/, "");
  }

  const region = trimmed(env.BEDROCK_OPENAI_REGION) || trimmed(env.AWS_REGION);
  if (!region) {
    throw new Error("Bedrock OpenAI is not configured: BEDROCK_OPENAI_REGION or AWS_REGION is missing.");
  }

  return `https://bedrock-mantle.${region}.api.aws/openai/v1`;
}

export function bedrockOpenAiEndpoint(path: "models" | "responses") {
  return `${bedrockOpenAiApiRoot()}/${path}`;
}

export async function bedrockOpenAiApiKey(params: { required?: boolean } = {}) {
  const apiKey = await getBedrockOpenAiApiKey({ required: params.required });
  if (!apiKey && params.required) {
    throw new Error("Bedrock OpenAI is not configured: BEDROCK_OPENAI_API_KEY is missing.");
  }

  return apiKey;
}

export async function listBedrockOpenAiModels() {
  const apiKey = await bedrockOpenAiApiKey({ required: true });
  const response = await fetch(bedrockOpenAiEndpoint("models"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bedrock OpenAI model list failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return await response.json() as {
    data?: Array<{ id?: string; object?: string; owned_by?: string }>;
  };
}

export async function createBedrockOpenAiResponse(params: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  textFormat?: BedrockOpenAiTextFormat;
}) {
  const apiKey = await bedrockOpenAiApiKey({ required: true });
  const response = await fetch(bedrockOpenAiEndpoint("responses"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: params.systemPrompt,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: params.userPrompt,
            },
          ],
        },
      ],
      ...(params.textFormat ? { text: { format: params.textFormat } } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bedrock OpenAI response failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return await response.json() as BedrockOpenAiResponsePayload;
}
