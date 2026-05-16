import yaml from "js-yaml";

import type { ApplicationBuildRunbook } from "./types";

export function renderXu(runbook: ApplicationBuildRunbook) {
  return yaml.dump(runbook, {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
    sortKeys: false,
  });
}

