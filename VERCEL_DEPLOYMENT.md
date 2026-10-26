# Cambio on Vercel

The existing public origin is https://cambio-rho.vercel.app. Its Git integration is associated with the `cambio` project under `jomilojujaiyesimi-7017s-projects`. Before this fix, the homepage returned 200 but `/api/health`, username availability and `/app/activity` returned Vercel 404 responses.

## Routing and runtime

`vercel.json` selects Vite, runs `npm ci` and `npm run build`, serves `dist` through the CDN, routes `/api/*` to the Node function `api/index.ts`, and rewrites `/app/*` to `index.html`. Missing assets are not rewritten to HTML. Security headers cover both static files and API responses; the CSP is regression-tested against the Express policy.

The API uses the same identity service, signature validation, Firestore transactions and shared rate limits as the standalone Express server. It does not open a listening port. Concurrent requests share initialization; transient initialization failure is retried after 30 seconds. Neither this deployment fix nor its tests broadcast blockchain transactions.

## Required project configuration

The owning Vercel account must configure these **Production runtime** variables before a new deployment (existing deployments do not receive environment changes):

| Variable | Value |
|---|---|
| `APP_URL` | `https://cambio-rho.vercel.app` |
| `IDENTITY_STORE` | `firestore` |
| `ALLOW_NON_DURABLE_IDENTITY` | `false` |
| `TRUST_PROXY` | `1` for Vercel's ingress |
| `FIREBASE_PROJECT_ID` | `modified-world-h83d0`, unless deliberately using another owned project |
| `FIRESTORE_DATABASE_ID` | `ai-studio-cambio-259bf3c8-6227-4d5b-b3e3-2b6bcc78ecc2`, unless deliberately using another existing database |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Complete JSON of an authorized service account, stored as a sensitive server-only environment variable |

The account must have Firestore access to the configured project/database (the documented standard role is Cloud Datastore User). Keep the existing Firestore deny-by-default client rules. The public Firebase browser API key does not authenticate the backend Admin SDK. Do not add `VITE_` to the credential variable, print its value, commit it, or paste it into an issue or chat. `GOOGLE_APPLICATION_CREDENTIALS` with an actual mounted credential file or supported Application Default Credentials remains an alternative; Vercel does not automatically inherit a Cloud Run service identity.

Keep `FIRESTORE_EMULATOR_HOST` unset in Production. Keep `VITE_ENABLE_MAINNET=false`, and preserve the deployer's existing `VITE_WALLETCONNECT_PROJECT_ID` and its Reown origin allowlist. These two frontend variables apply at build time.

Push to the existing connected Git branch, or redeploy that revision after setting the variables. This change does not create a new Vercel project, move domains, weaken client Firestore rules, or replace production usernames with an ephemeral store.

## Verification

- `/` and `/app/activity`: HTTP 200 HTML; browser refresh keeps working.
- `/api/health`: JSON. Readiness requires **HTTP 200**, `identity.available=true`, `identity.durable=true`, `identity.kind=firestore`.
- `/api/identity/availability?username=deployment_probe`: HTTP 200 JSON when Firestore and shared limits are healthy; no name is claimed by this GET.
- `/api/missing`: HTTP 404 JSON, never the SPA or Vercel's missing-function page.
- An unavailable or unauthorized Firestore store must return HTTP 503; this is not a successful identity deployment.
- A wallet-approved signature is still required to claim a username. Do not use this production deployment as a test database for automated claims.

`tests/serverless.test.ts` exercises concurrency, production bootstrap mode, a genuine signed claim against disposable local storage, origin rejection, truthful failure/recovery and secret-safe responses. `tests/identity-credentials.test.ts` tests explicit server credentials and safe malformed-input errors without real credentials.
