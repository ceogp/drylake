# DryLake AWS Auth Setup

This is the AWS-owned auth path for DryLake. Clerk can remain installed until removed from code, but production auth should move to `AUTH_MODE=cognito` once the deployed env contains the Cognito variables below.

## Decision

Use Amazon Cognito User Pools with Cognito managed login as the AWS auth provider.

DryLake should continue to own product users, organizations, roles, subscriptions, entitlements, extension tokens, and audit records in Postgres. Cognito should only replace the external browser-session provider that Clerk handles today.

The app data model already supports this:

- `User.authProvider` becomes `cognito` for AWS-authenticated users.
- `User.authSubject` stores the Cognito `sub`.
- `User.email` remains the stable account link key during migration.
- `Organization`, `OrganizationMembership`, `Subscription`, `ExtensionAuthRequest`, and extension tokens stay in DryLake.
- Stripe remains the billing system. Do not move billing into Cognito.

## AWS Resources

Create one Cognito User Pool per environment:

- `drylake-staging-users`
- `drylake-production-users`

Create one app client per web app environment:

- OAuth flow: Authorization code grant
- PKCE: enabled
- Client secret: no for browser-only flows; yes only if the callback exchange is exclusively server-side
- Scopes: `openid`, `email`, `profile`
- Allowed callback URLs:
  - `http://localhost:3000/api/auth/cognito/callback`
  - `https://drylake.xupracorp.com/api/auth/cognito/callback`
- Allowed sign-out URLs:
  - `http://localhost:3000/`
  - `https://drylake.xupracorp.com/`

The production AWS-hosted domain is provisioned:

- Region: `ap-northeast-1`
- User pool: `ap-northeast-1_B9vcje67d`
- Hosted login domain: `https://drylake-auth-355825201962.auth.ap-northeast-1.amazoncognito.com`
- Secret bundle: `xupra-drylake/production/cognito-auth`
- Local manifest: `storage/staging/cognito-auth-manifest.json`

Google social login is still pending until a Google OAuth web client ID and client secret exist. The custom domain `auth.drylake.xupracorp.com` is active and should be used for the Google redirect URI.

ACM certificate requested for the custom auth domain:

- Certificate region: `us-east-1`
- Certificate ARN: `arn:aws:acm:us-east-1:355825201962:certificate/b65e3271-a8e5-47a5-817f-6b9978dab316`
- Validation CNAME name: `_6f317525f5a48ee1c4013927dec8d467.auth.drylake.xupracorp.com.`
- Validation CNAME value: `_cc2df0cf44a943706127badfbc346c34.jkddzztszm.acm-validations.aws.`
- Local manifest: `storage/staging/cognito-auth-custom-domain-manifest.json`

## Environment Variables

Required production env:

```env
AUTH_MODE=cognito

AWS_COGNITO_REGION=ap-northeast-1
AWS_COGNITO_USER_POOL_ID=
AWS_COGNITO_CLIENT_ID=
AWS_COGNITO_CLIENT_SECRET=
AWS_COGNITO_DOMAIN=
AWS_COGNITO_ISSUER=
AWS_COGNITO_CALLBACK_URL=https://drylake.xupracorp.com/api/auth/cognito/callback
AWS_COGNITO_LOGOUT_REDIRECT_URL=https://drylake.xupracorp.com/
```

The values are stored in AWS Secrets Manager under `xupra-drylake/production/cognito-auth`.

## App Flow

The Cognito flow should be:

1. User opens `/sign-in`.
2. DryLake redirects to Cognito managed login.
3. Cognito redirects to `/api/auth/cognito/callback?code=...`.
4. DryLake exchanges the code for tokens server-side.
5. DryLake verifies the ID token issuer, audience, expiry, nonce/state, email, and `sub`.
6. DryLake calls `ensureAppSession({ authProvider: "cognito", authSubject: cognitoSub, email, displayName, avatarUrl })`.
7. DryLake sets an app-owned HTTP-only session cookie backed by a hashed session token in Postgres.
8. The rest of the app continues to use `getCurrentAppContext()`.

The extension connect flow should not change. It should still rely on the signed-in web app approving an `ExtensionAuthRequest`, then issuing a DryLake extension token.

## Implemented Code Work

1. Added `cognito` to `AUTH_MODE` validation in `lib/env.ts`.
2. Added Cognito env vars with validation.
3. Added a Cognito auth service:
   - build authorize URL
   - generate state, nonce, and PKCE verifier
   - exchange authorization code for tokens
   - fetch/verify JWKS
   - validate issuer, audience, expiry, nonce, and email
4. Added app-owned browser sessions independent of Clerk.
5. Updated `lib/services/current-user.ts`:
   - try Cognito app session when `AUTH_MODE=cognito`
   - keep Clerk path when `AUTH_MODE=clerk`
   - keep extension-token auth for API requests
6. Added `/api/auth/cognito/callback`.
7. Added `/api/auth/cognito/logout`.
8. Updated `/sign-in` and `/sign-up` to redirect to Cognito when `AUTH_MODE=cognito`.
9. Updated health/setup pages to report Cognito status.
10. Added auth session/event admin visibility.

## Migration Rules

- Link by verified email first, then set `authProvider="cognito"` and `authSubject=<cognito sub>`.
- If a Clerk user and Cognito user have the same verified email, keep the existing DryLake `User.id`.
- Do not create a second organization for migrated users.
- Do not migrate billing. Stripe remains authoritative for subscriptions and entitlements.
- Do not change extension tokens. They are DryLake-owned and should survive auth-provider changes.

## Cutover Checklist

Before setting `AUTH_MODE=cognito` in production:

- Local sign-in works.
- Production sign-in works.
- Sign-out clears the DryLake app session and Cognito managed login session.
- Existing Clerk-created user can sign in through Cognito and lands in the same organization.
- New user signup creates a DryLake user, organization, free subscription, and starter workspace.
- Billing page works with Stripe.
- Extension browser connect works.
- Guard scan and paid Guard Fix with AI work after extension connect.
- Admin user list shows `authProvider=cognito`.
- Health endpoint reports Cognito configured.

## Remaining External Setup

1. Create a Google OAuth web client for DryLake.
2. Add this authorized redirect URI to Google:
   `https://auth.drylake.xupracorp.com/oauth2/idpresponse`
3. Run:
   `GOOGLE_OAUTH_CLIENT_ID=<client-id> GOOGLE_OAUTH_CLIENT_SECRET=<client-secret> node scripts/aws/configure-cognito-google.mjs`
4. Confirm the Cognito app client supported providers are `COGNITO, Google`.
5. Open `https://drylake.xupracorp.com/sign-in` and confirm Cognito managed login shows the Google option.

## AWS References

- Cognito managed login: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-managed-login.html
- Cognito authorize endpoint: https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html
- Cognito token endpoint: https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html
- Cognito app client callback/sign-out URLs: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html
- Cognito logout endpoint: https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
