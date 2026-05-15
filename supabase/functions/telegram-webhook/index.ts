import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.ts";
import {
  parseTelegramEdit,
  parseTelegramTransaction,
} from "../_shared/telegram-parser.ts";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: TelegramUser;
  reply_to_message?: { message_id: number };
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const timeZone = Deno.env.get("BOT_TIME_ZONE") || "Asia/Ho_Chi_Minh";

const supabase = createClient(supabaseUrl, serviceRoleKey);

function asText(value: number | string | undefined | null) {
  return value === undefined || value === null ? "" : String(value);
}

function detectVietnamese(text: string) {
  return (
    /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
      text,
    ) ||
    /\b(hom|ngay|tien|vi|danh muc|sua|xoa|chuyen|luong|nhan)\b/i.test(
      text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    )
  );
}

function formatAmount(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}₫`;
}

async function sendMessage(
  chatId: string,
  text: string,
  replyToMessageId?: string,
) {
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: replyToMessageId
          ? Number(replyToMessageId)
          : undefined,
        allow_sending_without_reply: true,
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.ok)
    throw new Error(payload.description || "Telegram sendMessage failed.");
  return payload.result as TelegramMessage;
}

async function loadContext(userId: string, defaultWalletId: string) {
  const [
    { data: wallets, error: walletError },
    { data: categories, error: categoryError },
    { data: contacts, error: contactError },
  ] = await Promise.all([
    supabase
      .from("wallets")
      .select("id,name,type")
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("categories")
      .select("id,name,type,parent_id")
      .eq("user_id", userId),
    supabase.from("contacts").select("id,name").eq("user_id", userId),
  ]);
  if (walletError) throw walletError;
  if (categoryError) throw categoryError;
  if (contactError) throw contactError;
  return {
    wallets: wallets || [],
    categories: categories || [],
    contacts: contacts || [],
    defaultWalletId,
    timeZone,
  };
}

async function handleLink(message: TelegramMessage, code: string) {
  const telegramUserId = asText(message.from?.id);
  const chatId = asText(message.chat.id);
  const now = new Date().toISOString();
  const { data: linkCode, error } = await supabase
    .from("telegram_link_codes")
    .select("id,user_id,default_wallet_id,expires_at,used_at")
    .eq("code", code)
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) throw error;
  if (!linkCode) {
    await sendMessage(
      chatId,
      "Link code is invalid or expired. Please generate a new code in Budget Manager Settings.",
      asText(message.message_id),
    );
    return;
  }

  await supabase
    .from("telegram_user_links")
    .delete()
    .eq("telegram_user_id", telegramUserId);
  await supabase
    .from("telegram_user_links")
    .delete()
    .eq("user_id", linkCode.user_id);
  const { error: insertError } = await supabase
    .from("telegram_user_links")
    .insert({
      user_id: linkCode.user_id,
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      username: message.from?.username || null,
      first_name: message.from?.first_name || null,
      last_name: message.from?.last_name || null,
      default_wallet_id: linkCode.default_wallet_id,
    });
  if (insertError) throw insertError;

  await supabase
    .from("telegram_link_codes")
    .update({ used_at: now })
    .eq("id", linkCode.id);
  await sendMessage(
    chatId,
    "Linked. You can now send transactions like “ăn trưa 85k bằng tiền mặt” or “lunch 85k from cash”.",
    asText(message.message_id),
  );
}

async function getLink(message: TelegramMessage) {
  const { data, error } = await supabase
    .from("telegram_user_links")
    .select("user_id, telegram_user_id, chat_id, default_wallet_id")
    .eq("telegram_user_id", asText(message.from?.id))
    .maybeSingle();
  if (error) throw error;
  return data;
}

function summarizeTransaction(
  tx: any,
  languageIsVietnamese: boolean,
  unmatched: string[] = [],
) {
  const typeLabel =
    tx.type === "income"
      ? languageIsVietnamese
        ? "Thu nhập"
        : "Income"
      : tx.type === "transfer"
        ? languageIsVietnamese
          ? "Chuyển ví"
          : "Transfer"
        : languageIsVietnamese
          ? "Chi tiêu"
          : "Expense";
  const warnings =
    unmatched.length > 0
      ? `\n${languageIsVietnamese ? "Chưa khớp" : "Unmatched"}: ${unmatched.join(", ")}`
      : "";
  return `${languageIsVietnamese ? "Đã ghi" : "Saved"}: ${typeLabel} ${formatAmount(Number(tx.amount))}\n${languageIsVietnamese ? "Ngày" : "Date"}: ${tx.date}\n${languageIsVietnamese ? "Mô tả" : "Description"}: ${tx.description || "-"}${warnings}\n\n${languageIsVietnamese ? "Reply tin nhắn này với “sửa ...” hoặc “xóa” nếu cần chỉnh." : "Reply to this message with “change ...” or “delete” if you need to fix it."}`;
}

async function handleEdit(message: TelegramMessage, link: any, text: string) {
  const chatId = asText(message.chat.id);
  const botMessageId = asText(message.reply_to_message?.message_id);
  const { data: event, error } = await supabase
    .from("telegram_transaction_events")
    .select("transaction_id,user_id")
    .eq("chat_id", chatId)
    .eq("telegram_user_id", asText(message.from?.id))
    .eq("bot_message_id", botMessageId)
    .maybeSingle();

  if (error) throw error;
  if (!event) {
    await sendMessage(
      chatId,
      "I could not find the transaction for that replied message.",
      asText(message.message_id),
    );
    return;
  }

  const context = await loadContext(link.user_id, link.default_wallet_id);
  const parsed = parseTelegramEdit(text, context);
  if (parsed.action === "delete") {
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", event.transaction_id)
      .eq("user_id", event.user_id);
    if (deleteError) throw deleteError;
    await sendMessage(
      chatId,
      detectVietnamese(text) ? "Đã xóa transaction." : "Transaction deleted.",
      asText(message.message_id),
    );
    return;
  }

  if (parsed.action !== "update" || !parsed.changes) {
    await sendMessage(
      chatId,
      parsed.reason || "I could not understand the edit command.",
      asText(message.message_id),
    );
    return;
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.changes.amount !== undefined)
    updatePayload.amount = parsed.changes.amount;
  if (parsed.changes.walletId !== undefined)
    updatePayload.wallet_id = parsed.changes.walletId;
  if (parsed.changes.toWalletId !== undefined)
    updatePayload.to_wallet_id = parsed.changes.toWalletId;
  if (parsed.changes.categoryId !== undefined)
    updatePayload.category_id = parsed.changes.categoryId;
  if (parsed.changes.description !== undefined)
    updatePayload.description = parsed.changes.description;
  if (parsed.changes.date !== undefined)
    updatePayload.date = parsed.changes.date;

  const { data: tx, error: updateError } = await supabase
    .from("transactions")
    .update(updatePayload)
    .eq("id", event.transaction_id)
    .eq("user_id", event.user_id)
    .select()
    .single();
  if (updateError) throw updateError;
  await sendMessage(
    chatId,
    summarizeTransaction(tx, detectVietnamese(text)),
    asText(message.message_id),
  );
}

async function handleTransaction(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  const chatId = asText(message.chat.id);
  const context = await loadContext(link.user_id, link.default_wallet_id);
  const parsed = parseTelegramTransaction(text, context);
  const languageIsVietnamese = detectVietnamese(text);
  if (!parsed.ok) {
    await sendMessage(chatId, parsed.reason, asText(message.message_id));
    return;
  }

  const { data: tx, error } = await supabase
    .from("transactions")
    .insert({
      user_id: link.user_id,
      wallet_id: parsed.walletId,
      to_wallet_id: parsed.toWalletId,
      category_id: parsed.categoryId,
      contact_id: parsed.contactId,
      amount: parsed.amount,
      type: parsed.type,
      description: parsed.description,
      date: parsed.date,
      is_recurring: false,
      is_debt: false,
    })
    .select()
    .single();
  if (error) throw error;

  const reply = await sendMessage(
    chatId,
    summarizeTransaction(tx, languageIsVietnamese, parsed.unmatched),
    asText(message.message_id),
  );
  await supabase.from("telegram_transaction_events").insert({
    user_id: link.user_id,
    telegram_user_id: asText(message.from?.id),
    chat_id: chatId,
    source_message_id: asText(message.message_id),
    bot_message_id: asText(reply.message_id),
    transaction_id: tx.id,
  });
}

Deno.serve(async (req) => {
  try {
    if (!telegramToken || !webhookSecret || !serviceRoleKey || !supabaseUrl) {
      return jsonResponse(
        { error: "Telegram function secrets are not configured." },
        500,
      );
    }

    const actualSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (actualSecret !== webhookSecret)
      return jsonResponse({ error: "Unauthorized" }, 401);

    const update = (await req.json()) as TelegramUpdate;
    const { error: processedError } = await supabase
      .from("telegram_processed_updates")
      .insert({ update_id: update.update_id });
    if (processedError && processedError.code === "23505")
      return jsonResponse({ ok: true, duplicate: true });
    if (processedError) throw processedError;

    const message = update.message;
    const text = message?.text?.trim();
    if (!message || !text || !message.from)
      return jsonResponse({ ok: true, ignored: true });
    const chatId = asText(message.chat.id);

    if (message.chat.type !== "private") {
      await sendMessage(chatId, "Please message this bot in a private chat.");
      return jsonResponse({ ok: true });
    }

    if (text.startsWith("/start")) {
      await sendMessage(
        chatId,
        "Open Budget Manager Settings, generate a Telegram link code, then send /link 123456 here.",
      );
      return jsonResponse({ ok: true });
    }

    const linkMatch = text.match(/^\/link\s+(\d{6})/);
    if (linkMatch) {
      await handleLink(message, linkMatch[1]);
      return jsonResponse({ ok: true });
    }

    const link = await getLink(message);
    if (!link) {
      await sendMessage(
        chatId,
        "This Telegram account is not linked yet. Open Budget Manager Settings and generate a link code.",
        asText(message.message_id),
      );
      return jsonResponse({ ok: true });
    }

    if (message.reply_to_message) await handleEdit(message, link, text);
    else await handleTransaction(message, link, text);

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
