import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.ts";
import {
  normalizeText,
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

type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type TemplateItem = {
  id: string;
  sort_order: number;
  type: "expense" | "income" | "transfer";
  amount: number | string;
  wallet_id: string | null;
  to_wallet_id: string | null;
  category_id: string | null;
  contact_id: string | null;
  description: string | null;
  date_offset_days: number | null;
};

type TransactionTemplate = {
  id: string;
  name: string;
  trigger_text: string;
  trigger_normalized: string;
  items?: TemplateItem[];
};

type AiParsedTransaction = {
  type?: "expense" | "income" | "transfer";
  amount?: number;
  walletName?: string | null;
  toWalletName?: string | null;
  categoryName?: string | null;
  contactName?: string | null;
  description?: string | null;
  date?: string | null;
  confidence?: number;
  reason?: string | null;
};

type ParsedOkTransaction = {
  ok: true;
  type: "expense" | "income" | "transfer";
  amount: number;
  date: string;
  description: string;
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  contactId: string | null;
  unmatched: string[];
  fieldConfidence?: Record<string, number>;
};

type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

type SendMessageOptions = {
  replyToMessageId?: string;
  replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] };
};

type FieldSuggestion = {
  id: string;
  name: string;
  confidence: number;
  reason: string;
};

type SpendingPatternProfile = {
  category?: FieldSuggestion;
  contact?: FieldSuggestion;
  wallet?: FieldSuggestion;
  examples: Array<{
    description: string;
    amount: number;
    categoryName?: string | null;
    contactName?: string | null;
    walletName?: string | null;
  }>;
};

type ReportRange = {
  start: string;
  end: string;
  labelVi: string;
  labelEn: string;
};

type ReportStatRow = {
  name: string;
  value: number;
};

type FinancialReportSummary = {
  range: ReportRange;
  languageIsVietnamese: boolean;
  transactionCount: number;
  totalExpense: number;
  totalIncome: number;
  net: number;
  topCategories: ReportStatRow[];
  topWallets: ReportStatRow[];
  topContacts: ReportStatRow[];
  monthly: ReportStatRow[];
  largestExpense?: {
    amount: number;
    description: string;
    categoryName: string;
  };
};

type CasualChatResult = {
  isCasual: boolean;
  reply: string | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const timeZone = Deno.env.get("BOT_TIME_ZONE") || "Asia/Ho_Chi_Minh";
const aiParseApiKey = Deno.env.get("AI_PARSE_API_KEY") || "";
const aiParseBaseUrl =
  Deno.env.get("AI_PARSE_BASE_URL") ||
  "https://openrouter.ai/api/v1/chat/completions";
const aiParseModel = Deno.env.get("AI_PARSE_MODEL") || "openrouter/free";
const aiParseMode = Deno.env.get("AI_PARSE_MODE") || "assist";
const webAppUrl =
  Deno.env.get("WEB_APP_URL") || "https://budget-manager-a4482.web.app";

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

function normalizedPlainText(text: string) {
  return normalizeText(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasMoneySignal(text: string) {
  const normalized = normalizedPlainText(text);
  return (
    /(?:^|\s)(?:\d+(?:[.,]\d+)?)(?:\s*)(?:k|tr|m|mil|million|nghin|ngan|ngàn|trieu|triệu|usd|dollar|dollars|vnd|dong|đ|₫)(?:\s|$)/i.test(
      text,
    ) ||
    /[$₫]\s*\d+/i.test(text) ||
    /\b\d{4,}\b/.test(normalized)
  );
}

function hasFinanceSignal(text: string) {
  const normalized = normalizedPlainText(text);
  return (
    hasMoneySignal(text) ||
    /\b(an|uống|uong|mua|tra|trả|thanh toan|chi|tieu|tiêu|nhan|nhận|luong|lương|thu|refund|salary|income|expense|spent|paid|pay|buy|bought|transfer|chuyen|chuyển|tu|từ|sang|vao|vào|bang|bằng|vi|ví|wallet|cash|card|bank|tai khoan|tài khoản|momo|techcombank|vcb|mb|visa|date|ngay|ngày|hom qua|hôm qua|today|yesterday)\b/i.test(
      normalized,
    )
  );
}

function localCasualReply(text: string, languageIsVietnamese: boolean) {
  const normalized = normalizedPlainText(text);

  if (
    /\b(hi|hello|hey|xin chao|xin chào|chao|chào|alo|yo)\b/i.test(normalized)
  ) {
    return languageIsVietnamese
      ? "Hello hello, mình đây 😄 Muốn ghi chi tiêu hay hỏi report thì cứ nhắn tự nhiên nha."
      : "Hey hey, I’m here 😄 Send me a transaction or ask for a spending report anytime.";
  }

  if (/\b(cam on|cảm ơn|thanks|thank you|tks|thank)\b/i.test(normalized)) {
    return languageIsVietnamese
      ? "Không có gì nha, cứ quăng giao dịch vào đây, mình ghi giúp cho gọn 😄"
      : "Anytime. Drop transactions here and I’ll keep things tidy for you 😄";
  }

  if (
    /\b(help|giup|giúp|lam duoc gi|làm được gì|ban la ai|bạn là ai|what can you do|huong dan|hướng dẫn)\b/i.test(
      normalized,
    )
  ) {
    return languageIsVietnamese
      ? [
          "Mình là bot ghi chi tiêu kiêm trợ lý tài chính nhẹ nhàng của bạn 🙂",
          "",
          "Bạn có thể nhắn kiểu:",
          "- ăn trưa 85k bằng tiền mặt",
          "- nhận lương 20tr vào tài khoản",
          "- tóm tắt chi tiêu 7 ngày qua",
          "- tạo template Nhận lương tháng",
        ].join("\n")
      : [
          "I’m your transaction bot plus a chill personal-finance sidekick 🙂",
          "",
          "Try messages like:",
          "- lunch 85k from cash",
          "- received salary 20m to bank",
          "- summarize spending last 7 days",
          "- create template Monthly salary",
        ].join("\n");
  }

  return languageIsVietnamese
    ? "Mình nghe nè 😄 Nếu muốn ghi chi tiêu, bạn nhắn kèm số tiền và ví. Nếu muốn xem tình hình tiền bạc, cứ hỏi kiểu “tóm tắt chi tiêu tháng này”."
    : "I’m listening 😄 For transactions, include amount and wallet. For insights, ask something like “summarize my spending this month”.";
}

async function buildCasualChatReply(
  text: string,
  link?: any,
): Promise<CasualChatResult> {
  const languageIsVietnamese = detectVietnamese(text);
  const normalized = normalizedPlainText(text);

  const localLooksCasual =
    /\b(hi|hello|hey|xin chao|xin chào|chao|chào|alo|yo|cam on|cảm ơn|thanks|thank you|tks|help|giup|giúp|lam duoc gi|làm được gì|ban la ai|bạn là ai|what can you do|huong dan|hướng dẫn)\b/i.test(
      normalized,
    );

  if (hasFinanceSignal(text) && !localLooksCasual) {
    return { isCasual: false, reply: null };
  }

  if (!aiParseApiKey || aiParseMode === "local" || aiParseMode === "off") {
    return {
      isCasual: localLooksCasual || !hasFinanceSignal(text),
      reply: localCasualReply(text, languageIsVietnamese),
    };
  }

  const prompt = {
    task: "Classify whether this Telegram message is casual conversation instead of a transaction/template/report/edit command. If casual, write a short reply.",
    message: text,
    userLinked: Boolean(link?.user_id),
    language: languageIsVietnamese ? "Vietnamese" : "English",
    botRole:
      "Budget Manager Telegram bot: records transactions, manages templates, and answers personal-finance reports.",
    rules: [
      "If the message includes a money amount, wallet, transfer, report request, template command, or edit/delete instruction, set isCasual=false.",
      "If it is greeting, thanks, help, small talk, encouragement, or a general non-finance chat, set isCasual=true.",
      "When replying in Vietnamese, use friendly light Gen Z tone, supportive, not cringe, max 2 emojis.",
      "Do not pretend you can do things outside Budget Manager.",
      "Keep reply under 5 short lines.",
    ],
    outputSchema: {
      isCasual: "boolean",
      reply: "string|null",
    },
  };

  const response = await fetch(aiParseBaseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiParseApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": webAppUrl,
      "X-Title": "Budget Manager Telegram Bot",
    },
    body: JSON.stringify({
      model: aiParseModel,
      messages: [
        {
          role: "system",
          content:
            "You are a warm, lightly Gen Z Telegram finance assistant. Classify intent carefully. Output valid compact JSON only.",
        },
        { role: "user", content: JSON.stringify(prompt) },
      ],
      temperature: 0.45,
    }),
  });

  if (!response.ok) {
    return {
      isCasual: localLooksCasual || !hasFinanceSignal(text),
      reply: localCasualReply(text, languageIsVietnamese),
    };
  }

  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content || "";
  const json = extractJsonObject(content) as CasualChatResult | null;
  if (!json || typeof json.isCasual !== "boolean") {
    return {
      isCasual: localLooksCasual || !hasFinanceSignal(text),
      reply: localCasualReply(text, languageIsVietnamese),
    };
  }

  return {
    isCasual: json.isCasual,
    reply: json.reply || localCasualReply(text, languageIsVietnamese),
  };
}

function formatAmount(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}₫`;
}

function todayInTimeZone(now = new Date(), tz = timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function transactionDate(offsetDays = 0) {
  return addDays(todayInTimeZone(), offsetDays);
}

function toUtcDate(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function startOfMonth(dateString: string) {
  return `${dateString.slice(0, 7)}-01`;
}

function addMonths(dateString: string, months: number) {
  const date = toUtcDate(startOfMonth(dateString));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function endOfPreviousMonth(dateString: string) {
  return addDays(startOfMonth(dateString), -1);
}

async function sendMessage(
  chatId: string,
  text: string,
  replyToMessageIdOrOptions?: string | SendMessageOptions,
) {
  const options =
    typeof replyToMessageIdOrOptions === "string"
      ? { replyToMessageId: replyToMessageIdOrOptions }
      : replyToMessageIdOrOptions || {};
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: options.replyToMessageId
          ? Number(options.replyToMessageId)
          : undefined,
        allow_sending_without_reply: true,
        reply_markup: options.replyMarkup,
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.ok)
    throw new Error(payload.description || "Telegram sendMessage failed.");
  return payload.result as TelegramMessage;
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(
    `https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    },
  );
}

async function editMessageText(
  chatId: string,
  messageId: string,
  text: string,
  replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] },
) {
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/editMessageText`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: Number(messageId),
        text,
        reply_markup: replyMarkup,
      }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok)
    throw new Error(payload?.description || "Telegram editMessageText failed.");
  return payload.result as TelegramMessage;
}

async function loadContext(userId: string, defaultWalletId?: string | null) {
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
    userId,
    wallets: wallets || [],
    categories: categories || [],
    contacts: contacts || [],
    defaultWalletId,
    timeZone,
  };
}

async function loadTemplates(userId: string) {
  const { data, error } = await supabase
    .from("telegram_transaction_templates")
    .select(
      "id,name,trigger_text,trigger_normalized,items:telegram_transaction_template_items(*)",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((template: TransactionTemplate) => ({
    ...template,
    items: [...(template.items || [])].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0),
    ),
  }));
}

async function loadAiMemories(userId: string) {
  const { data, error } = await supabase
    .from("telegram_ai_parse_memories")
    .select("source_text,parser,parsed_payload,created_at,transaction_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return data || [];
}

async function rememberParse(
  userId: string,
  sourceText: string,
  parser: "local" | "ai" | "template",
  parsedPayload: Record<string, unknown>,
  transactionId?: string | null,
) {
  await supabase.from("telegram_ai_parse_memories").insert({
    user_id: userId,
    source_text: sourceText,
    normalized_text: normalizeText(sourceText),
    parser,
    parsed_payload: parsedPayload,
    transaction_id: transactionId || null,
  });
}

function parsedPayload(parsed: ParsedOkTransaction) {
  return {
    type: parsed.type,
    amount: parsed.amount,
    wallet_id: parsed.walletId,
    to_wallet_id: parsed.toWalletId,
    category_id: parsed.categoryId,
    contact_id: parsed.contactId,
    description: parsed.description,
    date: parsed.date,
  };
}

function compactMemories(memories: any[]) {
  return memories.slice(0, 14).map((memory) => {
    const parsed = memory.parsed_payload || {};
    return {
      userWording: memory.source_text,
      parser: memory.parser,
      isCorrection: Boolean(parsed.corrected_by),
      correctedBy: parsed.corrected_by || null,
      result: {
        type: parsed.type,
        amount: parsed.amount,
        walletId: parsed.wallet_id,
        toWalletId: parsed.to_wallet_id,
        categoryId: parsed.category_id,
        contactId: parsed.contact_id,
        description: parsed.description,
        date: parsed.date,
      },
    };
  });
}

function isMissingWalletReason(reason = "") {
  return normalizeText(reason).includes("could not match a wallet");
}

async function savePendingDraft(
  link: any,
  message: TelegramMessage,
  sourceText: string,
  parsed: ParsedOkTransaction,
  missingFields: string[] = [],
) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await supabase.from("telegram_pending_transaction_drafts").upsert(
    {
      user_id: link.user_id,
      telegram_user_id: asText(message.from?.id),
      chat_id: asText(message.chat.id),
      source_message_id: asText(message.message_id),
      source_text: sourceText,
      parsed_payload: {
        ...parsedPayload(parsed),
        missing_fields: missingFields,
        field_confidence: parsed.fieldConfidence || {},
      },
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id,chat_id" },
  );
}

async function loadPendingDraft(message: TelegramMessage) {
  const { data, error } = await supabase
    .from("telegram_pending_transaction_drafts")
    .select("*")
    .eq("telegram_user_id", asText(message.from?.id))
    .eq("chat_id", asText(message.chat.id))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadPendingDraftForTelegramUser(
  telegramUserId: string,
  chatId: string,
) {
  const { data, error } = await supabase
    .from("telegram_pending_transaction_drafts")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("chat_id", chatId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function clearPendingDraft(message: TelegramMessage) {
  await supabase
    .from("telegram_pending_transaction_drafts")
    .delete()
    .eq("telegram_user_id", asText(message.from?.id))
    .eq("chat_id", asText(message.chat.id));
}

function keyboardRows(
  items: Array<{ id: string; name: string }>,
  prefix: string,
) {
  const buttons = items.slice(0, 10).map((item) => ({
    text: item.name,
    callback_data: `${prefix}:${item.id}`,
  }));
  const rows: InlineKeyboardButton[][] = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return rows;
}

function categoryOptions(context: Awaited<ReturnType<typeof loadContext>>) {
  const expenseCategories = context.categories.filter(
    (category: any) => !category.type || category.type === "expense",
  );
  const childCategories = expenseCategories.filter(
    (category: any) => category.parent_id,
  );
  return (childCategories.length ? childCategories : expenseCategories).slice(
    0,
    10,
  );
}

function walletOptions(context: Awaited<ReturnType<typeof loadContext>>) {
  return context.wallets
    .filter((wallet: any) => !wallet.type || wallet.type !== "deleted")
    .slice(0, 10);
}

async function askDraftField(
  chatId: string,
  replyToMessageId: string | undefined,
  parsed: ParsedOkTransaction,
  field: "wallet" | "category",
  context: Awaited<ReturnType<typeof loadContext>>,
  languageIsVietnamese: boolean,
) {
  const summary = `${formatAmount(parsed.amount)} - ${parsed.description || "-"}`;
  if (field === "wallet") {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? `Mình hiểu giao dịch này rồi: ${summary} 👍\nChọn ví để mình lưu nha:`
        : `I understood this transaction: ${summary} 👍\nPick the wallet to save it:`,
      {
        replyToMessageId,
        replyMarkup: {
          inline_keyboard: keyboardRows(walletOptions(context), "draft:wallet"),
        },
      },
    );
    return;
  }

  const rows = keyboardRows(categoryOptions(context), "draft:category");
  rows.push([
    {
      text: languageIsVietnamese ? "Bỏ qua danh mục" : "Skip category",
      callback_data: "draft:category:skip",
    },
  ]);
  await sendMessage(
    chatId,
    languageIsVietnamese
      ? `Mình chưa chắc danh mục cho: ${summary}\nChọn nhanh một danh mục nha, hoặc bỏ qua nếu chưa cần.`
      : `I’m not fully sure about the category for: ${summary}\nPick one quickly, or skip it for now.`,
    {
      replyToMessageId,
      replyMarkup: { inline_keyboard: rows },
    },
  );
}

function parsedFromDraftPayload(payload: any): ParsedOkTransaction {
  return {
    ok: true,
    type: payload.type || "expense",
    amount: Number(payload.amount || 0),
    walletId: payload.wallet_id || "",
    toWalletId: payload.to_wallet_id || null,
    categoryId: payload.category_id || null,
    contactId: payload.contact_id || null,
    description: payload.description || "",
    date: payload.date || todayInTimeZone(),
    unmatched: Array.isArray(payload.missing_fields)
      ? payload.missing_fields
      : [],
    fieldConfidence: payload.field_confidence || {},
  };
}

async function saveParsedTransactionFromDraft(
  callback: TelegramCallbackQuery,
  link: any,
  draft: any,
  parsed: ParsedOkTransaction,
) {
  const chatId = asText(callback.message?.chat.id);
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

  await rememberParse(
    link.user_id,
    draft.source_text,
    "local",
    parsedPayload(parsed),
    tx.id,
  );
  const reply = await sendMessage(
    chatId,
    summarizeTransaction(
      tx,
      detectVietnamese(draft.source_text),
      parsed.unmatched,
    ),
    draft.source_message_id,
  );
  await supabase.from("telegram_transaction_events").insert({
    user_id: link.user_id,
    telegram_user_id: asText(callback.from.id),
    chat_id: chatId,
    source_message_id: draft.source_message_id,
    bot_message_id: asText(reply.message_id),
    transaction_id: tx.id,
    source_text: draft.source_text,
  });
  await supabase
    .from("telegram_pending_transaction_drafts")
    .delete()
    .eq("id", draft.id)
    .eq("user_id", link.user_id);
}

function compactItems(
  items: Array<{ name?: string | null; type?: string | null }>,
) {
  return items
    .map((item) => (item.type ? `${item.name} (${item.type})` : item.name))
    .filter(Boolean);
}

function importantTokens(text: string) {
  const stopWords = new Set([
    "bang",
    "bằng",
    "from",
    "with",
    "vao",
    "vào",
    "into",
    "tu",
    "từ",
    "sang",
    "to",
    "hom",
    "hôm",
    "nay",
    "qua",
    "today",
    "yesterday",
    "ngay",
    "ngày",
    "tien",
    "tiền",
    "vi",
    "ví",
    "wallet",
    "tai",
    "khoan",
    "tài",
    "khoản",
  ]);
  return normalizedPlainText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !/^\d/.test(token))
    .filter((token) => !stopWords.has(token));
}

function scoreTextSimilarity(sourceText: string, candidateText: string) {
  const sourceTokens = importantTokens(sourceText);
  const candidateTokens = new Set(importantTokens(candidateText));
  if (sourceTokens.length === 0 || candidateTokens.size === 0) return 0;
  const shared = sourceTokens.filter((token) => candidateTokens.has(token));
  const phraseBonus =
    normalizeText(candidateText).includes(normalizeText(sourceText)) ||
    normalizeText(sourceText).includes(normalizeText(candidateText))
      ? 2
      : 0;
  return shared.length + phraseBonus;
}

function suggestionFromScores(
  scores: Map<
    string,
    { score: number; count: number; name: string; reason: string }
  >,
  minimumConfidence = 0.55,
) {
  const ranked = [...scores.entries()].sort((a, b) => {
    if (b[1].score !== a[1].score) return b[1].score - a[1].score;
    return b[1].count - a[1].count;
  });
  const best = ranked[0];
  const second = ranked[1];
  if (!best) return undefined;
  const confidence = Math.min(
    0.95,
    0.42 +
      best[1].score * 0.08 +
      best[1].count * 0.03 +
      (second ? Math.max(0, best[1].score - second[1].score) * 0.04 : 0.08),
  );
  if (confidence < minimumConfidence) return undefined;
  return {
    id: best[0],
    name: best[1].name,
    confidence: Math.round(confidence * 100) / 100,
    reason: best[1].reason,
  };
}

function addSuggestionScore(
  scores: Map<
    string,
    { score: number; count: number; name: string; reason: string }
  >,
  id: string | null | undefined,
  name: string | null | undefined,
  score: number,
  reason: string,
) {
  if (!id || !name || score <= 0) return;
  const current = scores.get(id) || { score: 0, count: 0, name, reason };
  scores.set(id, {
    score: current.score + score,
    count: current.count + 1,
    name: current.name || name,
    reason: current.reason || reason,
  });
}

async function loadSpendingPatternProfile(
  userId: string,
  text: string,
): Promise<SpendingPatternProfile> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id,type,amount,description,wallet_id,category_id,contact_id,wallet:wallets!wallet_id(name),category:categories(name),contact:contacts(name)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) return { examples: [] };

  const categoryScores = new Map<
    string,
    { score: number; count: number; name: string; reason: string }
  >();
  const contactScores = new Map<
    string,
    { score: number; count: number; name: string; reason: string }
  >();
  const walletScores = new Map<
    string,
    { score: number; count: number; name: string; reason: string }
  >();
  const examples: SpendingPatternProfile["examples"] = [];

  (data || []).forEach((row: any) => {
    const description = row.description || "";
    const similarity = scoreTextSimilarity(text, description);
    if (similarity <= 0) return;
    const score = similarity + (row.type === "expense" ? 0.5 : 0);
    if (examples.length < 6) {
      examples.push({
        description,
        amount: Number(row.amount || 0),
        categoryName: row.category?.name || null,
        contactName: row.contact?.name || null,
        walletName: row.wallet?.name || null,
      });
    }
    addSuggestionScore(
      categoryScores,
      row.category_id,
      row.category?.name,
      score,
      `similar past note: ${description}`,
    );
    addSuggestionScore(
      contactScores,
      row.contact_id,
      row.contact?.name,
      score,
      `similar past note: ${description}`,
    );
    addSuggestionScore(
      walletScores,
      row.wallet_id,
      row.wallet?.name,
      Math.max(0, score - 0.5),
      `similar past note: ${description}`,
    );
  });

  return {
    category: suggestionFromScores(categoryScores),
    contact: suggestionFromScores(contactScores),
    wallet: suggestionFromScores(walletScores, 0.65),
    examples,
  };
}

function findByName<T extends { name?: string | null }>(
  items: T[],
  name?: string | null,
) {
  const normalized = normalizeText(name || "");
  if (!normalized) return null;
  return (
    items.find((item) => normalizeText(item.name || "") === normalized) ||
    items.find((item) => {
      const itemName = normalizeText(item.name || "");
      return (
        itemName &&
        (normalized.includes(itemName) || itemName.includes(normalized))
      );
    }) ||
    null
  );
}

function extractJsonObject(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || value;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (_error) {
    return null;
  }
}

function aiToParsedTransaction(
  ai: AiParsedTransaction,
  text: string,
  context: Awaited<ReturnType<typeof loadContext>>,
) {
  const requestedType = ai.type || "expense";
  const type = ["expense", "income", "transfer"].includes(requestedType)
    ? requestedType
    : "expense";
  const amount = Number(ai.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false as const,
      reason: detectVietnamese(text)
        ? "Mình chưa thấy số tiền trong câu này á. Thử nhắn kiểu “ăn trưa 85k bằng tiền mặt” nha 🙂"
        : "I could not spot the amount yet. Try something like “lunch 85k from cash” 🙂",
    };
  }

  const wallet = findByName(context.wallets, ai.walletName) || null;
  const toWallet =
    type === "transfer" ? findByName(context.wallets, ai.toWalletName) : null;
  const walletId = wallet?.id || context.defaultWalletId || null;
  if (!walletId) {
    return {
      ok: false as const,
      reason: detectVietnamese(text)
        ? "Mình hiểu ý rồi, nhưng chưa match được ví. Bạn thêm kiểu “bằng tiền mặt”, “vào Techcombank”, hoặc “from cash” nha."
        : "I got the idea, but could not match a wallet yet. Please add one like “from cash” or “to Techcombank”.",
    };
  }
  if (type === "transfer" && !toWallet) {
    return {
      ok: false as const,
      reason: detectVietnamese(text)
        ? "Giao dịch chuyển tiền cần ví nhận nữa nha. Bạn gửi lại kiểu “chuyển 2tr từ tiền mặt sang tiết kiệm”."
        : "A transfer needs a destination wallet too. Please resend like “transfer 2m from cash to savings”.",
    };
  }

  const category =
    type === "transfer"
      ? null
      : findByName(context.categories, ai.categoryName);
  const contact = findByName(context.contacts, ai.contactName);
  const today = todayInTimeZone();
  const date = /^20\d{2}-\d{2}-\d{2}$/.test(ai.date || "") ? ai.date! : today;

  return {
    ok: true as const,
    type,
    amount: Math.round(amount * 100) / 100,
    date,
    description: (ai.description || text).trim(),
    walletId,
    toWalletId: toWallet?.id || null,
    categoryId: category?.id || null,
    contactId: contact?.id || null,
    unmatched: [!category && type !== "transfer" ? "category" : null].filter(
      Boolean,
    ) as string[],
  };
}

async function parseTransactionWithAi(
  text: string,
  context: Awaited<ReturnType<typeof loadContext>>,
  memories: any[],
  profile: SpendingPatternProfile,
) {
  if (!aiParseApiKey) return null;

  const prompt = {
    task: "Parse one personal finance Telegram message into one transaction JSON. Preserve the user's language in description. Infer category/contact/wallet from meaning, Vietnamese wording, prior corrected examples, and similar historical transactions. Recent corrections and similar past transactions are stronger than generic guesses. Do not invent wallets/categories/contacts outside provided lists. Return JSON only.",
    message: text,
    today: todayInTimeZone(),
    allowedTypes: ["expense", "income", "transfer"],
    wallets: compactItems(context.wallets),
    categories: compactItems(context.categories),
    contacts: compactItems(context.contacts),
    recentUserExamples: compactMemories(memories),
    learnedPatternsFromPastTransactions: profile,
    learningRules: [
      "If a past correction maps a phrase to a category/contact, reuse that mapping for similar future wording.",
      "If similar historical transactions strongly point to a category/contact/wallet, reuse that mapping unless the current message says otherwise.",
      "Treat messages with two wallets connected by Vietnamese words like từ/sang/qua/vào/về or English from/to/into as transfer, not expense.",
      "Keep description close to the user's wording; remove only amount/date/wallet connector words.",
      "If the user mentions a person/company/team, prefer matching it to contacts when available.",
      "If unsure between category and contact, choose null instead of inventing.",
    ],
    outputSchema: {
      type: "expense|income|transfer",
      amount: "number in the transaction currency",
      walletName: "source wallet name from provided wallets",
      toWalletName: "destination wallet name for transfer, else null",
      categoryName: "category name from provided categories or null",
      contactName: "contact name from provided contacts or null",
      description: "short natural description, same language as user",
      date: "YYYY-MM-DD or null",
      confidence: "0 to 1",
      reason: "short reason",
    },
  };

  const response = await fetch(aiParseBaseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiParseApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": webAppUrl,
      "X-Title": "Budget Manager Telegram Bot",
    },
    body: JSON.stringify({
      model: aiParseModel,
      messages: [
        {
          role: "system",
          content:
            "You are a precise bilingual Vietnamese/English finance parser. Output valid compact JSON only. Never add markdown.",
        },
        { role: "user", content: JSON.stringify(prompt) },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content || "";
  const json = extractJsonObject(content) as AiParsedTransaction | null;
  if (!json || Number(json.confidence || 0) < 0.45) return null;
  return aiToParsedTransaction(json, text, context);
}

function applySpendingPatternProfile(
  parsed: ParsedOkTransaction,
  profile: SpendingPatternProfile,
  context: Awaited<ReturnType<typeof loadContext>>,
  text: string,
): ParsedOkTransaction {
  const next = {
    ...parsed,
    unmatched: [...parsed.unmatched],
    fieldConfidence: { ...(parsed.fieldConfidence || {}) },
  };
  if (
    next.type !== "transfer" &&
    !next.categoryId &&
    profile.category &&
    profile.category.confidence >= 0.55
  ) {
    next.categoryId = profile.category.id;
    next.fieldConfidence.category = profile.category.confidence;
    next.unmatched = next.unmatched.filter((field) => field !== "category");
  }
  if (
    !next.contactId &&
    profile.contact &&
    profile.contact.confidence >= 0.55
  ) {
    next.contactId = profile.contact.id;
    next.fieldConfidence.contact = profile.contact.confidence;
  }
  const walletWasOnlyFallback =
    Boolean(context.defaultWalletId) &&
    next.walletId === context.defaultWalletId &&
    !context.wallets.some((wallet: any) =>
      normalizeText(text).includes(normalizeText(wallet.name || "")),
    );
  if (
    profile.wallet &&
    profile.wallet.confidence >= 0.7 &&
    (!next.walletId || walletWasOnlyFallback)
  ) {
    next.walletId = profile.wallet.id;
    next.fieldConfidence.wallet = profile.wallet.confidence;
  }
  return next;
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
      default_wallet_id: linkCode.default_wallet_id || null,
    });
  if (insertError) throw insertError;

  await supabase
    .from("telegram_link_codes")
    .update({ used_at: now })
    .eq("id", linkCode.id);
  await sendMessage(
    chatId,
    "Linked rồi nha ✅\nTừ giờ cứ nhắn tự nhiên kiểu “ăn trưa 85k bằng tiền mặt”, tạo template, hoặc hỏi mình “tóm tắt chi tiêu tháng này”. Mình lo phần ghi chép cho gọn 😄",
    asText(message.message_id),
  );
}

async function getLinkByTelegramUserId(telegramUserId: string) {
  const { data, error } = await supabase
    .from("telegram_user_links")
    .select("user_id, telegram_user_id, chat_id, default_wallet_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getLink(message: TelegramMessage) {
  return getLinkByTelegramUserId(asText(message.from?.id));
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
      ? `\n${languageIsVietnamese ? "Mình chưa khớp chắc" : "Not confidently matched"}: ${unmatched.join(", ")}`
      : "";
  return languageIsVietnamese
    ? `Done, mình ghi rồi nha ✅\n${typeLabel}: ${formatAmount(Number(tx.amount))}\nNgày: ${tx.date}\nMô tả: ${tx.description || "-"}${warnings}\n\nCần chỉnh thì reply tin này với “sửa ...” hoặc “xóa”. Mình sẽ học từ lần sửa đó để lần sau bắt vibe đúng hơn.`
    : `Saved for you ✅\n${typeLabel}: ${formatAmount(Number(tx.amount))}\nDate: ${tx.date}\nDescription: ${tx.description || "-"}${warnings}\n\nIf you need to fix it, reply with “change ...” or “delete”. I’ll learn from the correction for next time.`;
}

function itemSummary(item: TemplateItem, languageIsVietnamese: boolean) {
  const label =
    item.type === "income"
      ? languageIsVietnamese
        ? "thu"
        : "income"
      : item.type === "transfer"
        ? languageIsVietnamese
          ? "chuyển"
          : "transfer"
        : languageIsVietnamese
          ? "chi"
          : "expense";
  return `${label} ${formatAmount(Number(item.amount))}${item.description ? ` - ${item.description}` : ""}`;
}

function findTemplateMatch(templates: TransactionTemplate[], text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  return (
    templates.find((template) => template.trigger_normalized === normalized) ||
    templates.find((template) => normalizeText(template.name) === normalized) ||
    templates.find((template) => {
      const trigger =
        template.trigger_normalized || normalizeText(template.trigger_text);
      return (
        trigger.length >= 4 &&
        (normalized.includes(trigger) || trigger.includes(normalized))
      );
    }) ||
    null
  );
}

async function listTemplates(message: TelegramMessage, link: any) {
  const chatId = asText(message.chat.id);
  const templates = await loadTemplates(link.user_id);
  const languageIsVietnamese = detectVietnamese(message.text || "");
  if (templates.length === 0) {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? "Bạn chưa có template nào. Tạo bằng: /template add Nhận lương tháng => nhận lương 20tr vào Techcombank; cho mẹ 5tr từ tài khoản"
        : "You do not have templates yet. Create one with: /template add Monthly salary => received salary 20m to Techcombank; give mom 5m from Techcombank",
      asText(message.message_id),
    );
    return;
  }

  const lines = templates.map((template, index) => {
    const items = (template.items || [])
      .map((item) => `   - ${itemSummary(item, languageIsVietnamese)}`)
      .join("\n");
    return `${index + 1}. ${template.name} (${template.items?.length || 0})\n${items}`;
  });
  await sendMessage(
    chatId,
    `${languageIsVietnamese ? "Template hiện có" : "Templates"}:\n${lines.join("\n\n")}`,
    asText(message.message_id),
  );
}

async function deleteTemplateByName(
  message: TelegramMessage,
  link: any,
  rawName: string,
) {
  const chatId = asText(message.chat.id);
  const normalized = normalizeText(rawName);
  const templates = await loadTemplates(link.user_id);
  const template =
    templates[Number(rawName) - 1] ||
    templates.find((item) => item.trigger_normalized === normalized) ||
    templates.find((item) => normalizeText(item.name) === normalized);

  if (!template) {
    await sendMessage(
      chatId,
      detectVietnamese(message.text || "")
        ? "Mình không tìm thấy template đó. Gửi /templates để xem danh sách."
        : "I could not find that template. Send /templates to list them.",
      asText(message.message_id),
    );
    return;
  }

  const { error } = await supabase
    .from("telegram_transaction_templates")
    .delete()
    .eq("id", template.id)
    .eq("user_id", link.user_id);
  if (error) throw error;
  await sendMessage(
    chatId,
    `${detectVietnamese(message.text || "") ? "Đã xóa template" : "Deleted template"}: ${template.name}`,
    asText(message.message_id),
  );
}

function parseTemplateCreate(text: string) {
  const normalized = normalizeText(text);
  const startsWithCommand =
    normalized.startsWith("/template add ") ||
    normalized.startsWith("/template tao ") ||
    normalized.startsWith("/template create ") ||
    normalized.startsWith("tao mau ") ||
    normalized.startsWith("tao template ") ||
    normalized.startsWith("create template ");
  if (!startsWithCommand) return null;

  let cleaned = text
    .replace(/^\/template\s+(?:add|create|tao|tạo)\s+/i, "")
    .replace(/^(?:tạo|tao)\s+(?:mẫu|mau|template)\s+/i, "");

  const naturalMatch = cleaned.match(
    /^(.+?)\s+(?:gồm|gom|including|with)\s+(.+)/i,
  );
  if (naturalMatch) cleaned = `${naturalMatch[1]} => ${naturalMatch[2]}`;

  const parts = cleaned.split(/=>|:/);
  if (parts.length < 2) return null;
  const name = parts.shift()?.trim() || "";
  const itemTexts = parts
    .join(":")
    .split(/;|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!name || itemTexts.length === 0) return null;
  return { name, itemTexts };
}

async function createTemplateFromMessage(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  const chatId = asText(message.chat.id);
  const parsedCreate = parseTemplateCreate(text);
  if (!parsedCreate) return false;

  const context = await loadContext(link.user_id, link.default_wallet_id);
  const parsedItems = parsedCreate.itemTexts.map((itemText) => ({
    source: itemText,
    parsed: parseTelegramTransaction(itemText, context),
  }));
  const failed = parsedItems.find((item) => !item.parsed.ok);
  if (failed || parsedItems.some((item) => !item.parsed.ok)) {
    await sendMessage(
      chatId,
      `Mình chưa hiểu một dòng trong template: "${failed?.source || ""}". Hãy viết mỗi dòng như một giao dịch bình thường, ví dụ "nhận lương 20tr vào Techcombank".`,
      asText(message.message_id),
    );
    return true;
  }

  const triggerNormalized = normalizeText(parsedCreate.name);
  const { data: existing, error: findError } = await supabase
    .from("telegram_transaction_templates")
    .select("id")
    .eq("user_id", link.user_id)
    .eq("trigger_normalized", triggerNormalized)
    .maybeSingle();
  if (findError) throw findError;

  let templateId = existing?.id;
  if (templateId) {
    const { error: updateError } = await supabase
      .from("telegram_transaction_templates")
      .update({
        name: parsedCreate.name,
        trigger_text: parsedCreate.name,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("user_id", link.user_id);
    if (updateError) throw updateError;
    const { error: deleteItemsError } = await supabase
      .from("telegram_transaction_template_items")
      .delete()
      .eq("template_id", templateId)
      .eq("user_id", link.user_id);
    if (deleteItemsError) throw deleteItemsError;
  } else {
    const { data: template, error: insertError } = await supabase
      .from("telegram_transaction_templates")
      .insert({
        user_id: link.user_id,
        name: parsedCreate.name,
        trigger_text: parsedCreate.name,
        trigger_normalized: triggerNormalized,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    templateId = template.id;
  }

  const rows = parsedItems.map((item, index) => {
    const parsed = item.parsed as Extract<
      ReturnType<typeof parseTelegramTransaction>,
      { ok: true }
    >;
    return {
      template_id: templateId,
      user_id: link.user_id,
      sort_order: index,
      type: parsed.type,
      amount: parsed.amount,
      wallet_id: parsed.walletId,
      to_wallet_id: parsed.toWalletId,
      category_id: parsed.categoryId,
      contact_id: parsed.contactId,
      description: parsed.description,
      date_offset_days: 0,
    };
  });
  const { error: itemError } = await supabase
    .from("telegram_transaction_template_items")
    .insert(rows);
  if (itemError) throw itemError;

  await sendMessage(
    chatId,
    `Đã lưu template "${parsedCreate.name}" với ${rows.length} giao dịch. Lần sau chỉ cần nhắn: ${parsedCreate.name}`,
    asText(message.message_id),
  );
  return true;
}

async function runTemplate(
  message: TelegramMessage,
  link: any,
  template: TransactionTemplate,
) {
  const chatId = asText(message.chat.id);
  const items = template.items || [];
  if (items.length === 0) {
    await sendMessage(
      chatId,
      `Template "${template.name}" chưa có giao dịch nào.`,
      asText(message.message_id),
    );
    return;
  }

  const rows = items.map((item) => ({
    user_id: link.user_id,
    wallet_id: item.wallet_id,
    to_wallet_id: item.to_wallet_id,
    category_id: item.category_id,
    contact_id: item.contact_id,
    amount: item.amount,
    type: item.type,
    description: item.description || template.name,
    date: transactionDate(Number(item.date_offset_days || 0)),
    is_recurring: false,
    is_debt: false,
  }));
  const { data: transactions, error } = await supabase
    .from("transactions")
    .insert(rows)
    .select();
  if (error) throw error;

  const total = rows.reduce((sum, item) => sum + Number(item.amount), 0);
  const reply = await sendMessage(
    chatId,
    `Đã chạy template "${template.name}" và tạo ${rows.length} giao dịch.\nTổng giá trị: ${formatAmount(total)}\n${rows.map((item) => `- ${item.type}: ${formatAmount(Number(item.amount))} - ${item.description || "-"}`).join("\n")}`,
    asText(message.message_id),
  );

  await supabase.from("telegram_transaction_events").insert(
    (transactions || []).map((tx: any) => ({
      user_id: link.user_id,
      telegram_user_id: asText(message.from?.id),
      chat_id: chatId,
      source_message_id: asText(message.message_id),
      bot_message_id: asText(reply.message_id),
      transaction_id: tx.id,
      source_text: template.name,
    })),
  );

  await Promise.all(
    (transactions || []).map((tx: any, index: number) =>
      rememberParse(
        link.user_id,
        `${template.name} #${index + 1}`,
        "template",
        {
          template_id: template.id,
          type: tx.type,
          amount: tx.amount,
          wallet_id: tx.wallet_id,
          to_wallet_id: tx.to_wallet_id,
          category_id: tx.category_id,
          contact_id: tx.contact_id,
          description: tx.description,
          date: tx.date,
        },
        tx.id,
      ),
    ),
  );
}

async function handleTemplateCommand(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  const normalized = normalizeText(text);
  if (
    normalized === "/templates" ||
    normalized === "/template list" ||
    normalized === "danh sach mau" ||
    normalized === "danh sach template"
  ) {
    await listTemplates(message, link);
    return true;
  }

  const deleteMatch =
    text.match(/^\/template\s+(?:delete|remove|xoa|xóa)\s+(.+)/i) ||
    text.match(/^(?:xóa|xoa)\s+(?:mẫu|mau|template)\s+(.+)/i);
  if (deleteMatch) {
    await deleteTemplateByName(message, link, deleteMatch[1].trim());
    return true;
  }

  if (await createTemplateFromMessage(message, link, text)) return true;

  return false;
}

function looksLikeMoneyInput(text: string) {
  return /(?:[$₫]\s*)?\d+(?:[.,]\d+)?\s*(?:k|nghìn|nghin|ngàn|ngan|tr|triệu|trieu|m|million|usd|vnd|₫|dollars?)\b/i.test(
    text,
  );
}

function isReportRequest(text: string) {
  const normalized = normalizeText(text);
  const reportWords = [
    "tom tat",
    "bao cao",
    "thong ke",
    "phan tich",
    "chi nhieu",
    "chi tieu",
    "linh vuc",
    "danh muc nao",
    "top",
    "summary",
    "report",
    "analyze",
    "analysis",
    "spending",
    "spent",
    "expense",
    "compare",
    "so sanh",
  ];
  if (!reportWords.some((word) => normalized.includes(word))) return false;
  return (
    !looksLikeMoneyInput(text) ||
    /\b(bao cao|report|tom tat|summary|thong ke|top|so sanh|compare)\b/.test(
      normalized,
    )
  );
}

function parseReportRange(text: string) {
  const normalized = normalizeText(text);
  const today = todayInTimeZone();
  const monthCount = normalized.match(/\b(\d{1,2})\s*(?:thang|month|months)\b/);
  const dayCount = normalized.match(/\b(\d{1,3})\s*(?:ngay|day|days)\b/);

  if (/\b(30 ngay|1 thang qua|past month|last 30 days)\b/.test(normalized)) {
    return {
      start: addDays(today, -29),
      end: today,
      labelVi: "30 ngày qua",
      labelEn: "the last 30 days",
    };
  }

  if (/\b(thang truoc|last month)\b/.test(normalized)) {
    const start = addMonths(today, -1);
    return {
      start,
      end: endOfPreviousMonth(today),
      labelVi: "tháng trước",
      labelEn: "last month",
    };
  }

  if (/\b(thang nay|this month)\b/.test(normalized)) {
    return {
      start: startOfMonth(today),
      end: today,
      labelVi: "tháng này",
      labelEn: "this month",
    };
  }

  if (monthCount) {
    const months = Math.max(1, Math.min(Number(monthCount[1]), 12));
    return {
      start: startOfMonth(addMonths(today, -(months - 1))),
      end: today,
      labelVi: `${months} tháng gần đây`,
      labelEn: `the last ${months} months`,
    };
  }

  if (dayCount) {
    const days = Math.max(1, Math.min(Number(dayCount[1]), 365));
    return {
      start: addDays(today, -(days - 1)),
      end: today,
      labelVi: `${days} ngày qua`,
      labelEn: `the last ${days} days`,
    };
  }

  return {
    start: startOfMonth(today),
    end: today,
    labelVi: "tháng này",
    labelEn: "this month",
  };
}

function monthLabel(dateString: string) {
  return dateString.slice(0, 7);
}

function groupSum<T>(
  rows: T[],
  keyFn: (row: T) => string,
  valueFn: (row: T) => number,
) {
  const groups = new Map<string, number>();
  rows.forEach((row) => {
    const key = keyFn(row) || "Khác";
    groups.set(key, (groups.get(key) || 0) + valueFn(row));
  });
  return [...groups.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function reportLinesForTop(
  title: string,
  rows: Array<{ name: string; value: number }>,
  limit = 5,
) {
  if (rows.length === 0) return [`${title}: -`];
  return [
    `${title}:`,
    ...rows
      .slice(0, limit)
      .map(
        (row, index) => `${index + 1}. ${row.name}: ${formatAmount(row.value)}`,
      ),
  ];
}

function buildFinancialReportLines(summary: FinancialReportSummary) {
  const {
    range,
    languageIsVietnamese,
    transactionCount,
    totalExpense,
    totalIncome,
    net,
    topCategories,
    topWallets,
    topContacts,
    monthly,
    largestExpense,
  } = summary;
  const topCategory = topCategories[0];

  return languageIsVietnamese
    ? [
        `Báo cáo tài chính ${range.labelVi} 📊`,
        `${range.start} → ${range.end}`,
        "",
        `Tổng chi: ${formatAmount(totalExpense)}`,
        `Tổng thu: ${formatAmount(totalIncome)}`,
        `Dòng tiền ròng: ${formatAmount(net)}`,
        `Số giao dịch: ${transactionCount}`,
        "",
        topCategory
          ? `Chi nhiều nhất: ${topCategory.name} (${formatAmount(topCategory.value)})`
          : "Chi nhiều nhất: -",
        largestExpense
          ? `Khoản chi lớn nhất: ${formatAmount(largestExpense.amount)} - ${largestExpense.description || largestExpense.categoryName}`
          : "Khoản chi lớn nhất: -",
        "",
        ...reportLinesForTop("Top danh mục", topCategories),
        "",
        ...reportLinesForTop("Top ví chi tiêu", topWallets, 3),
        ...(topContacts.length
          ? ["", ...reportLinesForTop("Top người liên quan", topContacts, 3)]
          : []),
        ...(monthly.length > 1
          ? [
              "",
              "Theo tháng:",
              ...monthly.map(
                (item) => `- ${item.name}: ${formatAmount(item.value)}`,
              ),
            ]
          : []),
      ]
    : [
        `Financial report for ${range.labelEn} 📊`,
        `${range.start} -> ${range.end}`,
        "",
        `Total expense: ${formatAmount(totalExpense)}`,
        `Total income: ${formatAmount(totalIncome)}`,
        `Net cash flow: ${formatAmount(net)}`,
        `Transactions: ${transactionCount}`,
        "",
        topCategory
          ? `Highest spending area: ${topCategory.name} (${formatAmount(topCategory.value)})`
          : "Highest spending area: -",
        largestExpense
          ? `Largest expense: ${formatAmount(largestExpense.amount)} - ${largestExpense.description || largestExpense.categoryName}`
          : "Largest expense: -",
        "",
        ...reportLinesForTop("Top categories", topCategories),
        "",
        ...reportLinesForTop("Top spending wallets", topWallets, 3),
        ...(topContacts.length
          ? ["", ...reportLinesForTop("Top contacts", topContacts, 3)]
          : []),
        ...(monthly.length > 1
          ? [
              "",
              "By month:",
              ...monthly.map(
                (item) => `- ${item.name}: ${formatAmount(item.value)}`,
              ),
            ]
          : []),
      ];
}

async function buildFinancialCoachNote(
  question: string,
  summary: FinancialReportSummary,
) {
  if (!aiParseApiKey) return null;

  const language = summary.languageIsVietnamese ? "Vietnamese" : "English";
  const prompt = {
    task: "Write a short supportive personal finance coach note based only on the provided report numbers. Do not invent numbers or facts. Be warm, practical, non-judgmental, and lightly Gen Z. Max 2 emojis.",
    language,
    userQuestion: question,
    report: {
      period: summary.languageIsVietnamese
        ? summary.range.labelVi
        : summary.range.labelEn,
      start: summary.range.start,
      end: summary.range.end,
      transactionCount: summary.transactionCount,
      totalExpense: summary.totalExpense,
      totalIncome: summary.totalIncome,
      net: summary.net,
      topCategories: summary.topCategories.slice(0, 5),
      topWallets: summary.topWallets.slice(0, 3),
      topContacts: summary.topContacts.slice(0, 3),
      monthly: summary.monthly,
      largestExpense: summary.largestExpense || null,
    },
    style: {
      tone: summary.languageIsVietnamese
        ? "Vietnamese friendly Gen Z finance bestie, supportive but still useful"
        : "friendly supportive finance expert with light casual energy",
      length: "2-4 short lines",
      avoid: [
        "shaming",
        "alarmist language",
        "inventing recommendations not grounded in data",
        "overusing slang",
        "more than 2 emojis",
      ],
    },
  };

  const response = await fetch(aiParseBaseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiParseApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": webAppUrl,
      "X-Title": "Budget Manager Telegram Bot",
    },
    body: JSON.stringify({
      model: aiParseModel,
      messages: [
        {
          role: "system",
          content:
            "You are a kind, practical personal finance coach with light Gen Z warmth. Use only supplied report data. Keep it concise and supportive.",
        },
        { role: "user", content: JSON.stringify(prompt) },
      ],
      temperature: 0.35,
    }),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const note = payload?.choices?.[0]?.message?.content?.trim();
  if (!note || note.length > 900) return null;
  return note;
}

function fallbackCoachNote(summary: FinancialReportSummary) {
  const topCategory = summary.topCategories[0];
  if (summary.languageIsVietnamese) {
    if (!topCategory)
      return "Nhìn chung dữ liệu còn ít, mình sẽ theo dõi thêm vài giao dịch nữa để đưa insight tốt hơn nhé 🙂";
    const ratio =
      summary.totalExpense > 0
        ? Math.round((topCategory.value / summary.totalExpense) * 100)
        : 0;
    return `Góc nhìn nhanh: ${topCategory.name} đang chiếm khoảng ${ratio}% tổng chi. Nếu đây là khoản có chủ đích thì ổn; nếu không, mình gợi ý theo dõi nhóm này sát hơn vài ngày tới 🙂`;
  }
  if (!topCategory)
    return "There is not much data yet, but I’ll keep tracking and give better insights as you add more transactions 🙂";
  const ratio =
    summary.totalExpense > 0
      ? Math.round((topCategory.value / summary.totalExpense) * 100)
      : 0;
  return `Quick take: ${topCategory.name} is about ${ratio}% of spending. If that was intentional, you’re fine; otherwise, it’s the first area I’d keep an eye on 🙂`;
}

async function handleFinancialReport(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  const chatId = asText(message.chat.id);
  const languageIsVietnamese = detectVietnamese(text);
  const range = parseReportRange(text);
  const context = await loadContext(link.user_id, link.default_wallet_id);
  const categoryById = new Map(
    context.categories.map((category: any) => [category.id, category]),
  );
  const { data: rows, error } = await supabase
    .from("transactions")
    .select(
      "id,type,amount,date,description,wallet_id,category_id,contact_id,wallet:wallets!wallet_id(id,name),category:categories(id,name,parent_id),contact:contacts(id,name)",
    )
    .eq("user_id", link.user_id)
    .gte("date", range.start)
    .lte("date", range.end)
    .order("date", { ascending: false });
  if (error) throw error;

  const transactions = rows || [];
  if (transactions.length === 0) {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? `Mình chưa thấy giao dịch nào trong ${range.labelVi} (${range.start} → ${range.end}).`
        : `I could not find any transactions for ${range.labelEn} (${range.start} → ${range.end}).`,
      asText(message.message_id),
    );
    return true;
  }

  const expenses = transactions.filter((tx: any) => tx.type === "expense");
  const incomes = transactions.filter((tx: any) => tx.type === "income");
  const totalExpense = expenses.reduce(
    (sum: number, tx: any) => sum + Number(tx.amount || 0),
    0,
  );
  const totalIncome = incomes.reduce(
    (sum: number, tx: any) => sum + Number(tx.amount || 0),
    0,
  );
  const net = totalIncome - totalExpense;
  const categoryName = (tx: any) => {
    const category = tx.category || categoryById.get(tx.category_id);
    return category?.name || "Khác";
  };
  const walletName = (tx: any) => tx.wallet?.name || "Không rõ ví";
  const contactName = (tx: any) =>
    tx.contact?.name || "Không có người liên quan";
  const topCategories = groupSum(expenses, categoryName, (tx: any) =>
    Number(tx.amount || 0),
  );
  const topWallets = groupSum(expenses, walletName, (tx: any) =>
    Number(tx.amount || 0),
  );
  const topContacts = groupSum(
    expenses.filter((tx: any) => tx.contact_id),
    contactName,
    (tx: any) => Number(tx.amount || 0),
  );
  const monthly = groupSum(
    transactions,
    (tx: any) => monthLabel(tx.date),
    (tx: any) =>
      tx.type === "income" ? Number(tx.amount || 0) : -Number(tx.amount || 0),
  ).sort((a, b) => a.name.localeCompare(b.name));
  const largestExpense = [...expenses].sort(
    (a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0),
  )[0];
  const summary: FinancialReportSummary = {
    range,
    languageIsVietnamese,
    transactionCount: transactions.length,
    totalExpense,
    totalIncome,
    net,
    topCategories,
    topWallets,
    topContacts,
    monthly,
    largestExpense: largestExpense
      ? {
          amount: Number(largestExpense.amount || 0),
          description: largestExpense.description || "",
          categoryName: categoryName(largestExpense),
        }
      : undefined,
  };
  const lines = buildFinancialReportLines(summary);
  const coachNote = await buildFinancialCoachNote(text, summary).catch(
    () => null,
  );
  const finalNote = coachNote || fallbackCoachNote(summary);

  await sendMessage(
    chatId,
    `${lines.join("\n")}\n\n${languageIsVietnamese ? "Nhận xét của mình" : "My take"}:\n${finalNote}`,
    asText(message.message_id),
  );
  return true;
}

async function handleEdit(message: TelegramMessage, link: any, text: string) {
  const chatId = asText(message.chat.id);
  const botMessageId = asText(message.reply_to_message?.message_id);
  let eventQuery = supabase
    .from("telegram_transaction_events")
    .select("transaction_id,user_id,source_text,created_at")
    .eq("chat_id", chatId)
    .eq("telegram_user_id", asText(message.from?.id));
  eventQuery = botMessageId
    ? eventQuery.eq("bot_message_id", botMessageId)
    : eventQuery
        .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

  const { data: event, error } = await eventQuery.maybeSingle();

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
  if (parsed.changes.contactId !== undefined)
    updatePayload.contact_id = parsed.changes.contactId;
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
  await rememberParse(
    event.user_id,
    event.source_text || text,
    "local",
    {
      type: tx.type,
      amount: Number(tx.amount),
      wallet_id: tx.wallet_id,
      to_wallet_id: tx.to_wallet_id,
      category_id: tx.category_id,
      contact_id: tx.contact_id,
      description: tx.description,
      date: tx.date,
      corrected_by: text,
    },
    tx.id,
  );
  await sendMessage(
    chatId,
    summarizeTransaction(tx, detectVietnamese(text)),
    asText(message.message_id),
  );
}

async function resolveParsedTransaction(
  text: string,
  context: Awaited<ReturnType<typeof loadContext>>,
) {
  const memories = await loadAiMemories(context.userId);
  const profile = await loadSpendingPatternProfile(context.userId, text);
  const aiEnabled =
    Boolean(aiParseApiKey) && aiParseMode !== "local" && aiParseMode !== "off";
  const localParsed = parseTelegramTransaction(text, context);
  const aiParsed = aiEnabled
    ? await parseTransactionWithAi(text, context, memories, profile)
    : null;
  if (localParsed.ok && localParsed.type === "transfer") {
    return {
      parsed: applySpendingPatternProfile(localParsed, profile, context, text),
      parser: "local" as const,
      profile,
    };
  }
  if (aiParsed?.ok) {
    return {
      parsed: applySpendingPatternProfile(aiParsed, profile, context, text),
      parser: "ai" as const,
      profile,
    };
  }

  return {
    parsed: localParsed.ok
      ? applySpendingPatternProfile(localParsed, profile, context, text)
      : localParsed,
    parser: "local" as const,
    profile,
  };
}

async function handleTransaction(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  const chatId = asText(message.chat.id);
  const context = await loadContext(link.user_id, link.default_wallet_id);
  const pendingDraft = await loadPendingDraft(message);
  const sourceText = pendingDraft?.source_text || text;
  const textToParse = pendingDraft
    ? `${pendingDraft.source_text} ${text}`
    : text;
  const { parsed, parser } = await resolveParsedTransaction(
    textToParse,
    context,
  );
  const languageIsVietnamese = detectVietnamese(text);

  if (!parsed.ok) {
    if (!pendingDraft && isMissingWalletReason(parsed.reason)) {
      const draftParsed = parseTelegramTransaction(text, {
        ...context,
        defaultWalletId: "__missing_wallet__",
      });
      if (draftParsed.ok) {
        await savePendingDraft(
          link,
          message,
          text,
          {
            ...draftParsed,
            walletId: "",
            unmatched: ["wallet", ...draftParsed.unmatched],
          },
          ["wallet", ...draftParsed.unmatched],
        );
        await askDraftField(
          chatId,
          asText(message.message_id),
          {
            ...draftParsed,
            walletId: "",
            unmatched: ["wallet", ...draftParsed.unmatched],
          },
          "wallet",
          context,
          detectVietnamese(text),
        );
        return;
      }
    }
    await sendMessage(chatId, parsed.reason, asText(message.message_id));
    return;
  }

  if (
    !pendingDraft &&
    parsed.type !== "transfer" &&
    parsed.unmatched.includes("category")
  ) {
    await savePendingDraft(link, message, sourceText, parsed, parsed.unmatched);
    await askDraftField(
      chatId,
      asText(message.message_id),
      parsed,
      "category",
      context,
      languageIsVietnamese,
    );
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

  await rememberParse(
    link.user_id,
    sourceText,
    parser,
    parsedPayload(parsed),
    tx.id,
  );

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
    source_text: sourceText,
  });
  if (pendingDraft) await clearPendingDraft(message);
}

async function handleCallbackQuery(callback: TelegramCallbackQuery) {
  const data = callback.data || "";
  const message = callback.message;
  if (!message || !data.startsWith("draft:")) {
    await answerCallbackQuery(callback.id);
    return;
  }

  const chatId = asText(message.chat.id);
  const link = await getLinkByTelegramUserId(asText(callback.from.id));
  if (!link) {
    await answerCallbackQuery(callback.id, "Bạn cần link tài khoản trước nha.");
    return;
  }

  const draft = await loadPendingDraftForTelegramUser(
    asText(callback.from.id),
    chatId,
  );
  if (!draft) {
    await answerCallbackQuery(
      callback.id,
      "Draft này hết hạn rồi, gửi lại giao dịch giúp mình nha.",
    );
    await editMessageText(
      chatId,
      asText(message.message_id),
      "Draft này hết hạn rồi. Bạn gửi lại giao dịch giúp mình nha.",
    ).catch(() => null);
    return;
  }

  const [, field, value] = data.split(":");
  const context = await loadContext(link.user_id, link.default_wallet_id);
  const parsed = parsedFromDraftPayload(draft.parsed_payload || {});
  if (field === "wallet") {
    const wallet = context.wallets.find((item: any) => item.id === value);
    if (!wallet) {
      await answerCallbackQuery(callback.id, "Ví này không còn tồn tại.");
      return;
    }
    parsed.walletId = wallet.id;
    parsed.unmatched = parsed.unmatched.filter((item) => item !== "wallet");
    await editMessageText(
      chatId,
      asText(message.message_id),
      `Đã chọn ví: ${wallet.name}`,
    );
  } else if (field === "category") {
    if (value === "skip") {
      parsed.categoryId = null;
      parsed.unmatched = parsed.unmatched.filter((item) => item !== "category");
      await editMessageText(
        chatId,
        asText(message.message_id),
        "Đã bỏ qua danh mục cho giao dịch này.",
      );
    } else {
      const category = context.categories.find(
        (item: any) => item.id === value,
      );
      if (!category) {
        await answerCallbackQuery(
          callback.id,
          "Danh mục này không còn tồn tại.",
        );
        return;
      }
      parsed.categoryId = category.id;
      parsed.unmatched = parsed.unmatched.filter((item) => item !== "category");
      await editMessageText(
        chatId,
        asText(message.message_id),
        `Đã chọn danh mục: ${category.name}`,
      );
    }
  } else {
    await answerCallbackQuery(callback.id);
    return;
  }

  await answerCallbackQuery(callback.id, "Đã nhận lựa chọn.");
  const missingWallet = !parsed.walletId;
  const missingCategory =
    parsed.type !== "transfer" && parsed.unmatched.includes("category");
  if (missingWallet || missingCategory) {
    await supabase
      .from("telegram_pending_transaction_drafts")
      .update({
        parsed_payload: {
          ...parsedPayload(parsed),
          missing_fields: parsed.unmatched,
          field_confidence: parsed.fieldConfidence || {},
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .eq("user_id", link.user_id);
    await askDraftField(
      chatId,
      draft.source_message_id,
      parsed,
      missingWallet ? "wallet" : "category",
      context,
      detectVietnamese(draft.source_text),
    );
    return;
  }

  await saveParsedTransactionFromDraft(callback, link, draft, parsed);
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

    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return jsonResponse({ ok: true });
    }

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
        "Mình đây, trợ lý tài chính cá nhân bản dễ tính của bạn 😄\n\nĐể bắt đầu: mở Budget Manager Settings, tạo Telegram link code, rồi gửi /link 123456 ở đây.\n\nSau khi link xong, bạn cứ nhắn tự nhiên để ghi giao dịch, tạo template, hoặc hỏi mình: “tóm tắt chi tiêu tháng này”.",
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
      const casual = await buildCasualChatReply(text);
      if (casual.isCasual) {
        await sendMessage(
          chatId,
          `${casual.reply}\n\nNhưng để mình ghi chi tiêu/report cho đúng tài khoản, bạn link Budget Manager trước nha: mở Settings → Telegram Bot → Generate Link Code.`,
          asText(message.message_id),
        );
        return jsonResponse({ ok: true });
      }
      await sendMessage(
        chatId,
        "This Telegram account is not linked yet. Open Budget Manager Settings and generate a link code.",
        asText(message.message_id),
      );
      return jsonResponse({ ok: true });
    }

    if (message.reply_to_message) {
      const casual = await buildCasualChatReply(text, link);
      if (casual.isCasual) {
        await sendMessage(
          chatId,
          casual.reply || localCasualReply(text, detectVietnamese(text)),
          asText(message.message_id),
        );
      } else {
        await handleEdit(message, link, text);
      }
    } else if (await handleTemplateCommand(message, link, text)) {
      // handled
    } else if (isReportRequest(text)) {
      await handleFinancialReport(message, link, text);
    } else {
      const templates = await loadTemplates(link.user_id);
      const template = findTemplateMatch(templates, text);
      if (template) await runTemplate(message, link, template);
      else {
        const casual = await buildCasualChatReply(text, link);
        if (casual.isCasual) {
          await sendMessage(
            chatId,
            casual.reply || localCasualReply(text, detectVietnamese(text)),
            asText(message.message_id),
          );
        } else {
          await handleTransaction(message, link, text);
        }
      }
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
