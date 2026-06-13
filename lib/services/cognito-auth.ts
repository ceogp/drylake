import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import { env } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

const COGNITO_AUTH_STATE_COOKIE = "drylake_cognito_auth_state";
const COGNITO_AUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

type CognitoAuthMode = "sign-in" | "sign-up";

type CognitoAuthState = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  mode: CognitoAuthMode;
  createdAt: string;
};

type CognitoJwk = Record<string, unknown> & {
  kid: string;
  kty: string;
};

const jwksCache = new Map<string, { expiresAt: number; keys: CognitoJwk[] }>();

const tokenResponseSchema = z.object({
  access_token: z.string().optional(),
  expires_in: z.number().optional(),
  id_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
});

const idTokenPayloadSchema = z.object({
  aud: z.string(),
  auth_time: z.number().optional(),
  cognito_username: z.string().optional(),
  email: z.string().email(),
  email_verified: z.union([z.boolean(), z.string()]).optional(),
  exp: z.number(),
  iat: z.number(),
  iss: z.string(),
  name: z.string().optional(),
  nonce: z.string().optional(),
  picture: z.string().optional(),
  sub: z.string().min(1),
  token_use: z.string().optional(),
});

function randomBase64Url(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function sha256Base64Url(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function safeReturnTo(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw?.startsWith("/") || raw.startsWith("//")) {
    return "/workspace";
  }

  return raw;
}

function normalizeCognitoDomain(rawDomain: string) {
  const trimmed = rawDomain.trim().replace(/\/+$/, "");
  return trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

export function getCognitoConfig() {
  const missing = [
    !env.AWS_COGNITO_REGION ? "AWS_COGNITO_REGION" : null,
    !env.AWS_COGNITO_USER_POOL_ID ? "AWS_COGNITO_USER_POOL_ID" : null,
    !env.AWS_COGNITO_CLIENT_ID ? "AWS_COGNITO_CLIENT_ID" : null,
    !env.AWS_COGNITO_DOMAIN ? "AWS_COGNITO_DOMAIN" : null,
  ].filter(Boolean) as string[];

  const issuer =
    env.AWS_COGNITO_ISSUER ??
    (env.AWS_COGNITO_REGION && env.AWS_COGNITO_USER_POOL_ID
      ? `https://cognito-idp.${env.AWS_COGNITO_REGION}.amazonaws.com/${env.AWS_COGNITO_USER_POOL_ID}`
      : "");

  return {
    configured: missing.length === 0,
    missing,
    region: env.AWS_COGNITO_REGION ?? "",
    userPoolId: env.AWS_COGNITO_USER_POOL_ID ?? "",
    clientId: env.AWS_COGNITO_CLIENT_ID ?? "",
    clientSecret: env.AWS_COGNITO_CLIENT_SECRET ?? "",
    domain: env.AWS_COGNITO_DOMAIN ? normalizeCognitoDomain(env.AWS_COGNITO_DOMAIN) : "",
    issuer,
    callbackUrl:
      env.AWS_COGNITO_CALLBACK_URL ??
      `${env.APP_BASE_URL.replace(/\/+$/, "")}/api/auth/cognito/callback`,
    logoutRedirectUrl:
      env.AWS_COGNITO_LOGOUT_REDIRECT_URL ??
      env.APP_BASE_URL.replace(/\/+$/, ""),
  };
}

async function setCognitoAuthStateCookie(state: CognitoAuthState) {
  const cookieStore = await cookies();
  const encrypted = await encryptSecret(JSON.stringify(state), "cognito-auth-state-v1");
  cookieStore.set(COGNITO_AUTH_STATE_COOKIE, encrypted.ciphertext, {
    httpOnly: true,
    maxAge: COGNITO_AUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}

async function clearCognitoAuthStateCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COGNITO_AUTH_STATE_COOKIE);
}

export async function buildCognitoAuthorizeUrl(input: {
  mode: CognitoAuthMode;
  returnTo?: string | string[];
}) {
  const config = getCognitoConfig();

  if (!config.configured) {
    throw new Error(`Cognito auth is missing ${config.missing.join(", ")}.`);
  }

  const authState: CognitoAuthState = {
    state: randomBase64Url(24),
    nonce: randomBase64Url(24),
    codeVerifier: randomBase64Url(64),
    returnTo: safeReturnTo(input.returnTo),
    mode: input.mode,
    createdAt: new Date().toISOString(),
  };
  await setCognitoAuthStateCookie(authState);

  const url = new URL("/oauth2/authorize", config.domain);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("state", authState.state);
  url.searchParams.set("nonce", authState.nonce);
  url.searchParams.set("code_challenge", sha256Base64Url(authState.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");

  if (input.mode === "sign-up") {
    url.searchParams.set("screen_hint", "signup");
  }

  return url.toString();
}

export async function consumeCognitoAuthState(stateFromCallback: string | null) {
  const cookieStore = await cookies();
  const serialized = cookieStore.get(COGNITO_AUTH_STATE_COOKIE)?.value;
  await clearCognitoAuthStateCookie();

  if (!serialized) {
    throw new Error("Missing Cognito login state. Start sign-in again.");
  }

  const decrypted = await decryptSecret(serialized);
  const parsed = JSON.parse(decrypted.plaintext) as CognitoAuthState;

  if (!stateFromCallback || parsed.state !== stateFromCallback) {
    throw new Error("Cognito login state did not match. Start sign-in again.");
  }

  if (new Date(parsed.createdAt).getTime() + COGNITO_AUTH_STATE_MAX_AGE_SECONDS * 1000 <= Date.now()) {
    throw new Error("Cognito login state expired. Start sign-in again.");
  }

  return parsed;
}

export async function exchangeCognitoCode(code: string, authState: CognitoAuthState) {
  const config = getCognitoConfig();

  if (!config.configured) {
    throw new Error(`Cognito auth is missing ${config.missing.join(", ")}.`);
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", config.clientId);
  body.set("code", code);
  body.set("redirect_uri", config.callbackUrl);
  body.set("code_verifier", authState.codeVerifier);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (config.clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  }

  const response = await fetch(new URL("/oauth2/token", config.domain), {
    method: "POST",
    headers,
    body,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof payload.error_description === "string"
        ? payload.error_description
        : "Cognito token exchange failed.",
    );
  }

  const parsed = tokenResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Cognito token response was missing an ID token.");
  }

  return parsed.data;
}

function decodeJwtSegment(segment: string) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

async function fetchCognitoJwks(issuer: string) {
  const cached = jwksCache.get(issuer);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const response = await fetch(`${issuer.replace(/\/+$/, "")}/.well-known/jwks.json`);

  if (!response.ok) {
    throw new Error("Failed to fetch Cognito JWKS.");
  }

  const payload = (await response.json()) as { keys?: CognitoJwk[] };
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  jwksCache.set(issuer, {
    keys,
    expiresAt: Date.now() + 1000 * 60 * 30,
  });
  return keys;
}

export async function verifyCognitoIdToken(idToken: string, expectedNonce: string) {
  const config = getCognitoConfig();
  const parts = idToken.split(".");

  if (parts.length !== 3) {
    throw new Error("Cognito ID token is malformed.");
  }

  const header = decodeJwtSegment(parts[0]) as { alg?: string; kid?: string };

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Cognito ID token uses an unsupported signing algorithm.");
  }

  const keys = await fetchCognitoJwks(config.issuer);
  const jwk = keys.find((item) => item.kid === header.kid);

  if (!jwk) {
    throw new Error("Cognito ID token signing key was not found.");
  }

  const publicKey = createPublicKey({ key: jwk, format: "jwk" } as Parameters<typeof createPublicKey>[0]);
  const validSignature = verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], "base64url"),
  );

  if (!validSignature) {
    throw new Error("Cognito ID token signature is invalid.");
  }

  const parsed = idTokenPayloadSchema.safeParse(decodeJwtSegment(parts[1]));

  if (!parsed.success) {
    throw new Error("Cognito ID token payload is invalid.");
  }

  const payload = parsed.data;

  if (payload.iss !== config.issuer) {
    throw new Error("Cognito ID token issuer is invalid.");
  }

  if (payload.aud !== config.clientId) {
    throw new Error("Cognito ID token audience is invalid.");
  }

  if (payload.exp * 1000 <= Date.now()) {
    throw new Error("Cognito ID token is expired.");
  }

  if (payload.token_use && payload.token_use !== "id") {
    throw new Error("Cognito token was not an ID token.");
  }

  if (payload.nonce !== expectedNonce) {
    throw new Error("Cognito ID token nonce is invalid.");
  }

  const emailVerified = payload.email_verified === true || payload.email_verified === "true";

  if (!emailVerified) {
    throw new Error("Cognito email address is not verified.");
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    displayName: payload.name ?? payload.email.split("@")[0],
    avatarUrl: payload.picture ?? null,
  };
}

export function buildCognitoLogoutUrl(returnTo?: string | null) {
  const config = getCognitoConfig();

  if (!config.configured) {
    return safeReturnTo(returnTo ?? "/");
  }

  const logoutTarget = returnTo?.startsWith("/")
    ? `${env.APP_BASE_URL.replace(/\/+$/, "")}${returnTo}`
    : config.logoutRedirectUrl;
  const url = new URL("/logout", config.domain);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("logout_uri", logoutTarget);
  return url.toString();
}

export function sanitizeAuthReturnTo(value: string | string[] | undefined) {
  return safeReturnTo(value);
}
