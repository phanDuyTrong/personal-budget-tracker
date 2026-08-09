import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type RequestBody = {
  action?: "status" | "create_link_code" | "update_default_wallet" | "update_weekly_alerts" | "update_weekly_alert_preferences" | "send_weekly_preview" | "unlink";
  defaultWalletId?: string;
  weeklyAlertsEnabled?: boolean;
  weeklyAlertBudgetEnabled?: boolean;
  weeklyAlertGoalEnabled?: boolean;
  weeklyAlertInactivityEnabled?: boolean;
  weeklyAlertInactivityDays?: number;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function createCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

async function assertWalletOwner(
  serviceClient: any,
  userId: string,
  walletId?: string | null,
) {
  if (!walletId) return null;
  const { data, error } = await serviceClient
    .from("wallets")
    .select("id, name")
    .eq("id", walletId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error || !data)
    throw new Error("Fallback wallet not found for this user.");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const user = await getUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const action = body.action || "status";

    if (action === "status") {
      const { data: link, error } = await serviceClient
        .from("telegram_user_links")
        .select(
          "id, telegram_user_id, chat_id, username, first_name, last_name, default_wallet_id, weekly_alerts_enabled, weekly_alerts_budget_enabled,weekly_alerts_goal_enabled,weekly_alerts_inactivity_enabled,weekly_alerts_inactivity_days, weekly_alerts_last_sent_at, created_at, updated_at, wallet:wallets(id,name)",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return jsonResponse({ link });
    }

    if (action === "create_link_code") {
      const wallet = await assertWalletOwner(
        serviceClient,
        user.id,
        body.defaultWalletId,
      );
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      let code = createCode();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await serviceClient
          .from("telegram_link_codes")
          .insert({
            user_id: user.id,
            default_wallet_id: wallet?.id || null,
            code,
            expires_at: expiresAt,
          })
          .select("code, expires_at")
          .single();
        if (!error)
          return jsonResponse({
            code: data.code,
            expiresAt: data.expires_at,
            wallet,
          });
        code = createCode();
      }
      throw new Error("Could not create a unique link code.");
    }

    if (action === "update_default_wallet") {
      const wallet = await assertWalletOwner(
        serviceClient,
        user.id,
        body.defaultWalletId,
      );
      const { error } = await serviceClient
        .from("telegram_user_links")
        .update({
          default_wallet_id: wallet?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
      return jsonResponse({ ok: true, wallet });
    }

    if (action === "update_weekly_alerts") {
      const { error } = await serviceClient
        .from("telegram_user_links")
        .update({
          weekly_alerts_enabled: body.weeklyAlertsEnabled !== false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
      return jsonResponse({ ok: true, weeklyAlertsEnabled: body.weeklyAlertsEnabled !== false });
    }

    if (action === "update_weekly_alert_preferences") {
      const inactivityDays = Math.max(
        1,
        Number(body.weeklyAlertInactivityDays || 7),
      );
      const { error } = await serviceClient
        .from("telegram_user_links")
        .update({
          weekly_alerts_budget_enabled: body.weeklyAlertBudgetEnabled !== false,
          weekly_alerts_goal_enabled: body.weeklyAlertGoalEnabled !== false,
          weekly_alerts_inactivity_enabled: body.weeklyAlertInactivityEnabled === true,
          weekly_alerts_inactivity_days: inactivityDays,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
      return jsonResponse({
        ok: true,
        weeklyAlertBudgetEnabled: body.weeklyAlertBudgetEnabled !== false,
        weeklyAlertGoalEnabled: body.weeklyAlertGoalEnabled !== false,
        weeklyAlertInactivityEnabled: body.weeklyAlertInactivityEnabled === true,
        weeklyAlertInactivityDays: inactivityDays,
      });
    }

    if (action === "send_weekly_preview") {
      const authHeader = `Bearer ${serviceRoleKey}`;
      const response = await fetch(`${supabaseUrl}/functions/v1/telegram-weekly-alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          dryRun: false,
          userId: user.id,
          source: "settings-preview",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not send weekly preview.");
      }
      if (payload?.sent === 0) {
        return jsonResponse({
          ok: true,
          sent: 0,
          message: "No alert was sent because there are no budgets or goals that need attention right now.",
        });
      }
      return jsonResponse({ ok: true, sent: payload?.sent || 0 });
    }

    if (action === "unlink") {
      const { error } = await serviceClient
        .from("telegram_user_links")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
