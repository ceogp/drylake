import { env } from "@/lib/env";

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

  return normalizeWithOpenAi(params);
}

async function normalizeWithOpenAi(params: {
  files: Array<{
    logicalPath: string;
    content: string;
  }>;
}) {
  if (!env.OPENAI_API_KEY) {
    return null;
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
              text: systemPrompt,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(params.files, null, 2),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "agent_package_extraction",
          schema: assistedSchema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI normalization failed: ${errorText}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const rawText =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;

  if (!rawText) {
    throw new Error("OpenAI normalization did not return structured text");
  }

  return JSON.parse(rawText) as AssistedNormalization;
}

async function normalizeWithKimi(params: {
  files: Array<{
    logicalPath: string;
    content: string;
  }>;
}) {
  if (!env.KIMI_API_KEY) {
    return null;
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
