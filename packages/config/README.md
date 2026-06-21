# Shared configuration

Owns validated runtime/provider environment configuration and reusable TypeScript configuration. Mock remains the default payment provider. Solana Devnet configuration is parsed without requiring credentials at process startup; `/ready` fails closed when `solana_devnet` is selected without a valid public recipient/provider instance. Frontend-specific ESLint and Vite configuration remains in `apps/web`.
