import yaml from "js-yaml";

import { normalizeXu } from "./normalizeXu";
import { validateXu } from "./validateXu";
import type { ApplicationBuildRunbook, XuValidationResult } from "./types";

export type ParseXuResult = {
  runbook: ApplicationBuildRunbook | null;
  validation: XuValidationResult;
};

export function parseXu(content: string): ParseXuResult {
  try {
    const parsed = yaml.load(content);
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

