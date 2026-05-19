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
2. Apply the Telegram migrations in `supabase/migrations/`.
3. Set Supabase Edge Function secrets:

   ```bash
   supabase secrets set TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   supabase secrets set TELEGRAM_WEBHOOK_SECRET="$(openssl rand -hex 32)"
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
   supabase secrets set WEB_APP_URL="https://your-app.web.app"
   supabase secrets set BOT_TIME_ZONE="Asia/Ho_Chi_Minh"

   # Optional AI fallback, server-side only. OpenRouter supports OpenAI-compatible chat completions.
   supabase secrets set AI_PARSE_API_KEY="your-openrouter-or-compatible-api-key"
   supabase secrets set AI_PARSE_BASE_URL="https://openrouter.ai/api/v1/chat/completions"
   supabase secrets set AI_PARSE_MODEL="openrouter/free"
   supabase secrets set AI_PARSE_MODE="assist"
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

6. In the web app, open Settings → Telegram Bot, generate a code, optionally choose a fallback wallet, then send `/link 123456` to the bot.

The parser is hybrid and AI-first when `AI_PARSE_API_KEY` is configured. It tries templates first, then server-side AI with the user's wallets/categories/contacts/recent examples, then local parsing as a free fallback. The AI key is stored only in Supabase Edge Function secrets, never in the browser. Successful parses and later corrections are stored as per-user examples in `telegram_ai_parse_memories`, so future AI calls can follow that user's wording and categorization style. Without `AI_PARSE_API_KEY`, the bot still works with the free local parser. It supports Vietnamese and English examples like `ăn trưa 85k bằng tiền mặt`, `lunch 85k from cash`, `nhận lương 20tr vào Techcombank`, and `transfer 2m from cash to savings`.

Telegram replies use a friendly, lightly Gen Z, supportive personal-finance tone. Normal small talk like greetings, thanks, and help questions gets a conversational reply instead of being forced through the transaction parser. Report answers include real queried totals plus a short coach note. The coach note can use AI when available, but it is constrained to the supplied report data and falls back to a deterministic summary if the AI provider is unavailable.

Telegram templates let one message create multiple transactions. Create or replace a template from Telegram with:

```text
/template add Nhận lương tháng => nhận lương 20tr vào Techcombank; cho mẹ 5tr từ tài khoản
```

You can also create templates in more natural wording:

```text
tạo template Nhận lương tháng gồm nhận lương 20tr vào Techcombank; cho mẹ 5tr từ tài khoản
```

Then send `Nhận lương tháng` to run the template. Use `/templates` to list templates and `/template delete 1` or `/template delete Nhận lương tháng` to remove one. Templates also appear in Settings → Telegram Bot so they can be reviewed and deleted from the web app.

The bot can answer financial questions from Telegram after the account is linked. It queries real transaction rows for the linked Supabase user, then summarizes totals and top spending areas. Examples:

```text
tóm tắt chi tiêu tháng này
tháng trước tôi chi nhiều nhất vào đâu?
báo cáo tài chính 3 tháng vừa rồi
top 5 khoản chi lớn nhất tháng này
how much did I spend in the last 30 days?
```
