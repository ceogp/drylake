import yaml from "js-yaml";

import { env } from "@/lib/env";

export type GeneratedSkill = {
  name: string;
  description: string;
  targetPlatform: string;
  content: string;
};

type GenerateSkillParams = {
  name: string;
  description: string;
  targetPlatform: string;
  context?: string;
};

const skillGenerationSystemPrompt =
  "You are an expert at writing reusable AI agent skills. Generate a well-structured SKILL.md file based on the provided metadata. The skill should be practical, clear, and immediately useful. Return only the SKILL.md markdown. Do not mention model names, provider names, or implementation details about the generator.";

const providerNamePattern =
  /\b(?:Kimi|Moonshot|OpenAI|ChatGPT|GPT(?:[-\w.]+)?)\b/gi;

function platformDescription(targetPlatform: string) {
  switch (targetPlatform) {
    case "claude_code":
      return "Claude Code SKILL.md";
    case "codex":
      return "Codex SKILL.md";
    case "cursor":
      return "Cursor SKILL.md";
    case "claude_agents":
      return "Claude Agents reusable skill guidance";
    default:
      return targetPlatform;
  }
}

function buildSkillPrompt(params: GenerateSkillParams) {
  const lines = [
    "Generate a complete SKILL.md file for this skill.",
    "",
    `Name: ${params.name}`,
    `Description: ${params.description}`,
    `Target platform: ${platformDescription(params.targetPlatform)} (${params.targetPlatform})`,
  ];

  if (params.context?.trim()) {
    lines.push("", "Additional context:", params.context.trim());
  }

  lines.push(
    "",
    "Requirements:",
    "- Start with YAML frontmatter containing name, description, and targetPlatform.",
    "- Follow the frontmatter with concise markdown instructions a human or AI agent can apply immediately.",
    "- Include practical trigger conditions, workflow steps, and quality checks when useful.",
    "- Do not include markdown fences around the file.",
    "- Do not mention the generator, model, or provider used to create this content.",
  );

  return lines.join("\n");
}

function unwrapMarkdownFence(content: string) {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function stripFrontmatter(content: string) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return match?.[1]?.trim() ?? content.trim();
}

function scrubProviderNames(content: string) {
  return content.replace(providerNamePattern, "AI provider");
}

function buildFrontmatter(params: GenerateSkillParams) {
  return yaml
    .dump(
      {
        name: params.name,
        description: params.description,
        targetPlatform: params.targetPlatform,
      },
      {
        lineWidth: 120,
        noCompatMode: true,
        quotingType: '"',
      },
    )
    .trim();
}

function normalizeSkillMarkdown(content: string, params: GenerateSkillParams) {
  const body = scrubProviderNames(stripFrontmatter(unwrapMarkdownFence(content))).trim();
  const normalizedBody =
    body.length > 0
      ? body
      : `# ${params.name}\n\n${params.description}\n\nUse this skill when the task matches the description above.`;

  return ["---", buildFrontmatter(params), "---", "", normalizedBody].join("\n");
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

function extractKimiText(payload: {
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

async function generateSkillWithOpenAi(params: GenerateSkillParams) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI skill generation is not configured.");
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
              text: skillGenerationSystemPrompt,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildSkillPrompt(params),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI skill generation failed: ${errorText}`);
  }

  const payload = (await response.json()) as Parameters<typeof extractOpenAiText>[0];
  const rawText = extractOpenAiText(payload);

  if (!rawText?.trim()) {
    throw new Error("OpenAI skill generation returned an empty response.");
  }

  return rawText;
}

async function generateSkillWithKimi(params: GenerateSkillParams) {
  if (!env.KIMI_API_KEY) {
    throw new Error("Kimi skill generation is not configured.");
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
          content: skillGenerationSystemPrompt,
        },
        {
          role: "user",
          content: buildSkillPrompt(params),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kimi skill generation failed: ${errorText}`);
  }

  const payload = (await response.json()) as Parameters<typeof extractKimiText>[0];
  const rawText = extractKimiText(payload);

  if (!rawText?.trim()) {
    throw new Error("Kimi skill generation returned an empty response.");
  }

  return rawText;
}

export async function generateSkillWithAi(params: GenerateSkillParams): Promise<GeneratedSkill> {
  const rawContent =
    env.AI_PROVIDER === "kimi"
      ? await generateSkillWithKimi(params)
      : await generateSkillWithOpenAi(params);

  return {
    name: params.name,
    description: params.description,
    targetPlatform: params.targetPlatform,
    content: normalizeSkillMarkdown(rawContent, params),
  };
}
