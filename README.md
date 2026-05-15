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

## Telegram bot setup

The Telegram bot runs as Supabase Edge Functions and writes directly to the existing Supabase tables after a user links their Telegram account in Settings.

1. Create a bot in Telegram with BotFather and copy the bot token.
2. Apply the migration in `supabase/migrations/20260515090000_add_telegram_bot_integration.sql`.
3. Set Supabase Edge Function secrets:

   ```bash
   supabase secrets set TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   supabase secrets set TELEGRAM_WEBHOOK_SECRET="$(openssl rand -hex 32)"
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
   supabase secrets set WEB_APP_URL="https://your-app.web.app"
   supabase secrets set BOT_TIME_ZONE="Asia/Ho_Chi_Minh"
   ```

4. Deploy the functions:

   ```bash
   supabase functions deploy telegram-config
   supabase functions deploy telegram-webhook --no-verify-jwt
   ```

5. Register the Telegram webhook, replacing values with your project ref and secret:

   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram-webhook","secret_token":"YOUR_TELEGRAM_WEBHOOK_SECRET"}'
   ```

6. In the web app, open Settings → Telegram Bot, choose a default wallet, generate a code, then send `/link 123456` to the bot.

The v1 parser is local and free. It supports Vietnamese and English examples like `ăn trưa 85k bằng tiền mặt`, `lunch 85k from cash`, `nhận lương 20tr vào Techcombank`, and `transfer 2m from cash to savings`.
