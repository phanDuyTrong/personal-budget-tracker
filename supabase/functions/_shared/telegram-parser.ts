export type TelegramItem = {
  id: string;
  name: string;
  type?: string | null;
  parent_id?: string | null;
  children?: TelegramItem[];
};

export type ParsedTransaction =
  | {
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
    }
  | {
      ok: false;
      reason: string;
    };

type ParseContext = {
  wallets: TelegramItem[];
  categories: TelegramItem[];
  contacts: TelegramItem[];
  defaultWalletId?: string | null;
  now?: Date;
  timeZone?: string;
};

type MatchResult = {
  item: TelegramItem;
  score: number;
  phrase: string;
};

const INCOME_KEYWORDS = [
  "luong",
  "nhan luong",
  "nhan tien",
  "thu nhap",
  "thu tien",
  "hoan tien",
  "refund",
  "salary",
  "received",
  "receive",
  "income",
  "paid back",
];

const TRANSFER_KEYWORDS = ["chuyen", "transfer", "move"];
const DATE_WORDS = ["hom nay", "today", "hom qua", "yesterday"];

export function normalizeText(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s/.,$₫-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function flattenTelegramItems(items: TelegramItem[] = []) {
  const flat: TelegramItem[] = [];
  const walk = (nodes: TelegramItem[]) => {
    nodes.forEach((item) => {
      flat.push(item);
      if (item.children) walk(item.children);
    });
  };
  walk(items);
  return flat;
}

function todayInTimeZone(now = new Date(), timeZone = "Asia/Ho_Chi_Minh") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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

function parseDate(text: string, now?: Date, timeZone?: string) {
  const normalized = normalizeText(text);
  const today = todayInTimeZone(now, timeZone);
  if (/\b(hom qua|yesterday)\b/.test(normalized)) return addDays(today, -1);
  if (/\b(hom nay|today)\b/.test(normalized)) return today;

  const iso = normalized.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso)
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const slash = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const todayYear = today.slice(0, 4);
    const rawYear = slash[3] || todayYear;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  }

  return today;
}

function parseAmount(text: string) {
  const matches = [
    ...text.matchAll(
      /(?:[$₫]\s*)?(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|ngan|ngàn|tr|trieu|m|million|usd|dollars?|vnd|₫|d)?\b/gi,
    ),
  ];
  const moneyMatch =
    matches.find((match) => {
      const unit = normalizeText(match[2] || "");
      const token = match[0];
      return Boolean(unit) || token.includes("$") || token.includes("₫");
    }) ||
    matches.find(
      (match) =>
        !text
          .slice(
            Math.max(0, match.index - 1),
            match.index + match[0].length + 1,
          )
          .includes("/"),
    );

  if (!moneyMatch) return null;
  const raw = moneyMatch[1].replace(",", ".");
  let amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount)) return null;

  const unit = normalizeText(moneyMatch[2] || "");
  if (["k", "nghin", "ngan", "ngan"].includes(unit)) amount *= 1000;
  if (["tr", "trieu", "m", "million"].includes(unit)) amount *= 1000000;

  return {
    amount: Math.round(amount * 100) / 100,
    raw: moneyMatch[0],
  };
}

function detectType(text: string): "expense" | "income" | "transfer" {
  const normalized = normalizeText(text);
  if (TRANSFER_KEYWORDS.some((keyword) => normalized.includes(keyword)))
    return "transfer";
  if (INCOME_KEYWORDS.some((keyword) => normalized.includes(keyword)))
    return "income";
  return "expense";
}

function scoreCandidate(text: string, name: string) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return 0;
  if (text.includes(normalizedName))
    return Math.min(100, 40 + normalizedName.length * 3);
  const words = normalizedName.split(" ").filter((word) => word.length > 1);
  const shared = words.filter((word) => text.includes(word));
  return shared.length === 0
    ? 0
    : shared.reduce((score, word) => score + Math.min(24, word.length * 4), 0);
}

function aliasesForItem(item: TelegramItem) {
  const normalized = normalizeText(item.name);
  const aliases = [item.name];
  if (normalized.includes("tien mat")) aliases.push("cash");
  if (normalized.includes("tiet kiem")) aliases.push("savings", "saving");
  if (normalized.includes("ngan hang")) aliases.push("bank", "tai khoan", "account");

  const looksLikeFoodCategory =
    normalized.includes("an uong") ||
    normalized.includes("do an") ||
    normalized.includes("mua do an") ||
    normalized.includes("food") ||
    normalized.includes("restaurant");
  if (looksLikeFoodCategory)
    aliases.push(
      "an kem",
      "an sang",
      "an trua",
      "an toi",
      "do an",
      "mua do an",
      "jolibee",
      "jollibee",
      "kfc",
      "mcdonald",
      "mcdonalds",
      "highlands",
      "phuc long",
      "cafe",
      "coffee",
      "food",
      "lunch",
      "dinner",
      "breakfast",
      "restaurant",
    );

  return aliases;
}

function findBest(
  items: TelegramItem[],
  text: string,
  minimum = 40,
): MatchResult | null {
  const normalized = normalizeText(text);
  const best = items
    .map((item) => {
      const bestAlias = aliasesForItem(item)
        .map((alias) => ({ alias, score: scoreCandidate(normalized, alias) }))
        .sort((a, b) => b.score - a.score)[0];
      return {
        item,
        score: bestAlias?.score || 0,
        phrase: bestAlias?.alias || item.name,
      };
    })
    .sort((a, b) => b.score - a.score)[0];
  return best && best.score >= minimum ? best : null;
}

function findWalletFromSegment(
  wallets: TelegramItem[],
  text: string,
  labels: string[],
) {
  const normalized = normalizeText(text);
  for (const label of labels) {
    const labelMatch = normalized.match(
      new RegExp(
        `\\b${label}\\b\\s+(.+?)(?=\\b(?:sang|to|vao|into|from|tu|bang|with|hom|today|yesterday)\\b|$)`,
      ),
    );
    if (labelMatch) {
      const match = findBest(wallets, labelMatch[1], 25);
      if (match) return match;
    }
  }
  return null;
}

function cleanDescription(
  text: string,
  amountRaw: string,
  matches: Array<MatchResult | null>,
) {
  let description = text;
  description = description.replace(amountRaw, " ");
  DATE_WORDS.forEach((word) => {
    description = description.replace(new RegExp(`\\b${word}\\b`, "ig"), " ");
  });
  matches.filter(Boolean).forEach((match) => {
    const escaped = match!.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    description = description.replace(
      new RegExp(
        `\\b(?:bang|with|from|tu|sang|to|vao|into)?\\s*${escaped}\\b`,
        "ig",
      ),
      " ",
    );
  });
  description = description.replace(
    /\b(?:transfer|chuyen|from|to|tu|sang|bang|with|vao|into)\b/gi,
    " ",
  );
  description = description.replace(/\b(?:bằng|từ|vào)\b/gi, " ");
  return (
    description.replace(/\s+/g, " ").trim() || text.replace(/\s+/g, " ").trim()
  );
}

export function parseTelegramTransaction(
  input: string,
  context: ParseContext,
): ParsedTransaction {
  const amount = parseAmount(input);
  if (!amount || amount.amount <= 0) {
    return {
      ok: false,
      reason:
        "I could not detect an amount. Try “lunch 85k from cash” or “ăn trưa 85k bằng tiền mặt”.",
    };
  }

  const type = detectType(input);
  const wallets = context.wallets.filter(
    (wallet) => !wallet.type || wallet.type !== "deleted",
  );
  const categories = flattenTelegramItems(context.categories).filter(
    (category) =>
      !category.type ||
      category.type === type ||
      (type === "transfer" ? false : true),
  );
  const contacts = context.contacts;
  const fromWallet =
    type === "transfer"
      ? findWalletFromSegment(wallets, input, ["from", "tu"])
      : findWalletFromSegment(wallets, input, [
          "from",
          "tu",
          "bang",
          "with",
          "vao",
          "into",
        ]) || findBest(wallets, input, 45);
  const toWallet =
    type === "transfer"
      ? findWalletFromSegment(wallets, input, ["to", "sang", "vao", "into"])
      : null;

  if (type === "transfer" && !toWallet) {
    return {
      ok: false,
      reason:
        "Transfer needs a destination wallet. Please resend with “from wallet A to wallet B” or “từ ví A sang ví B”.",
    };
  }

  const category = type === "transfer" ? null : findBest(categories, input, 55);
  const contact = findBest(contacts, input, 60);
  const walletId = fromWallet?.item.id || context.defaultWalletId || null;
  if (!walletId) {
    return {
      ok: false,
      reason:
        "I could not match a wallet. Please mention one, like “bằng tiền mặt”, “vào Techcombank”, or “from cash”.",
    };
  }
  const description = cleanDescription(input, amount.raw, [
    fromWallet,
    toWallet,
    contact,
  ]);
  const unmatched: string[] = [];
  if (!category && type !== "transfer") unmatched.push("category");

  return {
    ok: true,
    type,
    amount: amount.amount,
    date: parseDate(input, context.now, context.timeZone),
    description,
    walletId,
    toWalletId: toWallet?.item.id || null,
    categoryId: category?.item.id || null,
    contactId: contact?.item.id || null,
    unmatched,
  };
}

export type ParsedEdit = {
  action: "delete" | "update" | "none";
  changes?: {
    amount?: number;
    walletId?: string;
    toWalletId?: string | null;
    categoryId?: string | null;
    description?: string;
    date?: string;
  };
  reason?: string;
};

export function parseTelegramEdit(
  input: string,
  context: ParseContext,
): ParsedEdit {
  const normalized = normalizeText(input);
  if (/^(xoa|delete|remove)\b/.test(normalized)) return { action: "delete" };
  if (!/^(sua|doi|change|update|edit)\b/.test(normalized))
    return { action: "none" };

  const changes: ParsedEdit["changes"] = {};
  const amount = parseAmount(input);
  if (/\b(tien|amount)\b/.test(normalized) && amount)
    changes.amount = amount.amount;

  if (/\b(vi|wallet)\b/.test(normalized)) {
    const wallet = findBest(context.wallets, input, 35);
    if (!wallet)
      return { action: "none", reason: "I could not match that wallet." };
    changes.walletId = wallet.item.id;
  }

  if (/\b(danh muc|category)\b/.test(normalized)) {
    const category = findBest(
      flattenTelegramItems(context.categories),
      input,
      35,
    );
    if (!category)
      return { action: "none", reason: "I could not match that category." };
    changes.categoryId = category.item.id;
  }

  if (/\b(ngay|date)\b/.test(normalized))
    changes.date = parseDate(input, context.now, context.timeZone);

  const descriptionMatch = input.match(
    /(?:sửa|doi|change|update|edit)\s+(?:mô tả|mo ta|description)\s+(.+)/i,
  );
  if (descriptionMatch) changes.description = descriptionMatch[1].trim();

  return Object.keys(changes).length > 0
    ? { action: "update", changes }
    : { action: "none", reason: "I could not detect what to change." };
}
