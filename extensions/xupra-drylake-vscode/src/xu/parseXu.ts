import yaml from "js-yaml";

import { normalizeXu } from "./normalizeXu";
import { validateXu } from "./validateXu";
import type { ApplicationBuildRunbook, XuValidationResult } from "./types";

export type ParseXuResult = {
  runbook: ApplicationBuildRunbook | null;
  validation: XuValidationResult;
};

function invalid(message: string, path = "$"): ParseXuResult {
  return {
    runbook: null,
    validation: {
      ok: false,
      diagnostics: [{ path, message }],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseXu(content: string): ParseXuResult {
  try {
    const parsed = yaml.load(content);
    if (!isRecord(parsed)) {
      return invalid("Runbook YAML must be an object.");
    }

    if (parsed.xu !== 1) {
      return invalid("Runbook must declare xu: 1.", "xu");
    }

    if (parsed.kind !== "ApplicationBuildRunbook") {
      return invalid("Runbook kind must be ApplicationBuildRunbook.", "kind");
    }

    if (!Array.isArray(parsed.phases) || parsed.phases.length === 0) {
      return invalid("Runbook must include generated phases.", "phases");
    }

    const runbook = normalizeXu(parsed);
    return {
      runbook,
      validation: validateXu(runbook),
    };
  } catch (error) {
    return {
      runbook: null,
      validation: {
        ok: false,
        diagnostics: [
          {
            path: "$",
            message: error instanceof Error ? error.message : "Invalid .xu syntax.",
          },
        ],
      },
    };
  }
}

