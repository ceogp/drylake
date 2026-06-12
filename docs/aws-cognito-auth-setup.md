# DryLake AWS Auth Setup

This is the migration path away from Clerk without breaking the current app.

Do not remove Clerk first. Run AWS auth in parallel, verify it with real users, then switch `AUTH_MODE` after the extension connect flow, billing, and admin user management are proven.

## Decision

Use Amazon Cognito User Pools with Cognito managed login as the first AWS auth provider.

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

Add a Cognito domain for managed login. Use the AWS-hosted domain first, then move to a custom domain after the basic sign-in flow is stable.

## Environment Variables

Add these later, but do not turn them on until the callback flow is implemented:

```env
AUTH_MODE=clerk

AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=
AWS_COGNITO_CLIENT_ID=
AWS_COGNITO_CLIENT_SECRET=
AWS_COGNITO_DOMAIN=
AWS_COGNITO_ISSUER=
AWS_COGNITO_SIGN_IN_URL=/sign-in
AWS_COGNITO_SIGN_OUT_URL=/api/auth/cognito/logout
AWS_COGNITO_CALLBACK_URL=https://drylake.xupracorp.com/api/auth/cognito/callback
```

The first code change should add a new mode, not replace Clerk:

```env
AUTH_MODE=clerk | cognito | dev
```

`clerk` must stay the production default until Cognito is verified.

## App Flow

The Cognito flow should be:

1. User opens `/sign-in`.
2. DryLake redirects to Cognito managed login.
3. Cognito redirects to `/api/auth/cognito/callback?code=...`.
4. DryLake exchanges the code for tokens server-side.
5. DryLake verifies the ID token issuer, audience, expiry, nonce/state, email, and `sub`.
6. DryLake calls `ensureAppSession({ authProvider: "cognito", authSubject: cognitoSub, email, displayName, avatarUrl })`.
7. DryLake sets an app-owned encrypted, HTTP-only session cookie.
8. The rest of the app continues to use `getCurrentAppContext()`.

The extension connect flow should not change. It should still rely on the signed-in web app approving an `ExtensionAuthRequest`, then issuing a DryLake extension token.

## Required Code Work

1. Add `cognito` to `AUTH_MODE` validation in `lib/env.ts`.
2. Add Cognito env vars with validation.
3. Add a Cognito auth service:
   - build authorize URL
   - generate state, nonce, and PKCE verifier
   - exchange authorization code for tokens
   - fetch/verify JWKS
   - validate issuer, audience, expiry, nonce, and email
4. Add encrypted app session cookies independent of Clerk.
5. Update `lib/services/current-user.ts`:
   - try Cognito app session when `AUTH_MODE=cognito`
   - keep Clerk path when `AUTH_MODE=clerk`
   - keep extension-token auth for API requests
6. Add `/api/auth/cognito/callback`.
7. Add `/api/auth/cognito/logout`.
8. Update `/sign-in` and `/sign-up` to redirect to Cognito when `AUTH_MODE=cognito`.
9. Keep `/api/clerk/webhook` until all Clerk users are migrated or archived.
10. Update health/setup pages to report Cognito status without hiding Clerk status.

## Migration Rules

- Link by verified email first, then set `authProvider="cognito"` and `authSubject=<cognito sub>`.
- If a Clerk user and Cognito user have the same verified email, keep the existing DryLake `User.id`.
- Do not create a second organization for migrated users.
- Do not delete Clerk auth fields until at least one full billing cycle after cutover.
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

## AWS References

- Cognito managed login: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-managed-login.html
- Cognito authorize endpoint: https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html
- Cognito token endpoint: https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html
- Cognito app client callback/sign-out URLs: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html
- Cognito logout endpoint: https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
