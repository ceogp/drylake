import { env } from "@/lib/env";
import { getAnthropicApiKey, getOpenAiApiKey } from "@/lib/security/runtime-secrets";

type GenerateTextParams = {
  systemPrompt: string;
  userPrompt: string;
  taskLabel: string;
  model?: string;
  textFormat?: {
    type: "json_schema";
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
};

const XUPRA_AI_IDENTITY_PROMPT = [
  "You are Xupra AI.",
  "If asked what you are or who you are, identify yourself as Xupra AI.",
].join(" ");

function withXupraAiIdentity(systemPrompt: string) {
  return [XUPRA_AI_IDENTITY_PROMPT, systemPrompt].join("\n\n");
}

function withJsonSchemaInstruction(systemPrompt: string, textFormat: GenerateTextParams["textFormat"]) {
  if (!textFormat) {
    return systemPrompt;
  }

  return [
    systemPrompt,
    "Return only valid JSON. Do not include Markdown fences, commentary, or any text outside the JSON object.",
    `The JSON must match this schema named ${textFormat.name}:`,
    JSON.stringify(textFormat.schema),
  ].join("\n\n");
}

function extractOpenAiText(payload: {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}) {
  return (
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text
  );
}

async function generateWithOpenAi(params: GenerateTextParams) {
  const apiKey = await getOpenAiApiKey({ required: true });
  if (!apiKey) {
    throw new Error("Xupra AI is not configured: OPENAI_API_KEY is missing.");
  }

  const model = params.model?.trim() || env.OPENAI_MODEL?.trim();
  if (!model) {
    throw new Error("Xupra AI is not configured: OPENAI_MODEL is missing.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: withXupraAiIdentity(params.systemPrompt),
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
    throw new Error(`Xupra AI ${params.taskLabel} failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const payload = (await response.json()) as Parameters<typeof extractOpenAiText>[0];
  return extractOpenAiText(payload);
}

function extractAnthropicText(payload: {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}) {
  return payload.content
    ?.filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("")
    .trim();
}

function anthropicMessagesEndpoint() {
  const baseUrl = env.ANTHROPIC_BASE_URL.trim().replace(/\/+$/, "");
  return baseUrl.endsWith("/v1") ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;
}

async function generateWithAnthropic(params: GenerateTextParams) {
  const apiKey = await getAnthropicApiKey({ required: true });
  if (!apiKey) {
    throw new Error("Xupra AI is not configured: ANTHROPIC_API_KEY is missing.");
  }

  const model = params.model?.trim() || env.ANTHROPIC_MODEL?.trim();
  if (!model) {
    throw new Error("Xupra AI is not configured: ANTHROPIC_MODEL is missing.");
  }

  const response = await fetch(anthropicMessagesEndpoint(), {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: withXupraAiIdentity(withJsonSchemaInstruction(params.systemPrompt, params.textFormat)),
      messages: [
        {
          role: "user",
          content: params.userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xupra AI ${params.taskLabel} failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const payload = await response.json() as Parameters<typeof extractAnthropicText>[0];
  return extractAnthropicText(payload);
}

export async function generateAiText(params: GenerateTextParams) {
  const rawText = env.AI_PROVIDER === "anthropic"
    ? await generateWithAnthropic(params)
    : await generateWithOpenAi(params);

  if (!rawText?.trim()) {
    throw new Error(`Xupra AI ${params.taskLabel} returned an empty response.`);
  }

  return rawText;
}
