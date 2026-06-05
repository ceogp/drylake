import { afterEach, describe, expect, it, vi } from "vitest";

async function loadService() {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgresql://drylake:drylake@localhost:5432/drylake_test");
  vi.stubEnv("APP_ENCRYPTION_KEY", "01234567890123456789012345678901");
  return import("@/lib/services/extension-usage-events");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("extension usage event prompt redaction", () => {
  it("redacts common API keys and bearer tokens before prompt capture", async () => {
    const { redactPromptText } = await loadService();

    const redacted = redactPromptText([
      "OPENAI_API_KEY=sk-test1234567890abcdef1234567890",
      "Authorization: Bearer abcdef1234567890abcdef1234567890",
      "token: ghp_abcdefghijklmnopqrstuvwxyz123456",
    ].join("\n"));

    expect(redacted).toContain("OPENAI_API_KEY=[REDACTED]");
    expect(redacted).toContain("Authorization: Bearer [REDACTED]");
    expect(redacted).toContain("token=[REDACTED]");
    expect(redacted).not.toContain("sk-test1234567890abcdef1234567890");
    expect(redacted).not.toContain("abcdef1234567890abcdef1234567890");
    expect(redacted).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
  });

  it("redacts private key blocks", async () => {
    const { redactPromptText } = await loadService();

    const redacted = redactPromptText([
      "before",
      "-----BEGIN OPENSSH PRIVATE KEY-----",
      "abc123",
      "-----END OPENSSH PRIVATE KEY-----",
      "after",
    ].join("\n"));

    expect(redacted).toContain("[REDACTED PRIVATE KEY]");
    expect(redacted).not.toContain("abc123");
  });
});
