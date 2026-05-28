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

type DraftField = "wallet" | "toWallet" | "category" | "contact";

type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

type SendMessageOptions = {
  replyToMessageId?: string;
  replyMarkup?: Record<string, unknown>;
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

type GuidedDraftPayload = {
  draft_kind: "guided";
  guided_type: "expense" | "income" | "transfer";
  guided_stage:
    | "amount"
    | "wallet"
    | "toWallet"
    | "category"
    | "contact"
    | "description";
  language: "vi" | "en";
  transaction: Omit<ParsedOkTransaction, "ok">;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const timeZone = Deno.env.get("BOT_TIME_ZONE") || "Asia/Ho_Chi_Minh";
const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
const openAiModel = Deno.env.get("OPENAI_MODEL") || "";
const useOpenAiDefaults =
  !Deno.env.get("AI_PARSE_API_KEY") &&
  !Deno.env.get("AI_PARSE_BASE_URL") &&
  !Deno.env.get("AI_PARSE_MODEL") &&
  Boolean(openAiApiKey && openAiModel);
const aiParseApiKey = Deno.env.get("AI_PARSE_API_KEY") || openAiApiKey;
const aiParseBaseUrl =
  Deno.env.get("AI_PARSE_BASE_URL") ||
  (useOpenAiDefaults
    ? "https://api.openai.com/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions");
const aiParseModel =
  Deno.env.get("AI_PARSE_MODEL") || openAiModel || "openrouter/free";
const aiParseMode = Deno.env.get("AI_PARSE_MODE") || "assist";
const webAppUrl =
  Deno.env.get("WEB_APP_URL") || "https://budget-manager-a4482.web.app";

const supabase = createClient(supabaseUrl, serviceRoleKey);

const BOT_SHORTCUT_KEYBOARD = {
  keyboard: [
    [{ text: "💸 Ghi chi tiêu" }, { text: "💰 Ghi nhận tiền" }],
    [{ text: "🔁 Ghi chuyển tiền" }, { text: "📚 Templates" }],
    [{ text: "📊 Báo cáo tháng này" }, { text: "❓ Hướng dẫn" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

function aiRequestHeaders() {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${aiParseApiKey}`,
    "Content-Type": "application/json",
  };
  if (aiParseBaseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = webAppUrl;
    headers["X-Title"] = "Budget Manager Telegram Bot";
  }
  return headers;
}

function isVietnameseLanguage(text: string) {
  return detectVietnamese(text);
}

function baseDraftTransaction(
  type: "expense" | "income" | "transfer",
): Omit<ParsedOkTransaction, "ok"> {
  return {
    type,
    amount: 0,
    date: todayInTimeZone(),
    description: "",
    walletId: "",
    toWalletId: null,
    categoryId: null,
    contactId: null,
    unmatched: [],
    fieldConfidence: {},
  };
}

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
    /\b(an|uống|uong|mua|tra|trả|thanh toan|chi|tieu|tiêu|nhan|nhận|luong|lương|thu|refund|salary|income|expense|spent|paid|pay|buy|bought|transfer|chuyen|chuyển|tu|từ|sang|vao|vào|bang|bằng|vi|ví|wallet|cash|card|bank|tai khoan|tài khoản|momo|techcombank|vcb|mb|visa|date|ngay|ngày|hom qua|hôm qua|today|yesterday|budget|ngan sach|ngân sách|goal|muc tieu|mục tiêu|trip|travel|du lich|du lịch|chuyen di|chuyến đi|debt|cong no|công nợ|no ai|nợ ai|danh muc|danh mục|category)\b/i.test(
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
          "- /template create Nhận lương tháng => nhận lương 20tr vào tài khoản; cho mẹ 5tr từ tài khoản",
          "- /template edit Nhận lương tháng => nhận lương 25tr vào tài khoản; cho mẹ 6tr từ tài khoản",
        ].join("\n")
      : [
          "I’m your transaction bot plus a chill personal-finance sidekick 🙂",
          "",
          "Try messages like:",
          "- lunch 85k from cash",
          "- received salary 20m to bank",
          "- summarize spending last 7 days",
          "- /template create Monthly salary => received salary 20m to bank; give mom 5m from bank",
          "- /template edit Monthly salary => received salary 25m to bank; give mom 6m from bank",
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
      "If the message includes a money amount, wallet, transfer, report request, template command, budget, goal, trip, debt, category command, or edit/delete instruction, set isCasual=false.",
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
    headers: aiRequestHeaders(),
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

async function setTelegramCommands() {
  const commands = [
    { command: "start", description: "Khởi động bot" },
    { command: "help", description: "Hướng dẫn nhanh" },
    { command: "expense", description: "Ghi chi tiêu từng bước" },
    { command: "income", description: "Ghi nhận tiền từng bước" },
    { command: "transfer", description: "Ghi chuyển tiền từng bước" },
    { command: "templates", description: "Xem và chạy templates" },
    { command: "report", description: "Gợi ý lệnh báo cáo" },
  ];
  await fetch(`https://api.telegram.org/bot${telegramToken}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  }).catch(() => null);

  await fetch(
    `https://api.telegram.org/bot${telegramToken}/setMyDescription`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description:
          "Bot ghi chi tiêu, nhận tiền, chuyển ví, chạy template và tóm tắt tài chính ngay trong Telegram.",
      }),
    },
  ).catch(() => null);

  await fetch(
    `https://api.telegram.org/bot${telegramToken}/setMyShortDescription`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        short_description:
          "Ghi giao dịch + xem báo cáo tài chính cá nhân trong Telegram.",
      }),
    },
  ).catch(() => null);
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

async function loadAiMemories(userId: string, text: string) {
  const { data, error } = await supabase
    .from("telegram_ai_parse_memories")
    .select(
      "source_text,normalized_text,parser,parsed_payload,created_at,transaction_id",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) return [];
  const ranked = (data || [])
    .map((memory: any) => {
      const parsed = memory.parsed_payload || {};
      const sourceScore = scoreTextSimilarity(text, memory.source_text || "");
      const descriptionScore = scoreTextSimilarity(
        text,
        parsed.description || "",
      );
      const correctionScore = scoreTextSimilarity(
        text,
        parsed.corrected_by || "",
      );
      const normalizedScore =
        memory.normalized_text &&
        normalizeText(text).includes(memory.normalized_text)
          ? 2
          : 0;
      const correctionBonus = parsed.corrected_by ? 1.4 : 0;
      const parserBonus = memory.parser === "template" ? 0.1 : 0.35;
      return {
        memory,
        score:
          Math.max(sourceScore, descriptionScore, correctionScore) +
          normalizedScore +
          correctionBonus +
          parserBonus,
      };
    })
    .sort((a, b) => b.score - a.score);

  const relevant = ranked
    .filter((item) => item.score > 0.8)
    .slice(0, 20)
    .map((item) => item.memory);
  if (relevant.length > 0) return relevant;
  return ranked.slice(0, 12).map((item) => item.memory);
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

function parsedPayloadWithNames(
  parsed: ParsedOkTransaction,
  context: Awaited<ReturnType<typeof loadContext>>,
) {
  const wallet = context.wallets.find((item: any) => item.id === parsed.walletId);
  const toWallet = context.wallets.find(
    (item: any) => item.id === parsed.toWalletId,
  );
  const category = context.categories.find(
    (item: any) => item.id === parsed.categoryId,
  );
  const contact = context.contacts.find(
    (item: any) => item.id === parsed.contactId,
  );
  return {
    ...parsedPayload(parsed),
    wallet_name: wallet?.name || null,
    to_wallet_name: toWallet?.name || null,
    category_name: category?.name || null,
    contact_name: contact?.name || null,
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

function dedupeDraftFields(fields: string[] = []) {
  const allowed: DraftField[] = ["wallet", "toWallet", "category", "contact"];
  return [...new Set(fields.filter((field): field is DraftField => allowed.includes(field as DraftField)))];
}

function nextDraftField(parsed: ParsedOkTransaction) {
  const fields = dedupeDraftFields(parsed.unmatched);
  const order: DraftField[] = ["wallet", "toWallet", "category", "contact"];
  return order.find((field) => fields.includes(field)) || null;
}

function extractPotentialContactSegment(text: string) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /\b(?:cho|gui|tra|voi|with|for|to)\b\s+(.+?)(?=\b(?:bang|with|from|tu|sang|qua|vao|into|hom|today|yesterday)\b|$)/,
  );
  return match?.[1]?.trim() || "";
}

function textSuggestsContact(
  text: string,
  context: Awaited<ReturnType<typeof loadContext>>,
) {
  const segment = extractPotentialContactSegment(text);
  if (!segment) return false;
  const normalizedSegment = normalizeText(segment);
  const matchesWallet = context.wallets.some((wallet: any) =>
    normalizeText(wallet.name || "") === normalizedSegment,
  );
  if (matchesWallet) return false;
  if (normalizedSegment.split(" ").length >= 2) return true;
  return /\b(?:anh|chi|em|me|ba|ma|team|sep|dong nghiep|khach|doi tac|friend|mom|dad|boss|client|colleague)\b/i.test(
    normalizedSegment,
  );
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
        missing_fields: dedupeDraftFields(missingFields),
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

function guidedPromptText(
  payload: GuidedDraftPayload,
  stageOverride?: GuidedDraftPayload["guided_stage"],
) {
  const stage = stageOverride || payload.guided_stage;
  const vi = payload.language === "vi";
  if (stage === "amount") {
    return vi
      ? `Okie, mình ghi ${payload.guided_type === "expense" ? "chi tiêu" : payload.guided_type === "income" ? "nhận tiền" : "chuyển tiền"} theo từng bước nha.\n\nBước 1: gửi số tiền, ví dụ \`85k\`, \`1.2tr\`, \`200000\`.`
      : `Alright, let's capture a ${payload.guided_type} step by step.\n\nStep 1: send the amount, for example \`85k\`, \`1.2m\`, or \`200000\`.`;
  }
  if (stage === "description") {
    return vi
      ? "Bước cuối: gõ mô tả ngắn cho giao dịch này, hoặc bấm Lưu ngay nếu chưa muốn ghi note."
      : "Last step: type a short description for this transaction, or tap Save now if you want to skip the note.";
  }
  return vi ? "Chọn tiếp giúp mình nha." : "Pick the next field for me.";
}

function guidedDescriptionKeyboard(language: "vi" | "en") {
  return {
    inline_keyboard: [
      [
        {
          text: language === "vi" ? "Lưu ngay" : "Save now",
          callback_data: "guided:description:skip",
        },
        {
          text: language === "vi" ? "Hủy" : "Cancel",
          callback_data: "guided:cancel",
        },
      ],
    ],
  };
}

function normalizeGuidedDraftPayload(payload: any): GuidedDraftPayload | null {
  if (!payload || payload.draft_kind !== "guided") return null;
  return {
    draft_kind: "guided",
    guided_type: payload.guided_type || "expense",
    guided_stage: payload.guided_stage || "amount",
    language: payload.language === "en" ? "en" : "vi",
    transaction: {
      ...baseDraftTransaction(payload.guided_type || "expense"),
      ...(payload.transaction || {}),
      unmatched: dedupeDraftFields(payload?.transaction?.unmatched || []),
      fieldConfidence: payload?.transaction?.fieldConfidence || {},
    },
  };
}

async function saveGuidedDraft(
  link: any,
  message: TelegramMessage,
  payload: GuidedDraftPayload,
) {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await supabase.from("telegram_pending_transaction_drafts").upsert(
    {
      user_id: link.user_id,
      telegram_user_id: asText(message.from?.id),
      chat_id: asText(message.chat.id),
      source_message_id: asText(message.message_id),
      source_text: payload.guided_type,
      parsed_payload: payload,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id,chat_id" },
  );
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

function rankDraftOptions(
  items: Array<{ id: string; name: string }>,
  sourceText: string,
  preferredId?: string | null,
  excludeIds: string[] = [],
) {
  return items
    .filter((item) => !excludeIds.includes(item.id))
    .map((item) => ({
      item,
      score:
        scoreTextSimilarity(sourceText, item.name || "") +
        (normalizeText(sourceText).includes(normalizeText(item.name || ""))
          ? 3
          : 0) +
        (preferredId && item.id === preferredId ? 4 : 0),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.name.localeCompare(b.item.name);
    })
    .map((entry) => entry.item);
}

function categoryOptions(
  context: Awaited<ReturnType<typeof loadContext>>,
  sourceText: string,
  preferredId?: string | null,
) {
  const expenseCategories = context.categories.filter(
    (category: any) => !category.type || category.type === "expense",
  );
  const childCategories = expenseCategories.filter(
    (category: any) => category.parent_id,
  );
  const pool = childCategories.length ? childCategories : expenseCategories;
  return rankDraftOptions(pool, sourceText, preferredId).slice(0, 10);
}

function walletOptions(
  context: Awaited<ReturnType<typeof loadContext>>,
  sourceText: string,
  preferredId?: string | null,
) {
  return rankDraftOptions(
    context.wallets.filter((wallet: any) => !wallet.type || wallet.type !== "deleted"),
    sourceText,
    preferredId,
  ).slice(0, 10);
}

function toWalletOptions(
  context: Awaited<ReturnType<typeof loadContext>>,
  sourceText: string,
  parsed: ParsedOkTransaction,
) {
  return walletOptions(context, sourceText, null).filter(
    (wallet) => wallet.id !== parsed.walletId,
  );
}

function contactOptions(
  context: Awaited<ReturnType<typeof loadContext>>,
  sourceText: string,
  preferredId?: string | null,
) {
  return rankDraftOptions(context.contacts, sourceText, preferredId).slice(
    0,
    10,
  );
}

async function askDraftField(
  chatId: string,
  replyToMessageId: string | undefined,
  parsed: ParsedOkTransaction,
  field: DraftField,
  context: Awaited<ReturnType<typeof loadContext>>,
  languageIsVietnamese: boolean,
  sourceText: string,
  profile?: SpendingPatternProfile,
  callbackNamespace: "draft" | "guided" = "draft",
) {
  const summary = `${formatAmount(parsed.amount)} - ${parsed.description || "-"}`;
  if (field === "wallet") {
    const rows = keyboardRows(
      walletOptions(context, sourceText, profile?.wallet?.id),
      `${callbackNamespace}:wallet`,
    );
    rows.push([
      {
        text: languageIsVietnamese ? "Hủy" : "Cancel",
        callback_data: "guided:cancel",
      },
    ]);
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? `Mình hiểu giao dịch này rồi: ${summary} 👍\nChọn ví để mình lưu nha:`
        : `I understood this transaction: ${summary} 👍\nPick the wallet to save it:`,
      {
        replyToMessageId,
        replyMarkup: { inline_keyboard: rows },
      },
    );
    return;
  }

  if (field === "toWallet") {
    const rows = keyboardRows(
      toWalletOptions(context, sourceText, parsed),
      `${callbackNamespace}:toWallet`,
    );
    rows.push([
      {
        text: languageIsVietnamese ? "Hủy" : "Cancel",
        callback_data: "guided:cancel",
      },
    ]);
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? `Mình đã hiểu đây là chuyển ví: ${summary}\nChọn ví nhận để mình lưu cho chuẩn nha:`
        : `I got that this is a transfer: ${summary}\nPick the destination wallet so I can save it properly:`,
      {
        replyToMessageId,
        replyMarkup: { inline_keyboard: rows },
      },
    );
    return;
  }

  if (field === "category") {
    const rows = keyboardRows(
      categoryOptions(context, sourceText, profile?.category?.id),
      `${callbackNamespace}:category`,
    );
    rows.push([
      {
        text: languageIsVietnamese ? "Bỏ qua danh mục" : "Skip category",
        callback_data: `${callbackNamespace}:category:skip`,
      },
      {
        text: languageIsVietnamese ? "Hủy" : "Cancel",
        callback_data: "guided:cancel",
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
    return;
  }

  const rows = keyboardRows(
    contactOptions(context, sourceText, profile?.contact?.id),
    `${callbackNamespace}:contact`,
  );
  rows.push([
    {
      text: languageIsVietnamese ? "Bỏ qua người liên quan" : "Skip contact",
      callback_data: `${callbackNamespace}:contact:skip`,
    },
    {
      text: languageIsVietnamese ? "Hủy" : "Cancel",
      callback_data: "guided:cancel",
    },
  ]);
  await sendMessage(
    chatId,
    languageIsVietnamese
      ? `Mình thấy câu này có vẻ đang nhắc tới người liên quan: ${summary}\nNếu muốn, chọn luôn để mình học đúng pattern của bạn nha.`
      : `This message seems to mention a related person/contact: ${summary}\nIf you want, pick one so I can learn your pattern better.`,
    {
      replyToMessageId,
      replyMarkup: { inline_keyboard: rows },
    },
  );
}

function nextGuidedStage(payload: GuidedDraftPayload) {
  const tx = payload.transaction;
  if (!tx.amount || tx.amount <= 0) return "amount" as const;
  if (!tx.walletId) return "wallet" as const;
  if (payload.guided_type === "transfer" && !tx.toWalletId) {
    return "toWallet" as const;
  }
  if (payload.guided_type !== "transfer" && !tx.categoryId) {
    return "category" as const;
  }
  if (!tx.contactId) return "contact" as const;
  if (!tx.description) return "description" as const;
  return null;
}

async function promptGuidedStage(
  link: any,
  message: TelegramMessage,
  context: Awaited<ReturnType<typeof loadContext>>,
  payload: GuidedDraftPayload,
) {
  const stage = nextGuidedStage(payload);
  payload.guided_stage = stage || "description";
  payload.transaction.unmatched = dedupeDraftFields(
    [
      !payload.transaction.walletId ? "wallet" : "",
      payload.guided_type === "transfer" && !payload.transaction.toWalletId
        ? "toWallet"
        : "",
      payload.guided_type !== "transfer" && !payload.transaction.categoryId
        ? "category"
        : "",
      !payload.transaction.contactId ? "contact" : "",
    ].filter(Boolean),
  );
  await saveGuidedDraft(link, message, payload);

  if (!stage || stage === "description") {
    await sendMessage(
      asText(message.chat.id),
      guidedPromptText(payload, "description"),
      {
        replyToMessageId: asText(message.message_id),
        replyMarkup: guidedDescriptionKeyboard(payload.language),
      },
    );
    return;
  }

  await askDraftField(
    asText(message.chat.id),
    asText(message.message_id),
    { ok: true, ...payload.transaction },
    stage,
    context,
    payload.language === "vi",
    payload.transaction.description ||
      payload.transaction.type ||
      payload.guided_type,
    undefined,
    "guided",
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
    unmatched: dedupeDraftFields(
      Array.isArray(payload.missing_fields) ? payload.missing_fields : [],
    ),
    fieldConfidence: payload.field_confidence || {},
  };
}

async function saveParsedTransactionFromDraft(
  callback: TelegramCallbackQuery,
  link: any,
  draft: any,
  parsed: ParsedOkTransaction,
) {
  await insertTransactionAndReply(
    link,
    {
      ...callback.message!,
      from: callback.from,
      message_id: Number(draft.source_message_id || callback.message?.message_id),
    },
    parsed,
    draft.source_text,
    "local",
    parsed.unmatched,
  );
  await supabase
    .from("telegram_pending_transaction_drafts")
    .delete()
    .eq("id", draft.id)
    .eq("user_id", link.user_id);
}

async function insertTransactionAndReply(
  link: any,
  message: TelegramMessage,
  parsed: ParsedOkTransaction,
  sourceText: string,
  parser: "local" | "ai" | "template" | "guided",
  unmatched: string[] = [],
) {
  const context = await loadContext(link.user_id, link.default_wallet_id);
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
    .select(
      "*, wallet:wallets!wallet_id(name), to_wallet:wallets!to_wallet_id(name), category:categories(name), contact:contacts(name)",
    )
    .single();
  if (error) throw error;

  await rememberParse(
    link.user_id,
    sourceText,
    parser === "guided" ? "local" : parser,
    parsedPayloadWithNames(parsed, context),
    tx.id,
  );

  const reply = await sendMessage(
    asText(message.chat.id),
    summarizeTransaction(tx, detectVietnamese(sourceText), unmatched),
    asText(message.message_id),
  );

  await supabase.from("telegram_transaction_events").insert({
    user_id: link.user_id,
    telegram_user_id: asText(message.from?.id),
    chat_id: asText(message.chat.id),
    source_message_id: asText(message.message_id),
    bot_message_id: asText(reply.message_id),
    transaction_id: tx.id,
    source_text: sourceText,
  });

  return tx;
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
  const [{ data, error }, { data: memoryRows, error: memoryError }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id,type,amount,description,wallet_id,category_id,contact_id,wallet:wallets!wallet_id(name),category:categories(name),contact:contacts(name)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("telegram_ai_parse_memories")
        .select("source_text,parsed_payload,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120),
    ]);
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

  if (!memoryError) {
    (memoryRows || []).forEach((memory: any) => {
      const parsed = memory.parsed_payload || {};
      const sourceText = memory.source_text || "";
      const correctedBy = parsed.corrected_by || "";
      const similarity = Math.max(
        scoreTextSimilarity(text, sourceText),
        scoreTextSimilarity(text, correctedBy),
        scoreTextSimilarity(text, parsed.description || ""),
      );
      if (similarity <= 0) return;
      const correctionBonus = correctedBy ? 1.4 : 0.6;
      const score = similarity + correctionBonus;

      if (examples.length < 8) {
        examples.push({
          description: parsed.description || sourceText,
          amount: Number(parsed.amount || 0),
          categoryName: parsed.category_name || null,
          contactName: parsed.contact_name || null,
          walletName: parsed.wallet_name || null,
        });
      }

      addSuggestionScore(
        categoryScores,
        parsed.category_id,
        parsed.category_name,
        score,
        correctedBy
          ? `corrected pattern: ${correctedBy}`
          : `memory pattern: ${sourceText}`,
      );
      addSuggestionScore(
        contactScores,
        parsed.contact_id,
        parsed.contact_name,
        score,
        correctedBy
          ? `corrected pattern: ${correctedBy}`
          : `memory pattern: ${sourceText}`,
      );
      addSuggestionScore(
        walletScores,
        parsed.wallet_id,
        parsed.wallet_name,
        Math.max(0, score - 0.4),
        correctedBy
          ? `corrected pattern: ${correctedBy}`
          : `memory pattern: ${sourceText}`,
      );
    });
  }

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
  const walletId = wallet?.id || context.defaultWalletId || "";

  const category =
    type === "transfer"
      ? null
      : findByName(context.categories, ai.categoryName);
  const contact = findByName(context.contacts, ai.contactName);
  const today = todayInTimeZone();
  const date = /^20\d{2}-\d{2}-\d{2}$/.test(ai.date || "") ? ai.date! : today;
  const unmatched = dedupeDraftFields([
    !walletId ? "wallet" : "",
    type === "transfer" && !toWallet ? "toWallet" : "",
    !category && type !== "transfer" ? "category" : "",
    !contact && textSuggestsContact(text, context) ? "contact" : "",
  ]);

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
    unmatched,
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
    headers: aiRequestHeaders(),
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
    next.unmatched = next.unmatched.filter((field) => field !== "contact");
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
    next.unmatched = next.unmatched.filter((field) => field !== "wallet");
  }
  next.unmatched = dedupeDraftFields(next.unmatched);
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
    {
      replyToMessageId: asText(message.message_id),
      replyMarkup: BOT_SHORTCUT_KEYBOARD,
    },
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
  const walletLine = tx.type === "transfer"
    ? languageIsVietnamese
      ? `Ví: ${tx.wallet?.name || "-"} -> ${tx.to_wallet?.name || "-"}`
      : `Wallets: ${tx.wallet?.name || "-"} -> ${tx.to_wallet?.name || "-"}`
    : languageIsVietnamese
      ? `Ví: ${tx.wallet?.name || "-"}`
      : `Wallet: ${tx.wallet?.name || "-"}`
  const categoryLine = languageIsVietnamese
    ? `Danh mục: ${tx.category?.name || "-"}`
    : `Category: ${tx.category?.name || "-"}`
  const contactLine = languageIsVietnamese
    ? `Cho ai / liên quan: ${tx.contact?.name || "-"}`
    : `For / contact: ${tx.contact?.name || "-"}`
  return languageIsVietnamese
    ? `Done, mình ghi rồi nha ✅\n${typeLabel}: ${formatAmount(Number(tx.amount))}\nNgày: ${tx.date}\n${walletLine}\n${categoryLine}\n${contactLine}\nMô tả: ${tx.description || "-"}${warnings}\n\nCần chỉnh thì reply đúng tin này với “sửa ...” hoặc “xóa”. Nếu chỉ gõ “sửa”, mình sẽ gợi ý cú pháp luôn.`
    : `Saved for you ✅\n${typeLabel}: ${formatAmount(Number(tx.amount))}\nDate: ${tx.date}\n${walletLine}\n${categoryLine}\n${contactLine}\nDescription: ${tx.description || "-"}${warnings}\n\nTo edit this exact transaction, reply to this message with “change ...” or “delete”. If you just send “edit”, I’ll show examples.`;
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
        ? "Bạn chưa có template nào. Tạo bằng: /template create Nhận lương tháng => nhận lương 20tr vào Techcombank; cho mẹ 5tr từ tài khoản"
        : "You do not have templates yet. Create one with: /template create Monthly salary => received salary 20m to Techcombank; give mom 5m from Techcombank",
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
  const rows = templates.slice(0, 12).map((template) => [
    {
      text: `${languageIsVietnamese ? "Chạy" : "Run"}: ${template.name}`,
      callback_data: `template:run:${template.id}`,
    },
  ]);
  await sendMessage(
    chatId,
    `${languageIsVietnamese ? "Template hiện có" : "Templates"}:\n${lines.join("\n\n")}`,
    {
      replyToMessageId: asText(message.message_id),
      replyMarkup: rows.length ? { inline_keyboard: rows } : undefined,
    },
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

type TemplateMutationMode = "create" | "edit";

function getTemplateMutationMode(
  text: string,
): TemplateMutationMode | "legacy-add" | null {
  const normalized = normalizeText(text);
  if (
    normalized.startsWith("/template create ") ||
    normalized.startsWith("/teamplate create ") ||
    normalized.startsWith("/template tao ") ||
    normalized.startsWith("/template tạo ") ||
    normalized.startsWith("/teamplate tao ") ||
    normalized.startsWith("/teamplate tạo ") ||
    normalized.startsWith("tao mau ") ||
    normalized.startsWith("tạo mẫu ") ||
    normalized.startsWith("tao template ") ||
    normalized.startsWith("tạo template ") ||
    normalized.startsWith("create template ")
  ) {
    return "create";
  }
  if (
    normalized.startsWith("/template edit ") ||
    normalized.startsWith("/teamplate edit ") ||
    normalized.startsWith("/template update ") ||
    normalized.startsWith("/teamplate update ") ||
    normalized.startsWith("/template sua ") ||
    normalized.startsWith("/template sửa ") ||
    normalized.startsWith("/teamplate sua ") ||
    normalized.startsWith("/teamplate sửa ") ||
    normalized.startsWith("edit template ") ||
    normalized.startsWith("update template ") ||
    normalized.startsWith("sua template ") ||
    normalized.startsWith("sửa template ") ||
    normalized.startsWith("sua mau ") ||
    normalized.startsWith("sửa mẫu ")
  ) {
    return "edit";
  }
  if (
    normalized.startsWith("/template add ") ||
    normalized.startsWith("/teamplate add ")
  ) {
    return "legacy-add";
  }
  return null;
}

function looksLikeTemplateMutation(text: string) {
  return getTemplateMutationMode(text) !== null;
}

function parseTemplateMutation(text: string) {
  const mode = getTemplateMutationMode(text);
  if (!mode || mode === "legacy-add") return null;

  let cleaned = text
    .replace(
      /^\/(?:template|teamplate)\s+(?:create|edit|update|tao|tạo|sua|sửa)\s+/i,
      "",
    )
    .replace(/^(?:tạo|tao)\s+(?:mẫu|mau|template)\s+/i, "")
    .replace(/^(?:sửa|sua|edit|update)\s+(?:mẫu|mau|template)\s+/i, "")
    .replace(/^create\s+template\s+/i, "");

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
  return { mode, name, itemTexts };
}

function templateMutationHelp(
  mode: TemplateMutationMode | "legacy-add" | null,
  languageIsVietnamese: boolean,
) {
  if (mode === "edit") {
    return languageIsVietnamese
      ? [
          "Mình nhận ra bạn muốn edit template, nhưng còn thiếu danh sách giao dịch á.",
          "",
          "Bạn gửi theo mẫu này nha:",
          "/template edit Nhận lương tháng => nhận lương 20tr vào tài khoản; cho mẹ 5tr từ tài khoản; chuyển 3tr từ tài khoản sang tiết kiệm",
          "",
          "Mỗi giao dịch cách nhau bằng dấu `;`.",
        ].join("\n")
      : [
          "I can tell you want to edit a template, but I still need the transaction list.",
          "",
          "Use this format:",
          "/template edit Monthly salary => received salary 20m to bank; give mom 5m from bank; transfer 3m from bank to savings",
          "",
          "Separate each transaction with `;`.",
        ].join("\n");
  }

  if (mode === "legacy-add") {
    return languageIsVietnamese
      ? [
          "Mình tách template theo CRUD rồi nha:",
          "- Tạo mới: /template create Tên template => giao dịch 1; giao dịch 2",
          "- Chỉnh sửa: /template edit Tên template => giao dịch 1; giao dịch 2",
          "",
          "Ví dụ:",
          "/template create Nhận lương tháng => nhận lương 20tr vào tài khoản; cho mẹ 5tr từ tài khoản",
        ].join("\n")
      : [
          "Templates now use CRUD wording:",
          "- Create: /template create Template name => transaction 1; transaction 2",
          "- Edit: /template edit Template name => transaction 1; transaction 2",
          "",
          "Example:",
          "/template create Monthly salary => received salary 20m to bank; give mom 5m from bank",
        ].join("\n");
  }

  return languageIsVietnamese
    ? [
        "Mình nhận ra bạn muốn create template, nhưng còn thiếu danh sách giao dịch á.",
        "",
        "Bạn gửi theo mẫu này nha:",
        "/template create Nhận lương tháng => nhận lương 20tr vào tài khoản; cho mẹ 5tr từ tài khoản; chuyển 3tr từ tài khoản sang tiết kiệm",
        "",
        "Mỗi giao dịch cách nhau bằng dấu `;`.",
      ].join("\n")
    : [
        "I can tell you want to create a template, but I still need the transaction list.",
        "",
        "Use this format:",
        "/template create Monthly salary => received salary 20m to bank; give mom 5m from bank; transfer 3m from bank to savings",
        "",
        "Separate each transaction with `;`.",
      ].join("\n");
}

async function saveTemplateFromMessage(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  const chatId = asText(message.chat.id);
  const mutationMode = getTemplateMutationMode(text);
  const parsedMutation = parseTemplateMutation(text);
  if (!parsedMutation) {
    if (!looksLikeTemplateMutation(text)) return false;
    await sendMessage(
      chatId,
      templateMutationHelp(mutationMode, detectVietnamese(text)),
      asText(message.message_id),
    );
    return true;
  }

  const context = await loadContext(link.user_id, link.default_wallet_id);
  const parsedItems = await Promise.all(
    parsedMutation.itemTexts.map(async (itemText) => ({
      source: itemText,
      ...(await resolveParsedTransaction(itemText, context)),
    })),
  );
  const failed = parsedItems.find((item) => !item.parsed.ok);
  if (failed || parsedItems.some((item) => !item.parsed.ok)) {
    const failedReason =
      failed && !failed.parsed.ok ? failed.parsed.reason : "";
    await sendMessage(
      chatId,
      `Mình chưa hiểu một dòng trong template: "${failed?.source || ""}".\n${failedReason}\n\nHãy viết mỗi dòng như một giao dịch bình thường, ví dụ "nhận lương 20tr vào Techcombank".`,
      asText(message.message_id),
    );
    return true;
  }

  const triggerNormalized = normalizeText(parsedMutation.name);
  const { data: existing, error: findError } = await supabase
    .from("telegram_transaction_templates")
    .select("id, name")
    .eq("user_id", link.user_id)
    .eq("trigger_normalized", triggerNormalized)
    .maybeSingle();
  if (findError) throw findError;

  const languageIsVietnamese = detectVietnamese(text);
  if (parsedMutation.mode === "create" && existing?.id) {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? `Template "${existing.name}" đã tồn tại rồi. Nếu muốn sửa, dùng: /template edit ${parsedMutation.name} => ...`
        : `Template "${existing.name}" already exists. To update it, use: /template edit ${parsedMutation.name} => ...`,
      asText(message.message_id),
    );
    return true;
  }

  if (parsedMutation.mode === "edit" && !existing?.id) {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? `Mình chưa thấy template "${parsedMutation.name}". Nếu muốn tạo mới, dùng: /template create ${parsedMutation.name} => ...`
        : `I could not find template "${parsedMutation.name}". To create it, use: /template create ${parsedMutation.name} => ...`,
      asText(message.message_id),
    );
    return true;
  }

  let templateId = existing?.id;
  if (templateId) {
    const { error: updateError } = await supabase
      .from("telegram_transaction_templates")
      .update({
        name: parsedMutation.name,
        trigger_text: parsedMutation.name,
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
        name: parsedMutation.name,
        trigger_text: parsedMutation.name,
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
    parsedMutation.mode === "edit"
      ? languageIsVietnamese
        ? `Đã edit template "${parsedMutation.name}" với ${rows.length} giao dịch. Lần sau chỉ cần nhắn: ${parsedMutation.name}`
        : `Edited template "${parsedMutation.name}" with ${rows.length} transactions. Next time, just send: ${parsedMutation.name}`
      : languageIsVietnamese
        ? `Đã create template "${parsedMutation.name}" với ${rows.length} giao dịch. Lần sau chỉ cần nhắn: ${parsedMutation.name}`
        : `Created template "${parsedMutation.name}" with ${rows.length} transactions. Next time, just send: ${parsedMutation.name}`,
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

async function startGuidedDraft(
  message: TelegramMessage,
  link: any,
  type: "expense" | "income" | "transfer",
  language: "vi" | "en",
) {
  const payload: GuidedDraftPayload = {
    draft_kind: "guided",
    guided_type: type,
    guided_stage: "amount",
    language,
    transaction: baseDraftTransaction(type),
  };
  await saveGuidedDraft(link, message, payload);
  await sendMessage(
    asText(message.chat.id),
    guidedPromptText(payload, "amount"),
    {
      replyToMessageId: asText(message.message_id),
      replyMarkup: BOT_SHORTCUT_KEYBOARD,
    },
  );
}

function extractSingleAmount(text: string) {
  const parsed = parseTelegramTransaction(`tmp ${text}`, {
    wallets: [],
    categories: [],
    contacts: [],
    defaultWalletId: "__tmp__",
    timeZone,
  });
  if (!parsed.ok) return null;
  return parsed.amount;
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

  if (await saveTemplateFromMessage(message, link, text)) return true;

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

function guidedShortcutType(text: string) {
  const normalized = normalizeText(text);
  if (
    normalized === "/expense" ||
    normalized === "ghi chi tieu" ||
    normalized === "ghi chi tiêu"
  ) {
    return "expense" as const;
  }
  if (
    normalized === "/income" ||
    normalized === "ghi nhan tien" ||
    normalized === "ghi nhận tiền"
  ) {
    return "income" as const;
  }
  if (
    normalized === "/transfer" ||
    normalized === "ghi chuyen tien" ||
    normalized === "ghi chuyển tiền"
  ) {
    return "transfer" as const;
  }
  return null;
}

function looksLikeEditReply(text: string) {
  return /^(xoa|xóa|delete|remove|sua|sửa|doi|đổi|change|update|edit)\b/i.test(
    normalizeText(text),
  );
}

function isBudgetRequest(text: string) {
  return /\b(budget|ngan sach|ngân sách|qua budget|vuot ngan sach|vượt ngân sách|safe budget|an toan budget|an toàn ngân sách)\b/i.test(
    normalizeText(text),
  );
}

function isGoalRequest(text: string) {
  return /\b(goal|muc tieu|mục tiêu|tien do goal|tiến độ goal|dat muc tieu|đạt mục tiêu|saving goal)\b/i.test(
    normalizeText(text),
  );
}

function isTravelRequest(text: string) {
  return /\b(trip|travel|du lich|du lịch|chuyen di|chuyến đi|tour)\b/i.test(
    normalizeText(text),
  );
}

function isDebtRequest(text: string) {
  return /\b(debt|cong no|công nợ|no ai|nợ ai|ban no|bạn nợ|owes|owe)\b/i.test(
    normalizeText(text),
  );
}

function looksLikeCategoryCommand(text: string) {
  return /^\/category\b/i.test(text) || /\b(danh muc|danh mục)\b/i.test(normalizeText(text));
}

function collectCategoryIds(
  categories: Array<{ id: string; parent_id?: string | null }>,
  rootId?: string | null,
) {
  if (!rootId) return [];
  const ids = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop();
    if (!current || ids.has(current)) continue;
    ids.add(current);
    categories.forEach((category) => {
      if (category.parent_id === current) stack.push(category.id);
    });
  }
  return [...ids];
}

function findBestNamedItem<T>(
  items: T[],
  text: string,
  valueFns: Array<(item: T) => string | null | undefined>,
) {
  const normalized = normalizeText(text);
  let best: T | null = null;
  let bestScore = 0;

  items.forEach((item) => {
    let score = 0;
    valueFns.forEach((valueFn) => {
      const raw = valueFn(item);
      const name = normalizeText(raw || "");
      if (!name) return;
      let nextScore = scoreTextSimilarity(normalized, name);
      if (normalized.includes(name)) nextScore += 1.4;
      if (name.includes(normalized)) nextScore += 0.15;
      score = Math.max(score, nextScore);
    });
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });

  return bestScore >= 1.15 ? best : null;
}

function budgetStatusLabel(ratio: number, languageIsVietnamese: boolean) {
  if (ratio >= 1) return languageIsVietnamese ? "Quá ngân sách" : "Over budget";
  if (ratio >= 0.9)
    return languageIsVietnamese ? "Sát ngưỡng" : "Very close to the limit";
  if (ratio >= 0.8) return languageIsVietnamese ? "Cần canh" : "Watch closely";
  return languageIsVietnamese ? "Vẫn an toàn" : "Still safe";
}

function goalStatusLabel(goal: any, languageIsVietnamese: boolean) {
  if (Number(goal.percentage || 0) >= 100) {
    return languageIsVietnamese ? "Đã hoàn thành" : "Completed";
  }
  if (goal.daysLeft !== null && goal.daysLeft !== undefined && goal.daysLeft < 0) {
    return languageIsVietnamese ? "Đã quá hạn" : "Past deadline";
  }
  if (Number(goal.percentage || 0) >= 80) {
    return languageIsVietnamese ? "Sắp chạm đích" : "Close to the finish line";
  }
  return languageIsVietnamese ? "Đang theo dõi" : "In progress";
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
    headers: aiRequestHeaders(),
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

function enrichGoalRecord(goal: any, today = new Date()) {
  const target = Number(goal.target_amount || 0);
  const current = Number(goal.current_amount || 0);
  const percentage =
    target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  const remaining = Math.max(target - current, 0);
  let requiredMonthlySaving: number | null = null;
  let daysLeft: number | null = null;
  if (goal.deadline) {
    const deadline = new Date(goal.deadline);
    const monthsLeft =
      (deadline.getFullYear() - today.getFullYear()) * 12 +
      (deadline.getMonth() - today.getMonth());
    daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
    requiredMonthlySaving = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
  }
  return {
    ...goal,
    percentage,
    remaining,
    requiredMonthlySaving,
    daysLeft,
  };
}

async function buildDomainCoachNote(
  question: string,
  languageIsVietnamese: boolean,
  domain: string,
  facts: Record<string, unknown>,
) {
  if (!aiParseApiKey) return null;

  const response = await fetch(aiParseBaseUrl, {
    method: "POST",
    headers: aiRequestHeaders(),
    body: JSON.stringify({
      model: aiParseModel,
      messages: [
        {
          role: "system",
          content:
            "You are a supportive personal finance coach with light Gen Z warmth. Use only supplied facts, be concise, practical, and non-judgmental. Max 3 short lines and 2 emojis.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Summarize the financial situation and give a short practical note.",
            language: languageIsVietnamese ? "Vietnamese" : "English",
            domain,
            userQuestion: question,
            facts,
          }),
        },
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

async function handleBudgetInsights(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  if (!isBudgetRequest(text)) return false;

  const chatId = asText(message.chat.id);
  const languageIsVietnamese = detectVietnamese(text);
  const range = parseReportRange(text);
  const context = await loadContext(link.user_id, link.default_wallet_id);
  const { data: budgets, error: budgetError } = await supabase
    .from("budgets")
    .select("id,amount,period,start_date,category_id,category:categories(id,name,parent_id)")
    .eq("user_id", link.user_id)
    .order("created_at", { ascending: false });
  if (budgetError) throw budgetError;

  if (!budgets || budgets.length === 0) {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? "Bạn chưa có budget nào để mình kiểm tra cả."
        : "You do not have any budgets yet.",
      asText(message.message_id),
    );
    return true;
  }

  const { data: expenseRows, error: txError } = await supabase
    .from("transactions")
    .select("amount,category_id")
    .eq("user_id", link.user_id)
    .eq("type", "expense")
    .gte("date", range.start)
    .lte("date", range.end);
  if (txError) throw txError;

  const enriched = (budgets || []).map((budget: any) => {
    const categoryIds = collectCategoryIds(context.categories, budget.category_id);
    const spent = (expenseRows || [])
      .filter((tx: any) => categoryIds.includes(tx.category_id))
      .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
    const limit = Number(budget.amount || 0);
    const ratio = limit > 0 ? spent / limit : 0;
    return {
      ...budget,
      spent,
      limit,
      ratio,
      status: budgetStatusLabel(ratio, languageIsVietnamese),
    };
  });

  const requestedBudget = findBestNamedItem(
    enriched,
    text,
    [(item: any) => item.category?.name],
  );
  const rows = requestedBudget ? [requestedBudget] : [...enriched].sort((a, b) => b.ratio - a.ratio);

  const lines = requestedBudget
    ? [
        languageIsVietnamese
          ? `Budget của ${requestedBudget.category?.name || "không rõ"} trong ${range.labelVi}:`
          : `Budget for ${requestedBudget.category?.name || "unknown"} in ${range.labelEn}:`,
        `${formatAmount(requestedBudget.spent)} / ${formatAmount(requestedBudget.limit)}`,
        languageIsVietnamese
          ? `Trạng thái: ${requestedBudget.status}`
          : `Status: ${requestedBudget.status}`,
      ]
    : [
        languageIsVietnamese
          ? `Tình hình budget ${range.labelVi} 📒`
          : `Budget check for ${range.labelEn} 📒`,
        `${range.start} → ${range.end}`,
        "",
        ...rows.slice(0, 5).map((budget: any, index: number) =>
          languageIsVietnamese
            ? `${index + 1}. ${budget.category?.name || "Khác"}: ${formatAmount(budget.spent)} / ${formatAmount(budget.limit)} • ${budget.status}`
            : `${index + 1}. ${budget.category?.name || "Other"}: ${formatAmount(budget.spent)} / ${formatAmount(budget.limit)} • ${budget.status}`,
        ),
      ];

  const coachNote =
    (await buildDomainCoachNote(text, languageIsVietnamese, "budget", {
      range,
      budgets: rows.slice(0, 5).map((budget: any) => ({
        category: budget.category?.name || null,
        spent: budget.spent,
        limit: budget.limit,
        ratio: budget.ratio,
        status: budget.status,
      })),
    }).catch(() => null)) ||
    (languageIsVietnamese
      ? "Mình sẽ canh kỹ nhất các budget đang sát ngưỡng hoặc vượt ngưỡng để nhắc bạn sớm hơn nha."
      : "I’ll keep the closest-to-limit budgets at the top so you can react early.");

  await sendMessage(
    chatId,
    `${lines.join("\n")}\n\n${languageIsVietnamese ? "Nhận xét của mình" : "My take"}:\n${coachNote}`,
    asText(message.message_id),
  );
  return true;
}

async function handleGoalInsights(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  if (!isGoalRequest(text)) return false;

  const chatId = asText(message.chat.id);
  const languageIsVietnamese = detectVietnamese(text);
  const { data: goals, error } = await supabase
    .from("goals")
    .select("*, wallet:wallets(id,name)")
    .eq("user_id", link.user_id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const enriched = (goals || []).map((goal: any) => enrichGoalRecord(goal));
  if (enriched.length === 0) {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? "Bạn chưa có goal nào để mình theo dõi."
        : "You do not have any goals yet.",
      asText(message.message_id),
    );
    return true;
  }

  const requestedGoal = findBestNamedItem(
    enriched,
    text,
    [(item: any) => item.name, (item: any) => item.wallet?.name],
  );
  const rows = requestedGoal
    ? [requestedGoal]
    : [...enriched].sort((a, b) => Number(b.percentage || 0) - Number(a.percentage || 0));

  const lines = requestedGoal
    ? [
        languageIsVietnamese
          ? `Goal "${requestedGoal.name}" hiện tại:`
          : `Current status for "${requestedGoal.name}":`,
        `${formatAmount(Number(requestedGoal.current_amount || 0))} / ${formatAmount(Number(requestedGoal.target_amount || 0))}`,
        languageIsVietnamese
          ? `Tiến độ: ${requestedGoal.percentage}% • ${goalStatusLabel(requestedGoal, true)}`
          : `Progress: ${requestedGoal.percentage}% • ${goalStatusLabel(requestedGoal, false)}`,
        requestedGoal.deadline
          ? languageIsVietnamese
            ? `Còn lại: ${formatAmount(Number(requestedGoal.remaining || 0))} • ${requestedGoal.daysLeft} ngày`
            : `Remaining: ${formatAmount(Number(requestedGoal.remaining || 0))} • ${requestedGoal.daysLeft} days`
          : "",
      ].filter(Boolean)
    : [
        languageIsVietnamese ? "Tổng quan goals 🎯" : "Goal overview 🎯",
        ...rows.slice(0, 5).map((goal: any, index: number) =>
          languageIsVietnamese
            ? `${index + 1}. ${goal.name}: ${goal.percentage}% • còn ${formatAmount(Number(goal.remaining || 0))} • ${goalStatusLabel(goal, true)}`
            : `${index + 1}. ${goal.name}: ${goal.percentage}% • ${formatAmount(Number(goal.remaining || 0))} left • ${goalStatusLabel(goal, false)}`,
        ),
      ];

  const coachNote =
    (await buildDomainCoachNote(text, languageIsVietnamese, "goal", {
      goals: rows.slice(0, 5).map((goal: any) => ({
        name: goal.name,
        percentage: goal.percentage,
        remaining: goal.remaining,
        requiredMonthlySaving: goal.requiredMonthlySaving,
        daysLeft: goal.daysLeft,
      })),
    }).catch(() => null)) ||
    (languageIsVietnamese
      ? "Goal nào còn xa đích thì mình sẽ ưu tiên nhắc theo phần còn thiếu và deadline, để bạn dễ canh hơn."
      : "I’ll focus on the goals with the biggest gap and nearest deadline so the priorities stay clear.");

  await sendMessage(
    chatId,
    `${lines.join("\n")}\n\n${languageIsVietnamese ? "Nhận xét của mình" : "My take"}:\n${coachNote}`,
    asText(message.message_id),
  );
  return true;
}

async function handleTravelInsights(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  if (!isTravelRequest(text)) return false;

  const chatId = asText(message.chat.id);
  const languageIsVietnamese = detectVietnamese(text);
  const context = await loadContext(link.user_id, link.default_wallet_id);
  const { data: trips, error: tripError } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", link.user_id)
    .order("start_date", { ascending: false });
  if (tripError) throw tripError;

  if (!trips || trips.length === 0) {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? "Bạn chưa có chuyến đi nào để mình phân tích."
        : "You do not have any trips yet.",
      asText(message.message_id),
    );
    return true;
  }

  const requestedTrip = findBestNamedItem(
    trips,
    text,
    [(item: any) => item.name, (item: any) => item.destination],
  );

  if (!requestedTrip) {
    const tripIds = trips.map((trip: any) => trip.id);
    const { data: rows, error } = await supabase
      .from("transactions")
      .select("trip_id,amount")
      .eq("user_id", link.user_id)
      .eq("type", "expense")
      .in("trip_id", tripIds);
    if (error) throw error;

    const totals = new Map<string, number>();
    (rows || []).forEach((row: any) => {
      totals.set(row.trip_id, (totals.get(row.trip_id) || 0) + Number(row.amount || 0));
    });
    const summaryTrips = trips
      .map((trip: any) => ({
        ...trip,
        total: totals.get(trip.id) || 0,
      }))
      .sort((a: any, b: any) => b.total - a.total);

    const lines = [
      languageIsVietnamese ? "Tổng quan chi tiêu du lịch ✈️" : "Travel spending overview ✈️",
      ...summaryTrips.slice(0, 5).map((trip: any, index: number) =>
        languageIsVietnamese
          ? `${index + 1}. ${trip.name}: ${formatAmount(trip.total)}`
          : `${index + 1}. ${trip.name}: ${formatAmount(trip.total)}`,
      ),
    ];
    const coachNote =
      (await buildDomainCoachNote(text, languageIsVietnamese, "travel", {
        trips: summaryTrips.slice(0, 5).map((trip: any) => ({
          name: trip.name,
          total: trip.total,
          destination: trip.destination,
        })),
      }).catch(() => null)) ||
      (languageIsVietnamese
        ? "Nếu bạn muốn, mình có thể bóc riêng từng chuyến để xem ăn uống, đi lại, ở đâu đang tốn nhiều nhất."
        : "If you want, I can break down any specific trip by category next.");
    await sendMessage(
      chatId,
      `${lines.join("\n")}\n\n${languageIsVietnamese ? "Nhận xét của mình" : "My take"}:\n${coachNote}`,
      asText(message.message_id),
    );
    return true;
  }

  const { data: txs, error: txError } = await supabase
    .from("transactions")
    .select("id,amount,type,date,description,category_id,category:categories(id,name,parent_id)")
    .eq("user_id", link.user_id)
    .eq("trip_id", requestedTrip.id)
    .eq("type", "expense")
    .order("date", { ascending: false });
  if (txError) throw txError;

  const categoryMatch = findBestNamedItem(
    context.categories,
    text,
    [(item: any) => item.name],
  );
  const categoryIds = categoryMatch
    ? collectCategoryIds(context.categories, categoryMatch.id)
    : [];
  const filtered = categoryIds.length
    ? (txs || []).filter((tx: any) => categoryIds.includes(tx.category_id))
    : txs || [];
  const total = filtered.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
  const byCategory = groupSum(
    filtered,
    (tx: any) => tx.category?.name || "Khác",
    (tx: any) => Number(tx.amount || 0),
  );

  const lines = [
    languageIsVietnamese
      ? `Chi tiêu cho chuyến "${requestedTrip.name}" ${categoryMatch ? `• ${categoryMatch.name}` : ""}`
      : `Spending for "${requestedTrip.name}" ${categoryMatch ? `• ${categoryMatch.name}` : ""}`,
    `${requestedTrip.start_date} → ${requestedTrip.end_date}`,
    languageIsVietnamese
      ? `Tổng chi: ${formatAmount(total)} • ${filtered.length} giao dịch`
      : `Total: ${formatAmount(total)} • ${filtered.length} transactions`,
    "",
    ...reportLinesForTop(
      languageIsVietnamese ? "Top danh mục" : "Top categories",
      byCategory,
      5,
    ),
  ];

  const coachNote =
    (await buildDomainCoachNote(text, languageIsVietnamese, "travel", {
      trip: requestedTrip.name,
      total,
      transactionCount: filtered.length,
      categories: byCategory.slice(0, 5),
      categoryFilter: categoryMatch?.name || null,
    }).catch(() => null)) ||
    (languageIsVietnamese
      ? "Muốn soi kỹ hơn nữa thì bạn hỏi riêng kiểu “ăn uống trong chuyến Đà Lạt” hoặc “top khoản chi của chuyến này” nha."
      : "For a deeper cut, ask something like “food spending in this trip” or “top expenses in this trip”.");

  await sendMessage(
    chatId,
    `${lines.join("\n")}\n\n${languageIsVietnamese ? "Nhận xét của mình" : "My take"}:\n${coachNote}`,
    asText(message.message_id),
  );
  return true;
}

async function handleDebtInsights(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  if (!isDebtRequest(text)) return false;

  const chatId = asText(message.chat.id);
  const languageIsVietnamese = detectVietnamese(text);
  const { data: contacts, error: contactError } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", link.user_id);
  if (contactError) throw contactError;
  const { data: txs, error: txError } = await supabase
    .from("transactions")
    .select("amount,type,contact_id,date,description")
    .eq("user_id", link.user_id)
    .eq("is_debt", true);
  if (txError) throw txError;

  const balances: Record<string, any> = {};
  (contacts || []).forEach((contact: any) => {
    balances[contact.id] = { ...contact, balance: 0, debtTxs: [] };
  });
  (txs || []).forEach((tx: any) => {
    if (!tx.contact_id || !balances[tx.contact_id]) return;
    const amount = Number(tx.amount || 0);
    if (tx.type === "expense") balances[tx.contact_id].balance += amount;
    else if (tx.type === "income") balances[tx.contact_id].balance -= amount;
    balances[tx.contact_id].debtTxs.push(tx);
  });

  const debtRows = Object.values(balances).filter(
    (row: any) => row.balance !== 0 || row.debtTxs.length > 0,
  );
  if (debtRows.length === 0) {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? "Hiện chưa có công nợ nào đang mở."
        : "You do not have any active debts right now.",
      asText(message.message_id),
    );
    return true;
  }

  const requestedContact = findBestNamedItem(
    debtRows,
    text,
    [(item: any) => item.name],
  );

  const totalOwedToYou = debtRows
    .filter((row: any) => row.balance > 0)
    .reduce((sum: number, row: any) => sum + row.balance, 0);
  const totalYouOwe = debtRows
    .filter((row: any) => row.balance < 0)
    .reduce((sum: number, row: any) => sum + Math.abs(row.balance), 0);

  const lines = requestedContact
    ? [
        languageIsVietnamese
          ? `Công nợ với ${requestedContact.name}:`
          : `Debt status with ${requestedContact.name}:`,
        `${requestedContact.balance > 0 ? "+" : ""}${formatAmount(Math.abs(Number(requestedContact.balance || 0)))}`,
        languageIsVietnamese
          ? requestedContact.balance > 0
            ? "Họ đang nợ bạn"
            : "Bạn đang nợ họ"
          : requestedContact.balance > 0
            ? "They owe you"
            : "You owe them",
      ]
    : [
        languageIsVietnamese ? "Tổng quan công nợ 🤝" : "Debt overview 🤝",
        languageIsVietnamese
          ? `Người đang nợ bạn: ${formatAmount(totalOwedToYou)}`
          : `Others owe you: ${formatAmount(totalOwedToYou)}`,
        languageIsVietnamese
          ? `Bạn đang nợ: ${formatAmount(totalYouOwe)}`
          : `You owe: ${formatAmount(totalYouOwe)}`,
        "",
        ...debtRows
          .sort((a: any, b: any) => Math.abs(b.balance) - Math.abs(a.balance))
          .slice(0, 5)
          .map((row: any, index: number) =>
            languageIsVietnamese
              ? `${index + 1}. ${row.name}: ${row.balance > 0 ? "+" : "-"}${formatAmount(Math.abs(Number(row.balance || 0)))}`
              : `${index + 1}. ${row.name}: ${row.balance > 0 ? "+" : "-"}${formatAmount(Math.abs(Number(row.balance || 0)))}`,
          ),
      ];

  const coachNote =
    (await buildDomainCoachNote(text, languageIsVietnamese, "debt", {
      totalOwedToYou,
      totalYouOwe,
      debts: debtRows.slice(0, 5).map((row: any) => ({
        name: row.name,
        balance: row.balance,
        transactions: row.debtTxs.length,
      })),
    }).catch(() => null)) ||
    (languageIsVietnamese
      ? "Các khoản công nợ lớn hoặc kéo dài là chỗ mình ưu tiên nhắc để bạn không bị quên dòng tiền."
      : "Large or aging debt balances are the first ones I’d keep visible so cash flow does not get fuzzy.");

  await sendMessage(
    chatId,
    `${lines.join("\n")}\n\n${languageIsVietnamese ? "Nhận xét của mình" : "My take"}:\n${coachNote}`,
    asText(message.message_id),
  );
  return true;
}

function categoryTypeLabel(type: string, languageIsVietnamese: boolean) {
  if (type === "income") return languageIsVietnamese ? "Thu nhập" : "Income";
  return languageIsVietnamese ? "Chi tiêu" : "Expense";
}

function categoryPathLabel(
  categories: Array<{ id: string; name?: string | null; parent_id?: string | null }>,
  categoryId?: string | null,
) {
  if (!categoryId) return "-";
  const byId = new Map(categories.map((category) => [category.id, category]));
  const parts: string[] = [];
  let current = categoryId;
  while (current && byId.get(current)) {
    const row = byId.get(current);
    parts.unshift(row?.name || "");
    current = row?.parent_id || "";
  }
  return parts.filter(Boolean).join(" > ");
}

async function handleCategoryCommand(
  message: TelegramMessage,
  link: any,
  text: string,
) {
  const normalized = normalizeText(text);
  if (
    !/^\/category\b/i.test(text) &&
    normalized !== "danh sach danh muc" &&
    normalized !== "danh sach danh muc chi tieu" &&
    normalized !== "danh sach danh muc thu nhap"
  ) {
    return false;
  }

  const chatId = asText(message.chat.id);
  const languageIsVietnamese = detectVietnamese(text);
  const context = await loadContext(link.user_id, link.default_wallet_id);

  if (
    /^\/category\s*$/.test(text) ||
    /^\/category\s+help$/i.test(text)
  ) {
    await sendMessage(
      chatId,
      languageIsVietnamese
        ? [
            "Mình hỗ trợ category qua các lệnh này nè:",
            "- /category list",
            "- /category create expense Ăn uống > Ăn khuya",
            "- /category create income Thưởng",
            "- /category edit Ăn khuya => Ăn tối muộn",
            "- /category delete Ăn tối muộn",
          ].join("\n")
        : [
            "Here are the category commands I support:",
            "- /category list",
            "- /category create expense Food > Late night food",
            "- /category create income Bonus",
            "- /category edit Late night food => Supper",
            "- /category delete Supper",
          ].join("\n"),
      asText(message.message_id),
    );
    return true;
  }

  if (
    /^\/category\s+list$/i.test(text) ||
    normalized === "danh sach danh muc" ||
    normalized === "danh sach danh muc chi tieu" ||
    normalized === "danh sach danh muc thu nhap"
  ) {
    const typeFilter =
      normalized.includes("thu nhap") ? "income" : normalized.includes("chi tieu") ? "expense" : null;
    const rows = (context.categories || [])
      .filter((category: any) => !typeFilter || category.type === typeFilter)
      .sort((a: any, b: any) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0) || (a.name || "").localeCompare(b.name || ""));
    await sendMessage(
      chatId,
      [
        languageIsVietnamese ? "Danh sách category:" : "Category list:",
        ...rows.map((category: any) => `- ${categoryPathLabel(context.categories, category.id)} [${categoryTypeLabel(category.type, languageIsVietnamese)}]`),
      ].join("\n"),
      asText(message.message_id),
    );
    return true;
  }

  const createMatch = text.match(/^\/category\s+create\s+(expense|income)\s+(.+)$/i);
  if (createMatch) {
    const type = createMatch[1].toLowerCase();
    const rawPath = createMatch[2].trim();
    const segments = rawPath.split(">").map((part) => part.trim()).filter(Boolean);
    if (segments.length === 0) {
      await sendMessage(chatId, languageIsVietnamese ? "Mình chưa thấy tên category." : "I could not see the category name.", asText(message.message_id));
      return true;
    }
    const name = segments[segments.length - 1];
    let parentId: string | null = null;
    if (segments.length > 1) {
      const parentName = segments.slice(0, -1).join(" > ");
      const parent = findBestNamedItem(context.categories, parentName, [(item: any) => categoryPathLabel(context.categories, item.id), (item: any) => item.name]);
      if (!parent) {
        await sendMessage(
          chatId,
          languageIsVietnamese
            ? `Mình chưa tìm thấy category cha "${parentName}".`
            : `I could not find the parent category "${parentName}".`,
          asText(message.message_id),
        );
        return true;
      }
      parentId = parent.id;
    }

    const duplicate = (context.categories || []).find(
      (category: any) =>
        normalizeText(category.name || "") === normalizeText(name) &&
        (category.parent_id || null) === parentId &&
        category.type === type,
    );
    if (duplicate) {
      await sendMessage(
        chatId,
        languageIsVietnamese
          ? "Category này đã tồn tại rồi nha."
          : "That category already exists.",
        asText(message.message_id),
      );
      return true;
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        user_id: link.user_id,
        name,
        type,
        parent_id: parentId,
      })
      .select()
      .single();
    if (error) throw error;

    await sendMessage(
      chatId,
      languageIsVietnamese
        ? `Đã tạo category: ${categoryPathLabel([...context.categories, data], data.id)}`
        : `Created category: ${categoryPathLabel([...context.categories, data], data.id)}`,
      asText(message.message_id),
    );
    return true;
  }

  const editMatch = text.match(/^\/category\s+edit\s+(.+?)\s*=>\s*(.+)$/i);
  if (editMatch) {
    const existing = findBestNamedItem(
      context.categories,
      editMatch[1].trim(),
      [(item: any) => categoryPathLabel(context.categories, item.id), (item: any) => item.name],
    );
    if (!existing) {
      await sendMessage(
        chatId,
        languageIsVietnamese ? "Mình chưa tìm thấy category cần sửa." : "I could not find the category to edit.",
        asText(message.message_id),
      );
      return true;
    }

    const { error } = await supabase
      .from("categories")
      .update({ name: editMatch[2].trim(), updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("user_id", link.user_id);
    if (error) throw error;

    await sendMessage(
      chatId,
      languageIsVietnamese
        ? `Đã đổi tên category thành "${editMatch[2].trim()}".`
        : `Renamed category to "${editMatch[2].trim()}".`,
      asText(message.message_id),
    );
    return true;
  }

  const deleteMatch = text.match(/^\/category\s+(?:delete|remove|xoa|xóa)\s+(.+)$/i);
  if (deleteMatch) {
    const target = findBestNamedItem(
      context.categories,
      deleteMatch[1].trim(),
      [(item: any) => categoryPathLabel(context.categories, item.id), (item: any) => item.name],
    );
    if (!target) {
      await sendMessage(
        chatId,
        languageIsVietnamese ? "Mình chưa tìm thấy category cần xóa." : "I could not find the category to delete.",
        asText(message.message_id),
      );
      return true;
    }

    const { count } = await supabase
      .from("transactions")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", link.user_id)
      .eq("category_id", target.id);
    if ((count || 0) > 0) {
      await sendMessage(
        chatId,
        languageIsVietnamese
          ? `Category này đang gắn với ${count} giao dịch, nên mình chưa xóa để tránh mất link dữ liệu.`
          : `This category is still linked to ${count} transactions, so I’m not deleting it yet.`,
        asText(message.message_id),
      );
      return true;
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", target.id)
      .eq("user_id", link.user_id);
    if (error) throw error;

    await sendMessage(
      chatId,
      languageIsVietnamese
        ? `Đã xóa category "${target.name}".`
        : `Deleted category "${target.name}".`,
      asText(message.message_id),
    );
    return true;
  }

  await sendMessage(
    chatId,
    languageIsVietnamese
      ? "Mình chưa hiểu lệnh category này. Gửi `/category` để xem cú pháp nha."
      : "I could not understand that category command. Send `/category` to see the syntax.",
    asText(message.message_id),
  );
  return true;
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
    ? eventQuery
        .eq("bot_message_id", botMessageId)
        .order("created_at", { ascending: true })
    : eventQuery
        .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

  const { data: events, error } = await eventQuery;
  if (error) throw error;
  if (!events || events.length === 0) {
    await sendMessage(
      chatId,
      "I could not find the transaction for that replied message.",
      asText(message.message_id),
    );
    return;
  }

  const event = events[0];
  const transactionIds = [...new Set(events.map((item) => item.transaction_id))];
  const isBatchReply = transactionIds.length > 1;

  const context = await loadContext(link.user_id, link.default_wallet_id);
  if (/^(sua|sửa|edit|change|update)\s*$/i.test(normalizeText(text))) {
    await sendMessage(
      chatId,
      detectVietnamese(text)
        ? [
            isBatchReply
              ? `Mình đang nhắm vào ${transactionIds.length} giao dịch trong tin template đó nha 👍`
              : "Đang nhắm đúng giao dịch bạn vừa reply đó nha 👍",
            "",
            ...(isBatchReply
              ? [
                  "Hiện tại với reply nhiều giao dịch, mình hỗ trợ:",
                  "- xóa",
                  "",
                  "Nếu muốn sửa, mình sẽ nâng tiếp theo kiểu bulk edit riêng cho Telegram.",
                ]
              : [
                  "Bạn có thể sửa theo cú pháp:",
                  "- sửa tiền 90000",
                  "- sửa ví tài khoản",
                  "- sửa danh mục mua quà",
                  "- sửa người liên quan đồng nghiệp",
                  "- sửa mô tả góp tiền mua gà vịt",
                  "- sửa ngày hôm qua",
                  "- xóa",
                ]),
          ].join("\n")
        : [
            isBatchReply
              ? `I’m targeting ${transactionIds.length} transactions from that template reply 👍`
              : "I’m targeting the exact transaction you replied to 👍",
            "",
            ...(isBatchReply
              ? [
                  "For multi-transaction replies, I currently support:",
                  "- delete",
                  "",
                  "I can add Telegram bulk edit next.",
                ]
              : [
                  "You can edit it with:",
                  "- change amount 90000",
                  "- change wallet cash",
                  "- change category gifts",
                  "- change contact colleague",
                  "- change description lunch with team",
                  "- change date yesterday",
                  "- delete",
                ]),
          ].join("\n"),
      asText(message.message_id),
    );
    return;
  }
  const parsed = parseTelegramEdit(text, context);
  if (parsed.action === "delete") {
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .in("id", transactionIds)
      .eq("user_id", event.user_id);
    if (deleteError) throw deleteError;
    await sendMessage(
      chatId,
      detectVietnamese(text)
        ? isBatchReply
          ? `Đã xóa ${transactionIds.length} giao dịch từ template này.`
          : "Đã xóa transaction."
        : isBatchReply
          ? `Deleted ${transactionIds.length} transactions from that template.`
          : "Transaction deleted.",
      asText(message.message_id),
    );
    return;
  }

  if (isBatchReply) {
    await sendMessage(
      chatId,
      detectVietnamese(text)
        ? "Tin reply này đang gắn với nhiều giao dịch từ template. Hiện tại mình mới hỗ trợ `xóa` cả cụm; phần sửa hàng loạt mình sẽ nâng tiếp."
        : "That reply is linked to multiple template-created transactions. For now I support deleting the whole batch; bulk edit can be added next.",
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
    .select(
      "*, wallet:wallets!wallet_id(name), to_wallet:wallets!to_wallet_id(name), category:categories(name), contact:contacts(name)",
    )
    .single();
  if (updateError) throw updateError;
  await rememberParse(
    event.user_id,
    event.source_text || text,
    "local",
    {
      ...parsedPayloadWithNames(
        {
          ok: true,
          type: tx.type,
          amount: Number(tx.amount),
          walletId: tx.wallet_id,
          toWalletId: tx.to_wallet_id,
          categoryId: tx.category_id,
          contactId: tx.contact_id,
          description: tx.description || "",
          date: tx.date,
          unmatched: [],
        },
        context,
      ),
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

async function handleGuidedDraftMessage(
  message: TelegramMessage,
  link: any,
  draft: any,
  text: string,
) {
  const payload = normalizeGuidedDraftPayload(draft.parsed_payload);
  if (!payload) return false;
  const context = await loadContext(link.user_id, link.default_wallet_id);
  const amount = extractSingleAmount(text);
  if (payload.guided_stage === "amount") {
    if (!amount || amount <= 0) {
      await sendMessage(
        asText(message.chat.id),
        payload.language === "vi"
          ? "Mình chưa thấy số tiền rõ lắm. Bạn thử kiểu `85k`, `1.2tr`, `200000` nha."
          : "I still could not read the amount clearly. Try something like `85k`, `1.2m`, or `200000`.",
        asText(message.message_id),
      );
      return true;
    }
    payload.transaction.amount = amount;
    payload.transaction.description = payload.transaction.description || "";
    await promptGuidedStage(link, message, context, payload);
    return true;
  }

  if (payload.guided_stage === "description") {
    payload.transaction.description = text.trim();
    payload.transaction.unmatched = [];
    const parsed: ParsedOkTransaction = {
      ok: true,
      ...payload.transaction,
    };
    await insertTransactionAndReply(
      link,
      message,
      parsed,
      payload.transaction.description || payload.guided_type,
      "guided",
    );
    await clearPendingDraft(message);
    return true;
  }

  return true;
}

async function resolveParsedTransaction(
  text: string,
  context: Awaited<ReturnType<typeof loadContext>>,
) {
  const memories = await loadAiMemories(context.userId, text);
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
    await sendMessage(chatId, parsed.reason, asText(message.message_id));
    return;
  }

  const missingField = nextDraftField(parsed);
  if (missingField) {
    await savePendingDraft(
      link,
      message,
      sourceText,
      parsed,
      dedupeDraftFields(parsed.unmatched),
    );
    await askDraftField(
      chatId,
      asText(message.message_id),
      parsed,
      missingField,
      context,
      languageIsVietnamese,
      sourceText,
      profile,
    );
    return;
  }

  await insertTransactionAndReply(
    link,
    message,
    parsed,
    sourceText,
    parser,
    parsed.unmatched,
  );
  if (pendingDraft) await clearPendingDraft(message);
}

async function handleCallbackQuery(callback: TelegramCallbackQuery) {
  const data = callback.data || "";
  const message = callback.message;
  if (!message) {
    await answerCallbackQuery(callback.id);
    return;
  }

  const chatId = asText(message.chat.id);
  const link = await getLinkByTelegramUserId(asText(callback.from.id));
  if (!link) {
    await answerCallbackQuery(callback.id, "Bạn cần link tài khoản trước nha.");
    return;
  }

  if (data.startsWith("template:run:")) {
    const templateId = data.split(":")[2];
    const templates = await loadTemplates(link.user_id);
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      await answerCallbackQuery(callback.id, "Template này không còn nữa.");
      return;
    }
    await answerCallbackQuery(callback.id, "Đang chạy template...");
    await runTemplate(
      {
        ...message,
        from: callback.from,
      },
      link,
      template,
    );
    return;
  }

  if (!data.startsWith("draft:") && !data.startsWith("guided:")) {
    await answerCallbackQuery(callback.id);
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

  const context = await loadContext(link.user_id, link.default_wallet_id);
  const guidedPayload = normalizeGuidedDraftPayload(draft.parsed_payload);
  if (data === "guided:cancel") {
    await supabase
      .from("telegram_pending_transaction_drafts")
      .delete()
      .eq("id", draft.id)
      .eq("user_id", link.user_id);
    await answerCallbackQuery(callback.id, "Đã hủy.");
    await editMessageText(
      chatId,
      asText(message.message_id),
      guidedPayload?.language === "en"
        ? "Cancelled. Start again anytime with /expense, /income, or /transfer."
        : "Đã hủy nha. Khi nào cần thì gọi lại bằng /expense, /income hoặc /transfer.",
    ).catch(() => null);
    return;
  }

  if (data.startsWith("guided:") && guidedPayload) {
    const [, field, value] = data.split(":");
    const languageIsVietnamese = guidedPayload.language === "vi";
    if (field === "description" && value === "skip") {
      guidedPayload.transaction.description =
        guidedPayload.transaction.description ||
        (languageIsVietnamese
          ? guidedPayload.guided_type === "expense"
            ? "Chi tiêu"
            : guidedPayload.guided_type === "income"
              ? "Nhận tiền"
              : "Chuyển tiền"
          : guidedPayload.guided_type);
      const parsed: ParsedOkTransaction = {
        ok: true,
        ...guidedPayload.transaction,
      };
      await insertTransactionAndReply(
        link,
        { ...message, from: callback.from },
        parsed,
        guidedPayload.transaction.description,
        "guided",
      );
      await supabase
        .from("telegram_pending_transaction_drafts")
        .delete()
        .eq("id", draft.id)
        .eq("user_id", link.user_id);
      await answerCallbackQuery(callback.id, "Đã lưu.");
      await editMessageText(
        chatId,
        asText(message.message_id),
        languageIsVietnamese
          ? "Đã lưu giao dịch bằng guided flow."
          : "Saved via guided flow.",
      ).catch(() => null);
      return;
    }

    const chosenMessage = { ...message, from: callback.from };
    if (field === "wallet") {
      guidedPayload.transaction.walletId = value;
    } else if (field === "toWallet") {
      guidedPayload.transaction.toWalletId = value;
    } else if (field === "category") {
      guidedPayload.transaction.categoryId = value === "skip" ? null : value;
    } else if (field === "contact") {
      guidedPayload.transaction.contactId = value === "skip" ? null : value;
    } else {
      await answerCallbackQuery(callback.id);
      return;
    }

    await answerCallbackQuery(callback.id, "Đã nhận lựa chọn.");
    await editMessageText(
      chatId,
      asText(message.message_id),
      languageIsVietnamese
        ? "Đã lưu lựa chọn, mình hỏi bước tiếp theo nè."
        : "Saved your choice. Moving to the next step.",
    ).catch(() => null);
    await promptGuidedStage(link, chosenMessage, context, guidedPayload);
    return;
  }

  const [, field, value] = data.split(":");
  const parsed = parsedFromDraftPayload(draft.parsed_payload || {});
  const languageIsVietnamese = detectVietnamese(draft.source_text || "");
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
      languageIsVietnamese
        ? `Đã chọn ví nguồn: ${wallet.name}`
        : `Source wallet selected: ${wallet.name}`,
    );
  } else if (field === "toWallet") {
    const wallet = context.wallets.find((item: any) => item.id === value);
    if (!wallet) {
      await answerCallbackQuery(callback.id, "Ví nhận này không còn tồn tại.");
      return;
    }
    parsed.toWalletId = wallet.id;
    parsed.unmatched = parsed.unmatched.filter((item) => item !== "toWallet");
    await editMessageText(
      chatId,
      asText(message.message_id),
      languageIsVietnamese
        ? `Đã chọn ví nhận: ${wallet.name}`
        : `Destination wallet selected: ${wallet.name}`,
    );
  } else if (field === "category") {
    if (value === "skip") {
      parsed.categoryId = null;
      parsed.unmatched = parsed.unmatched.filter((item) => item !== "category");
      await editMessageText(
        chatId,
        asText(message.message_id),
        languageIsVietnamese
          ? "Đã bỏ qua danh mục cho giao dịch này."
          : "Skipped category for this transaction.",
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
        languageIsVietnamese
          ? `Đã chọn danh mục: ${category.name}`
          : `Category selected: ${category.name}`,
      );
    }
  } else if (field === "contact") {
    if (value === "skip") {
      parsed.contactId = null;
      parsed.unmatched = parsed.unmatched.filter((item) => item !== "contact");
      await editMessageText(
        chatId,
        asText(message.message_id),
        languageIsVietnamese
          ? "Đã bỏ qua người liên quan cho giao dịch này."
          : "Skipped contact for this transaction.",
      );
    } else {
      const contact = context.contacts.find((item: any) => item.id === value);
      if (!contact) {
        await answerCallbackQuery(
          callback.id,
          "Người liên quan này không còn tồn tại.",
        );
        return;
      }
      parsed.contactId = contact.id;
      parsed.unmatched = parsed.unmatched.filter((item) => item !== "contact");
      await editMessageText(
        chatId,
        asText(message.message_id),
        languageIsVietnamese
          ? `Đã chọn người liên quan: ${contact.name}`
          : `Contact selected: ${contact.name}`,
      );
    }
  } else {
    await answerCallbackQuery(callback.id);
    return;
  }

  await answerCallbackQuery(callback.id, "Đã nhận lựa chọn.");
  const remainingMissingFields = dedupeDraftFields(parsed.unmatched);
  const nextField = nextDraftField({
    ...parsed,
    unmatched: remainingMissingFields,
  });
  if (nextField) {
    await supabase
      .from("telegram_pending_transaction_drafts")
      .update({
        parsed_payload: {
          ...parsedPayload(parsed),
          missing_fields: remainingMissingFields,
          field_confidence: parsed.fieldConfidence || {},
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .eq("user_id", link.user_id);
    await askDraftField(
      chatId,
      draft.source_message_id,
      {
        ...parsed,
        unmatched: remainingMissingFields,
      },
      nextField,
      context,
      languageIsVietnamese,
      draft.source_text || parsed.description,
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
      await setTelegramCommands();
      await sendMessage(
        chatId,
        "Mình đây, trợ lý tài chính cá nhân bản dễ tính của bạn 😄\n\nĐể bắt đầu: mở Budget Manager Settings, tạo Telegram link code, rồi gửi /link 123456 ở đây.\n\nSau khi link xong, bạn có thể:\n- dùng menu lệnh `/expense`, `/income`, `/transfer`\n- bấm keyboard nhanh như `💸 Ghi chi tiêu`\n- nhắn tự nhiên để mình tự parse\n- hỏi report kiểu `tóm tắt chi tiêu tháng này`",
        { replyMarkup: BOT_SHORTCUT_KEYBOARD },
      );
      return jsonResponse({ ok: true });
    }

    if (text === "/help" || normalizeText(text) === "huong dan" || text === "❓ Hướng dẫn") {
      await setTelegramCommands();
      await sendMessage(
        chatId,
        [
          "Mình hỗ trợ 3 kiểu dùng chính nè:",
          "",
          "1. Nhắn tự nhiên",
          "- ăn trưa 85k bằng tiền mặt",
          "- nhận lương 20tr vào tài khoản",
          "- chuyển 2tr từ tiền mặt sang tiết kiệm",
          "",
          "2. Ghi từng bước",
          "- /expense hoặc bấm `💸 Ghi chi tiêu`",
          "- /income hoặc bấm `💰 Ghi nhận tiền`",
          "- /transfer hoặc bấm `🔁 Ghi chuyển tiền`",
          "",
          "3. Template + báo cáo",
          "- /templates",
          "- /template create ...",
          "- tóm tắt chi tiêu tháng này",
        ].join("\n"),
        { replyToMessageId: asText(message.message_id), replyMarkup: BOT_SHORTCUT_KEYBOARD },
      );
      return jsonResponse({ ok: true });
    }

    const linkMatch = text.match(/^\/link\s+(\d{6})/);
    if (linkMatch) {
      await handleLink(message, linkMatch[1]);
      await setTelegramCommands();
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

    if (text === "/report" || text === "📊 Báo cáo tháng này") {
      await sendMessage(
        chatId,
        "Bạn có thể hỏi mình kiểu:\n- tóm tắt chi tiêu tháng này\n- tóm tắt chi tiêu 7 ngày qua\n- báo cáo tài chính 3 tháng gần đây\n- lĩnh vực tôi chi nhiều nhất tháng này là gì",
        { replyToMessageId: asText(message.message_id), replyMarkup: BOT_SHORTCUT_KEYBOARD },
      );
      return jsonResponse({ ok: true });
    }

    if (text === "📚 Templates") {
      await listTemplates(message, link);
      return jsonResponse({ ok: true });
    }

    const guidedType = guidedShortcutType(text);
    if (guidedType) {
      await startGuidedDraft(
        message,
        link,
        guidedType,
        isVietnameseLanguage(text) ? "vi" : "en",
      );
      return jsonResponse({ ok: true });
    }

    const pendingDraft = await loadPendingDraft(message);
    if (pendingDraft && normalizeGuidedDraftPayload(pendingDraft.parsed_payload)) {
      await handleGuidedDraftMessage(message, link, pendingDraft, text);
      return jsonResponse({ ok: true });
    }

    if (message.reply_to_message) {
      if (looksLikeEditReply(text)) {
        await handleEdit(message, link, text);
      } else {
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
      }
    } else if (await handleTemplateCommand(message, link, text)) {
      // handled
    } else if (await handleCategoryCommand(message, link, text)) {
      // handled
    } else if (await handleBudgetInsights(message, link, text)) {
      // handled
    } else if (await handleGoalInsights(message, link, text)) {
      // handled
    } else if (await handleTravelInsights(message, link, text)) {
      // handled
    } else if (await handleDebtInsights(message, link, text)) {
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
