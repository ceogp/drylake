export type TokenEstimateScope = "workspace" | "phase" | "runner-task" | "runner-assignment";

export type TokenEstimate = {
  characters: number;
  estimatedTokens: number;
  method: "approximate";
  scope: TokenEstimateScope;
  updatedAt: string;
};

export function estimateTokens(text: string, scope: TokenEstimateScope = "phase"): TokenEstimate {
  const characters = text.length;
  const estimatedTokens = characters === 0 ? 0 : Math.max(1, Math.ceil(characters / 4));

  return {
    characters,
    estimatedTokens,
    method: "approximate",
    scope,
    updatedAt: new Date().toISOString(),
  };
}

function trimTrailingZero(value: string) {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

export function formatEstimatedTokens(estimate: Pick<TokenEstimate, "estimatedTokens"> | number) {
  const tokens = typeof estimate === "number" ? estimate : estimate.estimatedTokens;

  if (tokens >= 1_000_000) {
    return `~${trimTrailingZero((tokens / 1_000_000).toFixed(1))}m tokens`;
  }

  if (tokens >= 1_000) {
    return `~${trimTrailingZero((tokens / 1_000).toFixed(1))}k tokens`;
  }

  return `~${tokens} tokens`;
}
