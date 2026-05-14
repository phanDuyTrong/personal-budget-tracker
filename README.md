# Budget Manager

Personal budget tracker web app built with React, Vite, HeroUI, TanStack Query, Zustand, and Supabase Auth/Postgres. The shipping frontend lives in `web/`; older experiments are archived under `archive/`.

## Local setup

1. Install frontend dependencies:

   ```bash
   cd web
   npm ci
   ```

2. Create `web/.env` from `web/.env.example` and fill in your Supabase values:

   ```bash
   cp web/.env.example web/.env
   ```

3. Run the app:

   ```bash
   npm run dev
   ```

## Environment flags

- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/public key used by the browser app.
- `VITE_GEMINI_API_KEY`: Optional key for AI transaction parsing.
- `VITE_DEV_MOCK_AUTH`: Defaults to `false`. Set to `true` only when you intentionally want local development to bypass Supabase login with a mock user.

## Quality checks

Run these before opening a PR:

```bash
cd web
npm run lint
npm run build
```

CI runs the same lint and build checks on pull requests and pushes to `main`.

## Supabase RLS smoke test

After applying migrations, create two confirmed Supabase auth test users and run:

```bash
SUPABASE_URL="https://your-project-ref.supabase.co" \
SUPABASE_ANON_KEY="your-anon-key" \
RLS_USER_A_EMAIL="user-a@example.com" \
RLS_USER_A_PASSWORD="password-a" \
RLS_USER_B_EMAIL="user-b@example.com" \
RLS_USER_B_PASSWORD="password-b" \
node scripts/test-rls.mjs
```

The script signs in as user B, creates a wallet, signs in as user A, and verifies user A cannot read user B's wallet.
