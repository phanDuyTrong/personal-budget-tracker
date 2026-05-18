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

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
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
    .select("source_text,parser,parsed_payload,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);
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

function isMissingWalletReason(reason = "") {
  return normalizeText(reason).includes("could not match a wallet");
}

async function savePendingDraft(
  link: any,
  message: TelegramMessage,
  sourceText: string,
  parsed: ParsedOkTransaction,
) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await supabase.from("telegram_pending_transaction_drafts").upsert(
    {
      user_id: link.user_id,
      telegram_user_id: asText(message.from?.id),
      chat_id: asText(message.chat.id),
      source_message_id: asText(message.message_id),
      source_text: sourceText,
      parsed_payload: { ...parsedPayload(parsed), wallet_id: null },
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

async function clearPendingDraft(message: TelegramMessage) {
  await supabase
    .from("telegram_pending_transaction_drafts")
    .delete()
    .eq("telegram_user_id", asText(message.from?.id))
    .eq("chat_id", asText(message.chat.id));
}

function compactItems(items: Array<{ name?: string | null; type?: string | null }>) {
  return items.map((item) => item.type ? `${item.name} (${item.type})` : item.name).filter(Boolean);
}

function findByName<T extends { name?: string | null }>(items: T[], name?: string | null) {
  const normalized = normalizeText(name || "");
  if (!normalized) return null;
  return (
    items.find((item) => normalizeText(item.name || "") === normalized) ||
    items.find((item) => {
      const itemName = normalizeText(item.name || "");
      return itemName && (normalized.includes(itemName) || itemName.includes(normalized));
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
    return { ok: false as const, reason: "AI could not detect a valid amount." };
  }

  const wallet = findByName(context.wallets, ai.walletName) || null;
  const toWallet = type === "transfer" ? findByName(context.wallets, ai.toWalletName) : null;
  const walletId = wallet?.id || context.defaultWalletId || null;
  if (!walletId) {
    return {
      ok: false as const,
      reason: "I could not match a wallet. Please mention one, like “bằng tiền mặt”, “vào Techcombank”, or “from cash”.",
    };
  }
  if (type === "transfer" && !toWallet) {
    return {
      ok: false as const,
      reason: "Transfer needs a destination wallet. Please resend with “from wallet A to wallet B” or “từ ví A sang ví B”.",
    };
  }

  const category = type === "transfer" ? null : findByName(context.categories, ai.categoryName);
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
    unmatched: [
      !category && type !== "transfer" ? "category" : null,
    ].filter(Boolean) as string[],
  };
}

async function parseTransactionWithAi(
  text: string,
  context: Awaited<ReturnType<typeof loadContext>>,
  memories: any[],
) {
  if (!aiParseApiKey) return null;

  const prompt = {
    task: "Parse one personal finance Telegram message into one transaction JSON. Preserve the user's language in description. Infer category and contact from meaning, Vietnamese wording, and prior corrected examples. Do not invent wallets/categories/contacts outside provided lists. Return JSON only.",
    message: text,
    today: todayInTimeZone(),
    allowedTypes: ["expense", "income", "transfer"],
    wallets: compactItems(context.wallets),
    categories: compactItems(context.categories),
    contacts: compactItems(context.contacts),
    recentUserExamples: memories.map((memory) => ({
      text: memory.source_text,
      parser: memory.parser,
      parsed: memory.parsed_payload,
    })),
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
      "Authorization": `Bearer ${aiParseApiKey}`,
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
      const trigger = template.trigger_normalized || normalizeText(template.trigger_text);
      return trigger.length >= 4 && (normalized.includes(trigger) || trigger.includes(normalized));
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

async function deleteTemplateByName(message: TelegramMessage, link: any, rawName: string) {
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

  const cleaned = text
    .replace(/^\/template\s+(?:add|create|tao|tạo)\s+/i, "")
    .replace(/^(?:tạo|tao)\s+(?:mẫu|mau|template)\s+/i, "");
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
    const parsed = item.parsed as Extract<ReturnType<typeof parseTelegramTransaction>, { ok: true }>;
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

async function handleTemplateCommand(message: TelegramMessage, link: any, text: string) {
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
  const localParsed = parseTelegramTransaction(text, context);
  const memories = await loadAiMemories(context.userId);
  const shouldAskAi =
    Boolean(aiParseApiKey) &&
    (aiParseMode === "always" ||
      !localParsed.ok ||
      (localParsed.ok && localParsed.unmatched.includes("category")));
  const aiParsed = shouldAskAi
    ? await parseTransactionWithAi(text, context, memories)
    : null;
  return {
    parsed: aiParsed?.ok ? aiParsed : localParsed,
    parser: (aiParsed?.ok ? "ai" : "local") as "local" | "ai",
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
  const textToParse = pendingDraft ? `${pendingDraft.source_text} ${text}` : text;
  const { parsed, parser } = await resolveParsedTransaction(textToParse, context);
  const languageIsVietnamese = detectVietnamese(text);

  if (!parsed.ok) {
    if (!pendingDraft && isMissingWalletReason(parsed.reason)) {
      const draftParsed = parseTelegramTransaction(text, {
        ...context,
        defaultWalletId: "__missing_wallet__",
      });
      if (draftParsed.ok) {
        await savePendingDraft(link, message, text, draftParsed);
        await sendMessage(
          chatId,
          detectVietnamese(text)
            ? `Mình đã hiểu ${formatAmount(draftParsed.amount)} cho “${draftParsed.description}”. Còn thiếu ví. Nhắn tiếp tên ví, ví dụ “tài khoản”, “tiền mặt”, hoặc “momo”.`
            : `I understood ${formatAmount(draftParsed.amount)} for “${draftParsed.description}”. I still need the wallet. Send just the wallet name, like “cash” or “Techcombank”.`,
          asText(message.message_id),
        );
        return;
      }
    }
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
    else if (await handleTemplateCommand(message, link, text)) {
      // handled
    } else {
      const templates = await loadTemplates(link.user_id);
      const template = findTemplateMatch(templates, text);
      if (template) await runTemplate(message, link, template);
      else await handleTransaction(message, link, text);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
