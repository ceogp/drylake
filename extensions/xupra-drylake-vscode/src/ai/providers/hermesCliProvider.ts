import * as childProcess from "node:child_process";
import { constants as fsConstants } from "node:fs";
import * as fs from "node:fs/promises";
import { promisify } from "node:util";
import type * as vscode from "vscode";

import { parseAiRunbookResponse } from "../parseAiRunbookResponse";
import { buildDraftRunbookPrompt } from "../prompts/buildDraftRunbookPrompt";
import { generatePhasePlanPrompt } from "../prompts/generatePhasePlanPrompt";
import { refineArchitecturePrompt } from "../prompts/refineArchitecturePrompt";
import { refinePurposePrompt } from "../prompts/refinePurposePrompt";
import type {
  DryLakeAiProvider,
  GenerateDraftRunbookInput,
  GenerateDraftRunbookResult,
  PlanningChatInput,
  PlanningChatResult,
} from "../DryLakeAiProvider";

const execFile = promisify(childProcess.execFile);
const DEFAULT_TIMEOUT_SECONDS = 300;
const DEFAULT_MAX_OUTPUT_BYTES = 1_500_000;

function isWindows() {
  return process.platform === "win32";
}

function pathLikeCommand(command: string) {
  return command.includes("/") || command.includes("\\") || /^[A-Za-z]:[\\/]/.test(command);
}

function configuredExecutable(configuration: vscode.WorkspaceConfiguration) {
  const configured = configuration.get<string>("agents.hermes.command", "hermes");
  const trimmed = typeof configured === "string" ? configured.trim() : "";
  return trimmed || "hermes";
}

function timeoutMs(configuration: vscode.WorkspaceConfiguration) {
  const value = Number(configuration.get<number>("hermes.planningTimeoutSeconds", DEFAULT_TIMEOUT_SECONDS));
  const seconds = Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_SECONDS;
  return Math.max(15, Math.min(900, seconds)) * 1000;
}

function maxOutputBytes(configuration: vscode.WorkspaceConfiguration) {
  const value = Number(configuration.get<number>("hermes.maxOutputBytes", DEFAULT_MAX_OUTPUT_BYTES));
  return Number.isFinite(value) && value > 0 ? Math.max(100_000, Math.min(10_000_000, value)) : DEFAULT_MAX_OUTPUT_BYTES;
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

function execStdout(result: unknown) {
  if (typeof result === "string" || Buffer.isBuffer(result)) {
    return String(result);
  }

  if (result && typeof result === "object" && "stdout" in result) {
    return String((result as { stdout?: unknown }).stdout ?? "");
  }

  return "";
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

export class HermesCliProvider implements DryLakeAiProvider {
  readonly id = "hermes-agent";
  readonly label = "Hermes Agent CLI";

  constructor(private readonly configuration: vscode.WorkspaceConfiguration) {}

  private executable() {
    return configuredExecutable(this.configuration);
  }

  async isAvailable() {
    const command = this.executable();

    if (pathLikeCommand(command)) {
      try {
        await fs.access(command, isWindows() ? fsConstants.F_OK : fsConstants.X_OK);
        return { available: true };
      } catch {
        return {
          available: false,
          reason: `Hermes command does not exist or is not executable: ${command}`,
        };
      }
    }

    try {
      await execFile(isWindows() ? "where" : "which", [command], { timeout: 5_000 });
      return { available: true };
    } catch {
      return {
        available: false,
        reason: `The command \`${command}\` was not found in VS Code's PATH. Run \`hermes model\` after installing Hermes, or configure drylake.agents.hermes.command.`,
      };
    }
  }

  private async runPrompt(prompt: string): Promise<{ content?: string; error?: string }> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { error: availability.reason ?? "Hermes Agent CLI is unavailable." };
    }

    const command = this.executable();
    const args = ["-z", prompt, "--ignore-rules", "--toolsets", "safe"];

    try {
      const result = await execFile(command, args, {
        timeout: timeoutMs(this.configuration),
        maxBuffer: maxOutputBytes(this.configuration),
        windowsHide: true,
      });
      const content = execStdout(result).trim();
      if (!content) {
        return { error: "Hermes Agent CLI returned empty output." };
      }

      return { content };
    } catch (error) {
      if (error && typeof error === "object") {
        const record = error as { code?: unknown; signal?: unknown; killed?: unknown; stderr?: unknown; stdout?: unknown; message?: unknown };
        const stderr = String(record.stderr ?? "").trim();
        const stdout = String(record.stdout ?? "").trim();
        const detail = stderr || stdout || String(record.message ?? "");

        if (record.killed || record.signal === "SIGTERM") {
          return { error: `Hermes Agent CLI timed out after ${timeoutMs(this.configuration) / 1000} seconds.` };
        }

        return {
          error: detail
            ? `Hermes Agent CLI failed: ${detail}`
            : `Hermes Agent CLI failed with code ${String(record.code ?? "unknown")}.`,
        };
      }

      return { error: "Hermes Agent CLI failed." };
    }
  }

  private async runRunbookPrompt(prompt: string): Promise<GenerateDraftRunbookResult> {
    const result = await this.runPrompt(prompt);
    if (!result.content) {
      return { message: result.error ?? "Hermes Agent CLI did not return a plan." };
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
    const result = await this.runPrompt(planningChatPrompt(input));
    if (!result.content) {
      return { error: result.error ?? "Hermes Agent CLI did not return a planning chat response." };
    }

    const parsed = parseRunbook(result.content, this.label);
    if (!parsed.runbook) {
      return { error: parsed.message ?? "Hermes Agent CLI returned invalid .xu." };
    }

    return {
      reply: "Hermes Agent CLI returned an updated DryLake plan.",
      runbook: parsed.runbook,
    };
  }
}
