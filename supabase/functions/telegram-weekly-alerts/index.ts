import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.ts";
import { buildWeeklyAlert } from "../_shared/telegram-weekly-alerts.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const timeZone = Deno.env.get("BOT_TIME_ZONE") || "Asia/Ho_Chi_Minh";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function sendTelegramMessage(chatId: string, text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || "Telegram sendMessage failed.");
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);

    const previewUserId = typeof body?.userId === "string" ? body.userId : null;

    const query = supabase
      .from("telegram_user_links")
      .select("user_id,chat_id,weekly_alerts_enabled,weekly_alerts_budget_enabled,weekly_alerts_goal_enabled,weekly_alerts_inactivity_enabled,weekly_alerts_inactivity_days");
    const { data: links, error } = previewUserId
      ? await query.eq("user_id", previewUserId).limit(1)
      : await query.eq("weekly_alerts_enabled", true);
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    let sent = 0;
    const failures: Array<{ userId: string; error: string }> = [];
    const previews: Array<{ userId: string; chatId: string; message: string }> = [];
    for (const link of links || []) {
      try {
        const message = await buildWeeklyAlert(supabase, link.user_id, timeZone, {
          enabled: link.weekly_alerts_enabled !== false,
          budgetEnabled: link.weekly_alerts_budget_enabled !== false,
          goalEnabled: link.weekly_alerts_goal_enabled !== false,
          inactivityEnabled: link.weekly_alerts_inactivity_enabled === true,
          inactivityDays: Number(link.weekly_alerts_inactivity_days || 7),
        });
        if (!message) continue;
        if (dryRun) {
          previews.push({
            userId: link.user_id,
            chatId: String(link.chat_id),
            message,
          });
        } else {
          await sendTelegramMessage(String(link.chat_id), message);
          await supabase
            .from("telegram_user_links")
            .update({ weekly_alerts_last_sent_at: new Date().toISOString() })
            .eq("user_id", link.user_id);
          sent += 1;
        }
      } catch (sendError) {
        failures.push({
          userId: link.user_id,
          error: sendError instanceof Error ? sendError.message : String(sendError),
        });
      }
    }

    return jsonResponse({
      ok: true,
      dryRun,
      scanned: (links || []).length,
      sent: dryRun ? 0 : sent,
      previews,
      failures,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
