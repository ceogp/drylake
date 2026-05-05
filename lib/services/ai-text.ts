import { env } from "@/lib/env";

type GenerateTextParams = {
  systemPrompt: string;
  userPrompt: string;
  taskLabel: string;
};

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

function extractChatText(payload: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}) {
  const content = payload.choices?.[0]?.message?.content;

  return typeof content === "string"
    ? content
    : content?.find((item) => item.type === "text" || item.type === "output_text")?.text;
}

function extractAnthropicText(payload: {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}) {
  return payload.content?.find((item) => item.type === "text")?.text;
}

async function generateWithOpenAi(params: GenerateTextParams) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Xupra AI is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
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
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xupra AI ${params.taskLabel} failed: ${errorText}`);
  }

  const payload = (await response.json()) as Parameters<typeof extractOpenAiText>[0];
  return extractOpenAiText(payload);
}

async function generateWithKimi(params: GenerateTextParams) {
  if (!env.KIMI_API_KEY) {
    throw new Error("Xupra AI is not configured.");
  }

  const response = await fetch(`${env.KIMI_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.KIMI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.KIMI_MODEL,
      messages: [
        {
          role: "system",
          content: params.systemPrompt,
        },
        {
          role: "user",
          content: params.userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xupra AI ${params.taskLabel} failed: ${errorText}`);
  }

  const payload = (await response.json()) as Parameters<typeof extractChatText>[0];
  return extractChatText(payload);
}

async function generateWithAnthropic(params: GenerateTextParams) {
  const apiKey = env.ANTHROPIC_API_KEY ?? env.CLAUDE_API_KEY ?? env.claudetoken;

  if (!apiKey) {
    throw new Error("Xupra AI is not configured.");
  }

  const response = await fetch(`${env.ANTHROPIC_BASE_URL.replace(/\/+$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4000,
      system: params.systemPrompt,
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
    throw new Error(`Xupra AI ${params.taskLabel} failed: ${errorText}`);
  }

  const payload = (await response.json()) as Parameters<typeof extractAnthropicText>[0];
  return extractAnthropicText(payload);
}

export async function generateAiText(params: GenerateTextParams) {
  const rawText =
    env.AI_PROVIDER === "anthropic"
      ? await generateWithAnthropic(params)
      : env.AI_PROVIDER === "kimi"
        ? await generateWithKimi(params)
        : await generateWithOpenAi(params);

  if (!rawText?.trim()) {
    throw new Error(`Xupra AI ${params.taskLabel} returned an empty response.`);
  }

  return rawText;
}
