# API root discovery TDD evidence

## Source and user journey

Derived from the deployed API returning `RESOURCE_NOT_FOUND` when an operator opened the public API origin. As an operator, I want the API root to return a safe discovery envelope so that I can distinguish a healthy API deployment from an unknown route without exposing configuration or business endpoints.

## RED and GREEN evidence

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `corepack pnpm --filter @call-to-cash/api test` | Expected failure | `GET / returns a safe API discovery envelope` received `404` instead of `200`. |
| GREEN | `corepack pnpm --filter @call-to-cash/api test` | Pass | The root route returned the standard success envelope with only service, health, and readiness paths. |
| Verify | `corepack pnpm --filter @call-to-cash/api lint` | Pass | API source passed ESLint with zero warnings. |
| Verify | `corepack pnpm --filter @call-to-cash/api typecheck` | Pass | API TypeScript compilation completed without emitting files. |

## Guarantee and known gaps

`GET /` is now an unversioned operational discovery endpoint. Unknown paths still return the standard `RESOURCE_NOT_FOUND` envelope. Database-backed API cases remain skipped when `TEST_DATABASE_URL` is not configured; no coverage command is defined for this workspace.
