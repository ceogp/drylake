#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env" });

const region = process.env.AWS_REGION || process.env.AWS_COGNITO_REGION || "ap-northeast-1";
const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID || "ap-northeast-1_B9vcje67d";
const clientId = process.env.AWS_COGNITO_CLIENT_ID || "1te0ug8d89479c5215nkphjgq7";
const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

const callbackUrls = [
  "https://drylake.xupracorp.com/api/auth/cognito/callback",
];
const logoutUrls = [
  "https://drylake.xupracorp.com/",
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function aws(args, options = {}) {
  const output = execFileSync("aws", [...args, "--region", region], {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  return output ? output.trim() : "";
}

function awsJson(args) {
  const output = aws([...args, "--output", "json"]);
  return output ? JSON.parse(output) : null;
}

function providerExists() {
  try {
    aws([
      "cognito-idp",
      "describe-identity-provider",
      "--user-pool-id",
      userPoolId,
      "--provider-name",
      "Google",
    ]);
    return true;
  } catch {
    return false;
  }
}

if (!googleClientId || !googleClientSecret) {
  fail(
    [
      "Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET.",
      "Create a Google OAuth web client first with this authorized redirect URI:",
      "https://auth.drylake.xupracorp.com/oauth2/idpresponse",
    ].join("\n"),
  );
}

const providerDetails = JSON.stringify({
  client_id: googleClientId,
  client_secret: googleClientSecret,
  authorize_scopes: "openid email profile",
});

const attributeMapping = JSON.stringify({
  email: "email",
  email_verified: "email_verified",
  name: "name",
  picture: "picture",
});

if (providerExists()) {
  aws([
    "cognito-idp",
    "update-identity-provider",
    "--user-pool-id",
    userPoolId,
    "--provider-name",
    "Google",
    "--provider-details",
    providerDetails,
    "--attribute-mapping",
    attributeMapping,
    "--query",
    "IdentityProvider.{ProviderName:ProviderName,ProviderType:ProviderType}",
  ]);
} else {
  aws([
    "cognito-idp",
    "create-identity-provider",
    "--user-pool-id",
    userPoolId,
    "--provider-name",
    "Google",
    "--provider-type",
    "Google",
    "--provider-details",
    providerDetails,
    "--attribute-mapping",
    attributeMapping,
    "--query",
    "IdentityProvider.{ProviderName:ProviderName,ProviderType:ProviderType}",
  ]);
}

const appClient = awsJson([
  "cognito-idp",
  "describe-user-pool-client",
  "--user-pool-id",
  userPoolId,
  "--client-id",
  clientId,
  "--query",
  "UserPoolClient",
]);

const allowedOAuthFlows = appClient.AllowedOAuthFlows?.length
  ? appClient.AllowedOAuthFlows
  : ["code"];
const allowedOAuthScopes = appClient.AllowedOAuthScopes?.length
  ? appClient.AllowedOAuthScopes
  : ["openid", "email", "profile"];
const supportedProviders = Array.from(
  new Set([...(appClient.SupportedIdentityProviders ?? ["COGNITO"]), "Google"]),
);

aws([
  "cognito-idp",
  "update-user-pool-client",
  "--user-pool-id",
  userPoolId,
  "--client-id",
  clientId,
  "--supported-identity-providers",
  ...supportedProviders,
  "--callback-urls",
  ...(appClient.CallbackURLs?.length ? appClient.CallbackURLs : callbackUrls),
  "--logout-urls",
  ...(appClient.LogoutURLs?.length ? appClient.LogoutURLs : logoutUrls),
  "--allowed-o-auth-flows-user-pool-client",
  "--allowed-o-auth-flows",
  ...allowedOAuthFlows,
  "--allowed-o-auth-scopes",
  ...allowedOAuthScopes,
  "--query",
  "UserPoolClient.{ClientId:ClientId,SupportedIdentityProviders:SupportedIdentityProviders}",
]);

const providers = awsJson([
  "cognito-idp",
  "describe-user-pool-client",
  "--user-pool-id",
  userPoolId,
  "--client-id",
  clientId,
  "--query",
  "UserPoolClient.SupportedIdentityProviders",
]);

console.log("Cognito Google sign-in configured.");
console.log(JSON.stringify({ userPoolId, clientId, supportedProviders: providers }, null, 2));
