import { env } from "@/lib/env";
import { getOpenAiApiKey } from "@/lib/security/runtime-secrets";

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

function newRequestId() {
  return `xupra-ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeOpenAiError(value: string) {
  return value.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").slice(0, 500);
}

function withXupraAiIdentity(systemPrompt: string) {
  return [XUPRA_AI_IDENTITY_PROMPT, systemPrompt].join("\n\n");
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
  const requestId = newRequestId();
  const apiKey = await getOpenAiApiKey({ required: true });
  if (!apiKey) {
    console.error("[xupra-ai] missing_api_key", {
      requestId,
      taskLabel: params.taskLabel,
    });
    throw new Error("Xupra AI is not configured: OPENAI_API_KEY is missing.");
  }

  const model = params.model?.trim() || env.OPENAI_MODEL?.trim();
  if (!model) {
    console.error("[xupra-ai] missing_model", {
      requestId,
      taskLabel: params.taskLabel,
    });
    throw new Error("Xupra AI is not configured: OPENAI_MODEL is missing.");
  }

  console.info("[xupra-ai] request_started", {
    requestId,
    taskLabel: params.taskLabel,
    model,
    hasTextFormat: Boolean(params.textFormat),
  });

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
    const errorText = sanitizeOpenAiError(await response.text());
    console.error("[xupra-ai] request_failed", {
      requestId,
      taskLabel: params.taskLabel,
      model,
      status: response.status,
      error: errorText,
    });
    throw new Error(`Xupra AI ${params.taskLabel} failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as Parameters<typeof extractOpenAiText>[0];
  const text = extractOpenAiText(payload);

  if (!text?.trim()) {
    console.error("[xupra-ai] empty_response", {
      requestId,
      taskLabel: params.taskLabel,
      model,
    });
    return text;
  }

  console.info("[xupra-ai] request_succeeded", {
    requestId,
    taskLabel: params.taskLabel,
    model,
    outputLength: text.length,
  });

  return text;
}

export async function generateAiText(params: GenerateTextParams) {
  const rawText = await generateWithOpenAi(params);

  if (!rawText?.trim()) {
    throw new Error(`Xupra AI ${params.taskLabel} returned an empty response.`);
  }

  return rawText;
}
