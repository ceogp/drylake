import * as vscode from "vscode";

import { parseAiRunbookResponse } from "../parseAiRunbookResponse";
import { buildDraftRunbookPrompt } from "../prompts/buildDraftRunbookPrompt";
import { generatePhasePlanPrompt } from "../prompts/generatePhasePlanPrompt";
import { refineArchitecturePrompt } from "../prompts/refineArchitecturePrompt";
import { refinePurposePrompt } from "../prompts/refinePurposePrompt";
import type {
  ClarifyIntentInput,
  ClarifyIntentResult,
  DryLakeAiProvider,
  GenerateDraftRunbookInput,
  GenerateDraftRunbookResult,
  PlanningChatInput,
  PlanningChatResult,
} from "../DryLakeAiProvider";

async function readResponseText(response: vscode.LanguageModelChatResponse) {
  const parts: string[] = [];

  for await (const chunk of response.text) {
    parts.push(chunk);
  }

  return parts.join("");
}

export class VscodeLmProvider implements DryLakeAiProvider {
  readonly id = "user-ide-ai";
  readonly label = "User IDE AI";

  async isAvailable() {
    try {
      const models = await vscode.lm.selectChatModels();
      return models.length > 0
        ? { available: true }
        : { available: false, reason: "No editor AI model is available." };
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : "User IDE AI is unavailable.",
      };
    }
  }

  private async runPrompt(prompt: string): Promise<GenerateDraftRunbookResult> {
    const models = await vscode.lm.selectChatModels();
    const model = models[0];

    if (!model) {
      return { message: "User IDE AI is not available." };
    }

    const response = await model.sendRequest([
      vscode.LanguageModelChatMessage.User(prompt),
    ]);
    const text = await readResponseText(response);
    const parsed = parseAiRunbookResponse(text);

    if (!parsed.runbook || !parsed.validation.ok) {
      return {
        message: `User IDE AI returned invalid .xu: ${parsed.validation.diagnostics
          .map((item) => item.message)
          .join("; ")}`,
      };
    }

    return { runbook: parsed.runbook };
  }

  generateDraftRunbook(input: GenerateDraftRunbookInput) {
    return this.runPrompt(buildDraftRunbookPrompt(input));
  }

  refinePurpose(input: GenerateDraftRunbookInput) {
    return this.runPrompt(refinePurposePrompt(input));
  }

  refineArchitecture(input: GenerateDraftRunbookInput) {
    return this.runPrompt(refineArchitecturePrompt(input));
  }

  generatePhasePlan(input: GenerateDraftRunbookInput) {
    return this.runPrompt(generatePhasePlanPrompt(input));
  }

  async planningChat(input: PlanningChatInput): Promise<PlanningChatResult> {
    const models = await vscode.lm.selectChatModels();
    const model = models[0];

    if (!model) {
      return { error: "User IDE AI is not available." };
    }

    const prompt = [
      "You are Xupra AI inside the DryLake Planning Chat.",
      "Answer the user's latest message directly and concisely.",
      "Do not produce canned health-check replies. Do not claim the runbook changed unless you return one through the product flow.",
      "If the user asks what you are, identify yourself as Xupra AI.",
      "",
      `Mode: ${input.mode}`,
      "",
      "Original build-session prompt:",
      input.prompt,
      "",
      "Workspace summary:",
      input.workspaceSummary || "No workspace summary available.",
      "",
      "Planning chat transcript:",
      input.chatTranscript,
    ].join("\n");

    try {
      const response = await model.sendRequest([vscode.LanguageModelChatMessage.User(prompt)]);
      const reply = await readResponseText(response);
      return reply.trim() ? { reply } : { error: "User IDE AI returned an empty chat response." };
    } catch (error) {
      return {
        error: error instanceof Error
          ? `User IDE AI chat request failed: ${error.message}`
          : "User IDE AI chat request failed.",
      };
    }
  }

  async clarifyIntent(input: ClarifyIntentInput): Promise<ClarifyIntentResult> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { message: availability.reason };
    }

    const models = await vscode.lm.selectChatModels();
    const model = models[0];
    if (!model) {
      return { message: "User IDE AI is not available." };
    }

    const prompt = [
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

    try {
      const response = await model.sendRequest([vscode.LanguageModelChatMessage.User(prompt)]);
      const raw = await readResponseText(response);
      const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();

      let questions: string[] = [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          questions = parsed
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim())
            .slice(0, 4);
        }
      } catch {
        questions = trimmed
          .split(/\r?\n/)
          .map((line) => line.replace(/^\s*[-*\d.)\s]+/, "").trim())
          .filter((line) => line.length > 0)
          .slice(0, 4);
      }

      return { questions };
    } catch (error) {
      return {
        message: error instanceof Error
          ? `User IDE AI clarify request failed: ${error.message}`
          : "User IDE AI clarify request failed.",
      };
    }
  }
}

