import { env } from "@/lib/env";
import { getOpenAiApiKey } from "@/lib/security/runtime-secrets";

type GenerateTextParams = {
  systemPrompt: string;
  userPrompt: string;
  taskLabel: string;
};

const XUPRA_AI_IDENTITY_PROMPT = [
  "You are Xupra AI.",
  "If asked what you are or who you are, identify yourself as Xupra AI.",
].join(" ");

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
  const apiKey = await getOpenAiApiKey({ required: true });
  if (!apiKey) {
    throw new Error("Xupra AI is not configured: OPENAI_API_KEY is missing.");
  }

  const model = env.OPENAI_MODEL?.trim();
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
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xupra AI ${params.taskLabel} failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const payload = (await response.json()) as Parameters<typeof extractOpenAiText>[0];
  return extractOpenAiText(payload);
}

export async function generateAiText(params: GenerateTextParams) {
  const rawText = await generateWithOpenAi(params);

  if (!rawText?.trim()) {
    throw new Error(`Xupra AI ${params.taskLabel} returned an empty response.`);
  }

  return rawText;
}
