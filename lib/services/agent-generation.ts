import yaml from "js-yaml";

import { generateAiText } from "@/lib/services/ai-text";

export type GeneratedAgent = {
  name: string;
  description: string;
  targetPlatform: string;
  content: string;
};

type GenerateAgentParams = {
  name: string;
  description: string;
  targetPlatform: string;
  context?: string;
};

const agentGenerationSystemPrompt =
  "You are an expert at writing practical AI coding agents for software teams. Generate one complete target-specific agent file based on the provided metadata. Return only the file content. Do not include markdown fences, commentary, model names, provider names, or implementation details about the generator.";

const providerNamePattern =
  /\b(?:Kimi|Moonshot|OpenAI|ChatGPT|GPT(?:[-\w.]+)?|Anthropic|Claude\s+Sonnet|Sonnet\s*[-\w.]*)\b/gi;

function platformDescription(targetPlatform: string) {
  switch (targetPlatform) {
    case "claude_code":
      return "Claude Code agent markdown in .claude/agents/<slug>.md";
    case "claude_agents":
      return "Claude agent markdown in .claude/agents/<slug>.md";
    case "codex":
      return "Codex custom agent TOML in .codex/agents/<slug>.toml";
    case "cursor":
      return "Cursor rule/agent MDC in .cursor/rules/<slug>.mdc";
    default:
      return "portable markdown agent file";
  }
}

function buildAgentPrompt(params: GenerateAgentParams) {
  const lines = [
    "Generate one complete AI coding agent file.",
    "",
    `Agent name: ${params.name}`,
    `Purpose: ${params.description}`,
    `Target format: ${platformDescription(params.targetPlatform)} (${params.targetPlatform})`,
  ];

  if (params.context?.trim()) {
    lines.push("", "Company or codebase context:", params.context.trim());
  }

  lines.push(
    "",
    "Requirements:",
    "- Make the agent useful for real software engineering work.",
    "- Preserve the user's purpose and make the instructions clearer, stricter, and more actionable.",
    "- Include role, operating rules, workflow, validation expectations, and concise output expectations.",
    "- Keep the result target-specific and ready to save as the target file.",
    "- Do not mention the generator, model, or provider used to create the content.",
  );

  if (params.targetPlatform === "codex") {
    lines.push(
      "- Return valid TOML with name, description, tools, and developer_instructions.",
      "- Put the main agent instructions inside developer_instructions as a multiline string.",
    );
  } else if (params.targetPlatform === "cursor") {
    lines.push(
      "- Return an .mdc file with YAML frontmatter including description and alwaysApply.",
      "- Put the main agent guidance after the frontmatter.",
    );
  } else {
    lines.push(
      "- Return markdown with YAML frontmatter including name, description, targetPlatform, and tools.",
      "- Put the main agent guidance after the frontmatter.",
    );
  }

  return lines.join("\n");
}

function unwrapFence(content: string) {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:markdown|md|toml)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function scrubProviderNames(content: string) {
  return content.replace(providerNamePattern, "Xupra AI");
}

function escapeTomlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function stripMarkdownFrontmatter(content: string) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return match?.[1]?.trim() ?? content.trim();
}

function markdownFrontmatter(params: GenerateAgentParams) {
  return yaml
    .dump(
      {
        name: params.name,
        description: params.description,
        targetPlatform: params.targetPlatform,
        tools: [],
      },
      {
        lineWidth: 120,
        noCompatMode: true,
        quotingType: '"',
      },
    )
    .trim();
}

function normalizeMarkdownAgent(content: string, params: GenerateAgentParams) {
  const body = stripMarkdownFrontmatter(content).trim() || `# ${params.name}\n\n${params.description}`;
  return ["---", markdownFrontmatter(params), "---", "", body].join("\n");
}

function normalizeCursorAgent(content: string, params: GenerateAgentParams) {
  const cleaned = content.trim();

  if (cleaned.startsWith("---")) {
    return cleaned;
  }

  return [
    "---",
    yaml
      .dump(
        {
          description: params.description,
          alwaysApply: false,
        },
        {
          lineWidth: 120,
          noCompatMode: true,
          quotingType: '"',
        },
      )
      .trim(),
    "---",
    "",
    cleaned || `# ${params.name}\n\n${params.description}`,
  ].join("\n");
}

function normalizeCodexAgent(content: string, params: GenerateAgentParams) {
  const cleaned = content.trim();

  if (/^\s*name\s*=/.test(cleaned) && /\bdeveloper_instructions\s*=/.test(cleaned)) {
    return cleaned;
  }

  const body = cleaned || `# ${params.name}\n\n${params.description}`;

  return [
    `name = "${escapeTomlString(params.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agent")}"`,
    `description = "${escapeTomlString(params.description)}"`,
    "tools = []",
    'developer_instructions = """',
    body.replace(/"""/g, '\\"\\"\\"'),
    '"""',
  ].join("\n");
}

function normalizeAgentContent(rawContent: string, params: GenerateAgentParams) {
  const content = scrubProviderNames(unwrapFence(rawContent)).trim();

  switch (params.targetPlatform) {
    case "codex":
      return normalizeCodexAgent(content, params);
    case "cursor":
      return normalizeCursorAgent(content, params);
    case "claude_agents":
    case "claude_code":
    default:
      return normalizeMarkdownAgent(content, params);
  }
}

export async function generateAgentWithAi(params: GenerateAgentParams): Promise<GeneratedAgent> {
  const rawContent = await generateAiText({
    systemPrompt: agentGenerationSystemPrompt,
    userPrompt: buildAgentPrompt(params),
    taskLabel: "agent generation",
  });

  return {
    name: params.name,
    description: params.description,
    targetPlatform: params.targetPlatform,
    content: normalizeAgentContent(rawContent, params),
  };
}
