import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getAppEncryptionSecret } from "@/lib/security/runtime-secrets";

type EncryptedPayload = {
  alg: "aes-256-gcm";
  keyVersion: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

async function getKeyMaterial() {
  const secret = await getAppEncryptionSecret();
  return createHash("sha256").update(secret).digest();
}

export async function encryptSecret(plaintext: string, keyVersion = "local-v1") {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", await getKeyMaterial(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    alg: "aes-256-gcm",
    keyVersion,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };

  return {
    ciphertext: JSON.stringify(payload),
    keyVersion,
  };
}

export async function decryptSecret(serialized: string) {
  const payload = JSON.parse(serialized) as EncryptedPayload;

  if (payload.alg !== "aes-256-gcm") {
    throw new Error("Unsupported encryption algorithm");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    await getKeyMaterial(),
    Buffer.from(payload.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);

  return {
    plaintext: plaintext.toString("utf8"),
    keyVersion: payload.keyVersion,
  };
}
