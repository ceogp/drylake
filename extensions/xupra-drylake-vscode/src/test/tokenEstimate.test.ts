import { describe, expect, it } from "vitest";

import { estimateTokens, formatEstimatedTokens } from "../utils/tokenEstimate";

describe("token estimates", () => {
  it("estimates prompt tokens from text for any agent handoff", () => {
    const estimate = estimateTokens("abcd efgh", "runner-assignment");

    expect(estimate).toMatchObject({
      characters: 9,
      estimatedTokens: 3,
      method: "approximate",
      scope: "runner-assignment",
    });
    expect(estimate.updatedAt).toEqual(expect.any(String));
  });

  it("formats short and large token estimates for compact UI labels", () => {
    expect(formatEstimatedTokens(0)).toBe("~0 tokens");
    expect(formatEstimatedTokens(240)).toBe("~240 tokens");
    expect(formatEstimatedTokens(1_250)).toBe("~1.3k tokens");
    expect(formatEstimatedTokens(1_000_000)).toBe("~1m tokens");
  });
});
