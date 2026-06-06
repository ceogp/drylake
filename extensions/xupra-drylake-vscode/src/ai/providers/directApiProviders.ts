import type * as vscode from "vscode";

import { parseAiRunbookResponse } from "../parseAiRunbookResponse";
import { buildDraftRunbookPrompt } from "../prompts/buildDraftRunbookPrompt";
import { generatePhasePlanPrompt } from "../prompts/generatePhasePlanPrompt";
import { refineArchitecturePrompt } from "../prompts/refineArchitecturePrompt";
import { refinePurposePrompt } from "../prompts/refinePurposePrompt";
import type {
  ClarifyIntentInput,
  ClarifyIntentResult,
  DryLakeAiProvider,
  DryLakeProviderId,
  DryLakeProviderLabel,
  GenerateDraftRunbookInput,
  GenerateDraftRunbookResult,
  PlanningChatInput,
  PlanningChatResult,
} from "../DryLakeAiProvider";

type DirectProviderKind = "openai" | "claude" | "databricks";

type DirectProviderDefinition = {
  kind: DirectProviderKind;
  id: DryLakeProviderId;
  label: DryLakeProviderLabel;
  apiKeyEnvKey: string;
  defaultApiKeyEnvVar: string;
  modelKey?: string;
  defaultModel?: string;
  baseUrlKey?: string;
  defaultBaseUrl?: string;
  endpointNameKey?: string;
  maxTokensKey: string;
  defaultMaxTokens: number;
};

type DirectSecretReader = (providerId: DryLakeProviderId) => Promise<string | undefined>;

const DEFAULT_TIMEOUT_SECONDS = 120;

function configString(configuration: vscode.WorkspaceConfiguration, key: string, fallback: string) {
  const value = configuration.get<string>(key, fallback);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function configNumber(configuration: vscode.WorkspaceConfiguration, key: string, fallback: number, min: number, max: number) {
  const value = Number(configuration.get<number>(key, fallback));
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function envValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function firstText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (Array.isArray(value)) {
    const parts = value.map(firstText).filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join("\n") : undefined;
  }

  const record = jsonRecord(value);
  if (!record) {
    return undefined;
  }

  return firstText(record.text) ??
    firstText(record.content) ??
    firstText(record.output_text) ??
    firstText(record.message);
}

function extractOpenAiText(payload: unknown): string | undefined {
  const record = jsonRecord(payload);
  if (!record) {
    return undefined;
  }

  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text;
  }

  return firstText(record.output);
}

function extractAnthropicText(payload: unknown): string | undefined {
  return firstText(jsonRecord(payload)?.content);
}

function extractDatabricksText(payload: unknown): string | undefined {
  const record = jsonRecord(payload);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const first = jsonRecord(choices[0]);
  return firstText(first?.message) ?? firstText(first?.text);
}

function extractError(payload: unknown, fallback: string) {
  const record = jsonRecord(payload);
  const error = jsonRecord(record?.error);
  const message = firstText(error?.message) ?? firstText(record?.message);
  return message ? `${fallback}: ${message}` : fallback;
}

function parseJsonArrayOfStrings(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 4);
    }
  } catch {
    return cleaned
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*\d.)\s]+/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 4);
  }

  return [];
}

function parseRunbook(content: string, providerLabel: string): GenerateDraftRunbookResult {
  const parsed = parseAiRunbookResponse(content);
  if (!parsed.runbook || !parsed.validation.ok) {
    return {
      message: `${providerLabel} returned invalid .xu: ${parsed.validation.diagnostics
        .map((item) => item.message)
        .join("; ")}`,
    };
  }

  return { runbook: parsed.runbook };
}

function planningChatPrompt(input: PlanningChatInput) {
  return [
    buildDraftRunbookPrompt(input),
    "",
    "You are revising an existing DryLake .xu runbook from planning chat.",
    "Return only YAML for the full updated runbook. Do not include explanation.",
    "",
    "Current runbook JSON:",
    JSON.stringify(input.currentRunbook ?? null, null, 2),
    "",
    "Planning chat transcript:",
    input.chatTranscript,
  ].join("\n");
}

function clarifyPrompt(input: ClarifyIntentInput) {
  return [
    "You help scope a DryLake build session.",
    "Return between 1 and 4 short clarifying questions about the user's prompt.",
    "Return ONLY a JSON array of strings. No prose, no Markdown fences.",
    "",
    `Mode: ${input.mode}`,
    "",
    "User prompt:",
    input.prompt,
    "",
    "Workspace summary:",
    input.workspaceSummary || "No workspace summary available.",
  ].join("\n");
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { text };
  }
}

export class DirectApiPlanningProvider implements DryLakeAiProvider {
  readonly id: DryLakeProviderId;
  readonly label: DryLakeProviderLabel;

  constructor(
    private readonly configuration: vscode.WorkspaceConfiguration,
    private readonly definition: DirectProviderDefinition,
    private readonly readSecret?: DirectSecretReader,
  ) {
    this.id = definition.id;
    this.label = definition.label;
  }

  private apiKeyEnvVar() {
    return configString(this.configuration, this.definition.apiKeyEnvKey, this.definition.defaultApiKeyEnvVar);
  }

  private async apiKey() {
    return (await this.readSecret?.(this.id))?.trim() || envValue(this.apiKeyEnvVar());
  }

  private model() {
    if (!this.definition.modelKey) {
      return "";
    }

    return configString(this.configuration, this.definition.modelKey, this.definition.defaultModel ?? "");
  }

  private baseUrl() {
    if (!this.definition.baseUrlKey) {
      return "";
    }

    return withoutTrailingSlash(configString(this.configuration, this.definition.baseUrlKey, this.definition.defaultBaseUrl ?? ""));
  }

  private endpointName() {
    return this.definition.endpointNameKey
      ? configString(this.configuration, this.definition.endpointNameKey, "")
      : "";
  }

  private maxTokens() {
    return configNumber(this.configuration, this.definition.maxTokensKey, this.definition.defaultMaxTokens, 512, 32000);
  }

  private timeoutMs() {
    return configNumber(this.configuration, "directApi.timeoutSeconds", DEFAULT_TIMEOUT_SECONDS, 15, 900) * 1000;
  }

  async isAvailable() {
    const envVar = this.apiKeyEnvVar();
    if (!(await this.apiKey())) {
      return {
        available: false,
        reason: `${this.label} requires an API key. Enter one when prompted, or set ${envVar} in the VS Code environment.`,
      };
    }

    if (this.definition.kind === "databricks") {
      if (!this.baseUrl()) {
        return { available: false, reason: "Databricks API requires drylake.databricks.workspaceUrl." };
      }
      if (!this.endpointName()) {
        return { available: false, reason: "Databricks API requires drylake.databricks.endpointName." };
      }
    }

    return { available: true };
  }

  async validateConnection() {
    const result = await this.complete("Reply with only OK.");
    if (!result.content?.trim()) {
      return {
        available: false,
        reason: result.error ?? `${this.label} returned empty output during connection test.`,
      };
    }

    return { available: true };
  }

  private async postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs());

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await readJson(response);

      if (!response.ok) {
        return {
          error: {
            message: extractError(payload, `${this.label} request failed (${response.status})`),
          },
        };
      }

      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { error: { message: `${this.label} request timed out after ${this.timeoutMs() / 1000} seconds.` } };
      }

      return {
        error: {
          message: error instanceof Error ? `${this.label} request failed: ${error.message}` : `${this.label} request failed.`,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async complete(prompt: string): Promise<{ content?: string; error?: string }> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { error: availability.reason ?? `${this.label} is unavailable.` };
    }

    if (this.definition.kind === "openai") {
      const apiKey = await this.apiKey();
      const payload = await this.postJson(
        `${this.baseUrl()}/responses`,
        { Authorization: `Bearer ${apiKey}` },
        {
          model: this.model(),
          input: prompt,
          max_output_tokens: this.maxTokens(),
        },
      );
      const error = jsonRecord(jsonRecord(payload)?.error);
      return error
        ? { error: firstText(error.message) ?? `${this.label} request failed.` }
        : { content: extractOpenAiText(payload) };
    }

    if (this.definition.kind === "claude") {
      const apiKey = await this.apiKey();
      const payload = await this.postJson(
        `${this.baseUrl()}/messages`,
        {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        {
          model: this.model(),
          max_tokens: this.maxTokens(),
          messages: [{ role: "user", content: prompt }],
        },
      );
      const error = jsonRecord(jsonRecord(payload)?.error);
      return error
        ? { error: firstText(error.message) ?? `${this.label} request failed.` }
        : { content: extractAnthropicText(payload) };
    }

    const apiKey = await this.apiKey();
    const payload = await this.postJson(
      `${this.baseUrl()}/serving-endpoints/${encodeURIComponent(this.endpointName())}/invocations`,
      { Authorization: `Bearer ${apiKey}` },
      {
        messages: [{ role: "user", content: prompt }],
        max_tokens: this.maxTokens(),
        temperature: 0.1,
      },
    );
    const error = jsonRecord(jsonRecord(payload)?.error);
    return error
      ? { error: firstText(error.message) ?? `${this.label} request failed.` }
      : { content: extractDatabricksText(payload) };
  }

  private async runRunbookPrompt(prompt: string): Promise<GenerateDraftRunbookResult> {
    const result = await this.complete(prompt);
    if (!result.content?.trim()) {
      return { message: result.error ?? `${this.label} returned empty output.` };
    }

    return parseRunbook(result.content, this.label);
  }

  generateDraftRunbook(input: GenerateDraftRunbookInput) {
    return this.runRunbookPrompt(buildDraftRunbookPrompt(input));
  }

  refinePurpose(input: GenerateDraftRunbookInput) {
    return this.runRunbookPrompt(refinePurposePrompt(input));
  }

  refineArchitecture(input: GenerateDraftRunbookInput) {
    return this.runRunbookPrompt(refineArchitecturePrompt(input));
  }

  generatePhasePlan(input: GenerateDraftRunbookInput) {
    return this.runRunbookPrompt(generatePhasePlanPrompt(input));
  }

  async planningChat(input: PlanningChatInput): Promise<PlanningChatResult> {
    const result = await this.complete(planningChatPrompt(input));
    if (!result.content?.trim()) {
      return { error: result.error ?? `${this.label} returned empty planning chat output.` };
    }

    const parsed = parseRunbook(result.content, this.label);
    if (!parsed.runbook) {
      return { error: parsed.message ?? `${this.label} returned invalid .xu.` };
    }

    return {
      reply: `${this.label} returned an updated DryLake plan.`,
      runbook: parsed.runbook,
    };
  }

  async clarifyIntent(input: ClarifyIntentInput): Promise<ClarifyIntentResult> {
    const result = await this.complete(clarifyPrompt(input));
    if (!result.content?.trim()) {
      return { message: result.error ?? `${this.label} returned empty clarification output.` };
    }

    return { questions: parseJsonArrayOfStrings(result.content) };
  }
}

export class OpenAiApiProvider extends DirectApiPlanningProvider {
  constructor(configuration: vscode.WorkspaceConfiguration, readSecret?: DirectSecretReader) {
    super(configuration, {
      kind: "openai",
      id: "openai-api",
      label: "OpenAI API",
      apiKeyEnvKey: "openai.apiKeyEnvVar",
      defaultApiKeyEnvVar: "OPENAI_API_KEY",
      modelKey: "openai.model",
      defaultModel: "gpt-5",
      baseUrlKey: "openai.baseUrl",
      defaultBaseUrl: "https://api.openai.com/v1",
      maxTokensKey: "openai.maxOutputTokens",
      defaultMaxTokens: 8000,
    }, readSecret);
  }
}

export class ClaudeApiProvider extends DirectApiPlanningProvider {
  constructor(configuration: vscode.WorkspaceConfiguration, readSecret?: DirectSecretReader) {
    super(configuration, {
      kind: "claude",
      id: "claude-api",
      label: "Claude API",
      apiKeyEnvKey: "claude.apiKeyEnvVar",
      defaultApiKeyEnvVar: "ANTHROPIC_API_KEY",
      modelKey: "claude.model",
      defaultModel: "claude-sonnet-4-20250514",
      baseUrlKey: "claude.baseUrl",
      defaultBaseUrl: "https://api.anthropic.com/v1",
      maxTokensKey: "claude.maxOutputTokens",
      defaultMaxTokens: 8000,
    }, readSecret);
  }
}

export class DatabricksApiProvider extends DirectApiPlanningProvider {
  constructor(configuration: vscode.WorkspaceConfiguration, readSecret?: DirectSecretReader) {
    super(configuration, {
      kind: "databricks",
      id: "databricks-api",
      label: "Databricks API",
      apiKeyEnvKey: "databricks.tokenEnvVar",
      defaultApiKeyEnvVar: "DATABRICKS_TOKEN",
      baseUrlKey: "databricks.workspaceUrl",
      defaultBaseUrl: "",
      endpointNameKey: "databricks.endpointName",
      maxTokensKey: "databricks.maxOutputTokens",
      defaultMaxTokens: 8000,
    }, readSecret);
  }
}
