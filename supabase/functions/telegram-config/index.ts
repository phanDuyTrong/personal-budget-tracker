import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type RequestBody = {
  action?: "status" | "create_link_code" | "update_default_wallet" | "unlink";
  defaultWalletId?: string;
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
          "id, telegram_user_id, chat_id, username, first_name, last_name, default_wallet_id, created_at, updated_at, wallet:wallets(id,name)",
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
