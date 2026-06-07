import { env } from "@/lib/env";
import { getBedrockOpenAiApiKey, getKimiApiKey, getOpenAiApiKey } from "@/lib/security/runtime-secrets";
import { generateAiText } from "@/lib/services/ai-text";
import { canonicalizationModel } from "@/lib/services/ai-model-selection";

export type AssistedNormalization = {
  summary: string;
  instructions: string;
  tools: string[];
  skills: Array<{
    name: string;
    description: string;
    body: string;
  }>;
  subagents: Array<{
    name: string;
    description: string;
    instructions: string;
    tools: string[];
    modelHint: string;
    permissionMode: string | null;
  }>;
  promptFragments: Array<{
    name: string;
    body: string;
  }>;
  warnings: string[];
  confidence: number;
};

const systemPrompt =
  "You extract transferable agent-package information from ambiguous source files. Produce compact, conservative canonical records. Preserve uncertainty in warnings instead of inventing structure. Return portable instructions, skills, subagents, prompt fragments, and tools only when clearly supported by the source.";

const assistedSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    instructions: { type: "string" },
    tools: {
      type: "array",
      items: { type: "string" },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          body: { type: "string" },
        },
        required: ["name", "description", "body"],
      },
    },
    subagents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          instructions: { type: "string" },
          tools: {
            type: "array",
            items: { type: "string" },
          },
          modelHint: { type: "string" },
          permissionMode: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
        },
        required: [
          "name",
          "description",
          "instructions",
          "tools",
          "modelHint",
          "permissionMode",
        ],
      },
    },
    promptFragments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          body: { type: "string" },
        },
        required: ["name", "body"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    confidence: { type: "number" },
  },
  required: [
    "summary",
    "instructions",
    "tools",
    "skills",
    "subagents",
    "promptFragments",
    "warnings",
    "confidence",
  ],
};

export async function normalizeAmbiguousFilesWithAi(params: {
  files: Array<{
    logicalPath: string;
    content: string;
  }>;
}) {
  if (env.AI_PROVIDER === "kimi") {
    return normalizeWithKimi(params);
  }

  return normalizeWithResponsesProvider(params);
}

async function normalizeWithResponsesProvider(params: {
  files: Array<{
    logicalPath: string;
    content: string;
  }>;
}) {
  const apiKey = env.AI_PROVIDER === "bedrock_openai"
    ? await getBedrockOpenAiApiKey()
    : await getOpenAiApiKey();
  if (!apiKey) {
    return null;
  }

  const rawText = await generateAiText({
    systemPrompt,
    userPrompt: JSON.stringify(params.files, null, 2),
    taskLabel: "agent package normalization",
    model: canonicalizationModel(),
    textFormat: {
      type: "json_schema",
      name: "agent_package_extraction",
      schema: assistedSchema,
      strict: true,
    },
  });

  return JSON.parse(rawText) as AssistedNormalization;
}

async function normalizeWithKimi(params: {
  files: Array<{
    logicalPath: string;
    content: string;
  }>;
}) {
  const apiKey = await getKimiApiKey();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${env.KIMI_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.KIMI_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(params.files, null, 2),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "agent_package_extraction",
          schema: assistedSchema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kimi normalization failed: ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  const rawText =
    typeof content === "string"
      ? content
      : content?.find((item) => item.type === "text" || item.type === "output_text")?.text;

  if (!rawText) {
    throw new Error("Kimi normalization did not return structured text");
  }

  return JSON.parse(rawText) as AssistedNormalization;
}
