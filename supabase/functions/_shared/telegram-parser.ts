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
      tripId: string | null;
      isDebt: boolean;
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
  trips?: Array<TelegramItem & { destination?: string | null }>;
  defaultWalletId?: string | null;
  now?: Date;
  timeZone?: string;
};

type MatchResult = {
  item: TelegramItem;
  score: number;
  phrase: string;
};

export type DraftSelectionField =
  | "wallet"
  | "toWallet"
  | "category"
  | "contact";

export type DraftSelectionResult =
  | { kind: "select"; id: string; label: string }
  | { kind: "skip" }
  | { kind: "cancel" }
  | { kind: "unmatched" };

const INCOME_KEYWORDS = [
  "nhan",
  "luong",
  "nhan luong",
  "nhan tien",
  "thu nhap",
  "thu tien",
  "hoan tien",
  "co tuc",
  "cổ tức",
  "dividend",
  "lai",
  "lai suat",
  "lãi",
  "lãi suất",
  "refund",
  "salary",
  "received",
  "receive",
  "income",
  "paid back",
];

const TRANSFER_KEYWORDS = [
  "chuyen",
  "chuyen khoan",
  "transfer",
  "move",
  "doi vi",
  "nap",
  "rut",
  "nap vi",
  "rut vi",
];
const DATE_WORDS = ["hom nay", "today", "hom qua", "yesterday"];
const DEBT_KEYWORDS = [
  "cho muon",
  "mượn",
  "muon",
  "muon tien",
  "mượn tiền",
  "tra no",
  "trả nợ",
  "ung ho",
  "ứng hộ",
  "tam ung",
  "tạm ứng",
  "debt",
  "owe",
  "owes",
];
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

function normalizeTripYear(item: TelegramItem & { start_date?: string | null }) {
  const yearFromDate = item.start_date?.slice(0, 4);
  if (yearFromDate) return yearFromDate;
  const yearMatch = normalizeText(item.name || "").match(/\b(20\d{2})\b/);
  return yearMatch?.[1] || null;
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

function parseMoneyLikeText(value: string) {
  const text = value.trim().replace(/\s+/g, "");
  if (!text) return null;

  let normalized = text;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = /,\d{1,2}$/.test(normalized)
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (hasDot) {
    normalized = /\.\d{1,2}$/.test(normalized)
      ? normalized.replace(/,/g, "")
      : normalized.replace(/\./g, "");
  }

  normalized = normalized.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAmount(text: string) {
  const matches = [
    ...text.matchAll(
      /(?:[$₫]\s*)?(\d[\d.,]*)(?:\s*(k|nghin|ngan|ngan|ngàn|tr|trieu|m|million|usd|dollars?|vnd|₫|đ|d))?/gi,
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
  const amount = parseMoneyLikeText(moneyMatch[1]);
  if (amount === null) return null;

  const unit = normalizeText(moneyMatch[2] || "");
  let parsedAmount = amount;
  if (["k", "nghin", "ngan", "ngan"].includes(unit)) parsedAmount *= 1000;
  if (["tr", "trieu", "m", "million"].includes(unit)) parsedAmount *= 1000000;

  return {
    amount: Math.round(parsedAmount * 100) / 100,
    raw: moneyMatch[0],
  };
}

function hasTransferConnector(text: string) {
  return /\b(?:tu|from)\b.+\b(?:sang|qua|to|vao|into|ve|den)\b/.test(text);
}

function detectType(text: string): "expense" | "income" | "transfer" {
  const normalized = normalizeText(text);
  if (
    hasTransferConnector(normalized) ||
    TRANSFER_KEYWORDS.some((keyword) => normalized.includes(keyword))
  )
    return "transfer";
  if (
    /(?:^|\s)(?:nhan|thu|hoan tien|refund|salary|received|income)\b/.test(
      normalized,
    ) ||
    /\bcho\s+tien\b/.test(normalized)
  )
    return "income";
  if (INCOME_KEYWORDS.some((keyword) => normalized.includes(keyword)))
    return "income";
  return "expense";
}

function resolveCategoryLineageType(
  category: TelegramItem,
  categories: TelegramItem[],
) {
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  let current: TelegramItem | null = category;
  while (current) {
    if (current.type === "income" || current.type === "expense") {
      return current.type;
    }
    current = current.parent_id ? categoryMap.get(current.parent_id) || null : null;
  }
  return null;
}

function categoryMatchesType(
  category: TelegramItem,
  type: "expense" | "income" | "transfer",
  categories: TelegramItem[],
) {
  const lineageType = resolveCategoryLineageType(category, categories);
  if (type === "income") return lineageType === "income";
  if (type === "transfer") return lineageType !== "income";
  return lineageType !== "income";
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
  if (normalized.includes("ngan hang"))
    aliases.push("bank", "tai khoan", "account");

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

  if (normalized.includes("mua qua"))
    aliases.push(
      "gop tien",
      "gop tien mua",
      "mua qua",
      "cho qua",
      "mua ga",
      "mua vit",
      "gift",
      "present",
    );
  else if (normalized === "qua" || normalized.includes("gift"))
    aliases.push("mua qua", "cho qua", "gift", "present");

  const isIncomeRoot =
    Boolean(item.children?.length) ||
    normalized === "thu nhap" ||
    normalized === "income";
  if (isIncomeRoot)
    aliases.push(
      "thu nhap",
      "income",
      "thu nhap chinh",
      "thu nhap phu",
      "thu nhap khac",
    );
  else if (
    normalized.includes("luong") ||
    normalized.includes("salary") ||
    normalized.includes("received") ||
    normalized.includes("hoan tien") ||
    normalized.includes("refund") ||
    normalized.includes("lai") ||
    normalized.includes("dividend") ||
    normalized.includes("co tuc")
  ) {
    aliases.push(
      normalized,
      "luong",
      "nhan luong",
      "salary",
      "received",
      "refund",
      "hoan tien",
      "lai",
      "dividend",
      "co tuc",
    );
  }

  if (normalized.includes("dong nghiep"))
    aliases.push("anh bau", "dong nghiep", "team", "cong ty", "colleague");

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
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        normalizeText(a.item.name).length - normalizeText(b.item.name).length
      );
    })[0];
  return best && best.score >= minimum ? best : null;
}

function extractEditTarget(input: string, labels: string[]) {
  const match = input.match(
    new RegExp(
      `(?:sửa|doi|đổi|change|update|edit)\\s+(?:${labels.join("|")})(?:\\s+(?:thanh|thành|to|la|là))?\\s+(.+)`,
      "i",
    ),
  );
  return match?.[1]?.trim() || "";
}

function findExactByName(
  items: TelegramItem[],
  text: string,
) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  return items.find((item) => normalizeText(item.name || "") === normalized) || null;
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
        `\\b${label}\\b\\s+(.+?)(?=\\b(?:sang|qua|to|vao|into|from|tu|ve|den|bang|with|hom|today|yesterday)\\b|$)`,
      ),
    );
    if (labelMatch) {
      const match = findBest(wallets, labelMatch[1], 25);
      if (match) return match;
    }
  }
  return null;
}

function findWalletsAroundTransferConnector(
  wallets: TelegramItem[],
  text: string,
) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /(.+?)\b(?:sang|qua|to|vao|into|ve|den)\b\s+(.+?)(?=\b(?:hom|today|yesterday)\b|$)/,
  );
  if (!match) return { fromWallet: null, toWallet: null };
  return {
    fromWallet: findBest(wallets, match[1], 25),
    toWallet: findBest(wallets, match[2], 25),
  };
}

function findContactFromSegment(contacts: TelegramItem[], text: string) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /\b(?:cho|gui|tra|voi|with|for|to)\b\s+(.+?)(?=\b(?:bang|with|from|tu|sang|qua|vao|into|hom|today|yesterday)\b|$)/,
  );
  if (!match) return null;
  return findBest(contacts, match[1], 30);
}

function isSkipSelection(text: string) {
  return /\b(?:bo qua|bỏ qua|skip|khong can|không cần|none)\b/i.test(
    normalizeText(text),
  );
}

function isCancelSelection(text: string) {
  return /\b(?:huy|hủy|cancel|stop|thoat|thoát)\b/i.test(
    normalizeText(text),
  );
}

function extractContactSegment(text: string) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /\b(?:cho|gui|tra|voi|with|for|to)\b\s+(.+?)(?=\b(?:bang|with|from|tu|sang|qua|vao|into|hom|today|yesterday)\b|$)/,
  );
  return match?.[1]?.trim() || "";
}

function looksLikeContactIntent(text: string) {
  const segment = extractContactSegment(text);
  if (!segment) return false;
  if (segment.split(" ").length >= 2) return true;
  return /\b(?:anh|chi|chị|em|me|mẹ|ba|má|team|sep|sếp|dong nghiep|đồng nghiệp|khach|khách|doi tac|đối tác|friend|mom|dad|boss|client|colleague)\b/i.test(
    segment,
  );
}

function looksLikeDebtIntent(text: string) {
  const normalized = normalizeText(text);
  return DEBT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function cleanDescription(
  text: string,
  amountRaw: string,
  type: "expense" | "income" | "transfer",
  matches: Array<MatchResult | null>,
) {
  let description = text;
  description = description.replace(amountRaw, " ");
  description = description.replace(
    /\b\d+(?:[.,]\d+)?\s*(?:k|nghin|ngan|ngàn|tr|trieu|m|million|usd|dollars?|vnd|₫|đ|d)\b/gi,
    " ",
  );
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
    /\b(?:transfer|chuyen|move|rut|nap|from|to|tu|sang|qua|ve|den|bang|with|vao|into)\b/gi,
    " ",
  );
  description = description.replace(
    /\b(?:bằng|từ|vào|sang|qua|về|đến)\b/gi,
    " ",
  );
  if (type === "transfer") {
    description = description.replace(
      /^\s*(?:chuyển|transfer|move|nạp|rút)\b[:\s-]*/i,
      "",
    );
  }
  description = description.replace(/\b[đ₫]\b/gi, " ");
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
  const allCategories = flattenTelegramItems(context.categories);
  const categories = flattenTelegramItems(context.categories).filter(
    (category) => categoryMatchesType(category, type, allCategories),
  );
  const contacts = context.contacts;
  const connectorWallets =
    type === "transfer"
      ? findWalletsAroundTransferConnector(wallets, input)
      : { fromWallet: null, toWallet: null };
  const fromWallet =
    type === "transfer"
      ? findWalletFromSegment(wallets, input, ["from", "tu"]) ||
        connectorWallets.fromWallet
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
      ? findWalletFromSegment(wallets, input, [
          "to",
          "sang",
          "qua",
          "vao",
          "into",
          "ve",
          "den",
        ]) || connectorWallets.toWallet
      : null;

  const category = type === "transfer" ? null : findBest(categories, input, 55);
  const contact =
    findContactFromSegment(contacts, input) ||
    (looksLikeContactIntent(input) ? findBest(contacts, input, 60) : null);
  const walletId = fromWallet?.item.id || context.defaultWalletId || "";
  const description = cleanDescription(
    input,
    amount.raw,
    type,
    [
      fromWallet,
      toWallet,
      contact,
    ],
  );
  const unmatched: string[] = [];
  const sameWalletTransfer =
    type === "transfer" &&
    Boolean(walletId) &&
    Boolean(toWallet?.item.id) &&
    walletId === toWallet?.item.id;
  if (!walletId) unmatched.push("wallet");
  if (type === "transfer" && (!toWallet || sameWalletTransfer))
    unmatched.push("toWallet");
  if (!category && type !== "transfer") unmatched.push("category");
  if (!contact && looksLikeContactIntent(input)) unmatched.push("contact");

  return {
    ok: true,
    type,
    amount: amount.amount,
    date: parseDate(input, context.now, context.timeZone),
    description,
    walletId,
    toWalletId: sameWalletTransfer ? null : toWallet?.item.id || null,
    categoryId: category?.item.id || null,
    contactId: contact?.item.id || null,
    tripId: null,
    isDebt: looksLikeDebtIntent(input),
    unmatched,
  };
}

export function resolveTelegramDraftSelection(
  input: string,
  field: DraftSelectionField,
  context: ParseContext,
  options: {
    type?: "expense" | "income" | "transfer";
    walletId?: string | null;
  } = {},
): DraftSelectionResult {
  if (isCancelSelection(input)) return { kind: "cancel" };
  if (
    isSkipSelection(input) &&
    (field === "category" || field === "contact")
  ) {
    return { kind: "skip" };
  }

  if (field === "wallet" || field === "toWallet") {
    const wallets = context.wallets.filter(
      (wallet) =>
        !wallet.type || wallet.type !== "deleted",
    );
    const candidates =
      field === "toWallet" && options.walletId
        ? wallets.filter((wallet) => wallet.id !== options.walletId)
        : wallets;
    const wallet =
      findExactByName(candidates, input) ||
      findBest(candidates, input, 30)?.item ||
      null;
    return wallet
      ? { kind: "select", id: wallet.id, label: wallet.name }
      : { kind: "unmatched" };
  }

  if (field === "category") {
    const allCategories = flattenTelegramItems(context.categories);
    const categories = allCategories.filter(
      (category) =>
        categoryMatchesType(
          category,
          options.type || "expense",
          allCategories,
        ),
    );
    const category =
      findExactByName(categories, input) ||
      findBest(categories, input, 35)?.item ||
      null;
    return category
      ? { kind: "select", id: category.id, label: category.name }
      : { kind: "unmatched" };
  }

  const contact =
    findExactByName(context.contacts, input) ||
    findBest(context.contacts, input, 30)?.item ||
    null;
  return contact
    ? { kind: "select", id: contact.id, label: contact.name }
    : { kind: "unmatched" };
}

export function findExplicitTripMatch(
  trips: Array<TelegramItem & { destination?: string | null; start_date?: string | null }>,
  text: string,
) {
  const normalized = normalizeText(text);
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;

  const year = yearMatch[1];
  const candidates = trips.filter((trip) => {
    const tripYear = normalizeTripYear(trip);
    if (tripYear && tripYear !== year) return false;
    const destination = normalizeText(trip.destination || "");
    return destination ? normalized.includes(destination) : false;
  });

  if (candidates.length === 0) return null;

  return candidates
    .slice()
    .sort((a, b) => {
      const aDest = normalizeText(a.destination || "");
      const bDest = normalizeText(b.destination || "");
      return bDest.length - aDest.length;
    })[0];
}

export type ParsedEdit = {
  action: "delete" | "update" | "none";
  changes?: {
    amount?: number;
    walletId?: string;
    toWalletId?: string | null;
    categoryId?: string | null;
    contactId?: string | null;
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
    const walletTarget = extractEditTarget(input, ["vi", "wallet"]);
    const wallet =
      findExactByName(context.wallets, walletTarget) ||
      findBest(context.wallets, walletTarget || input, 35)?.item;
    if (!wallet)
      return { action: "none", reason: "I could not match that wallet." };
    changes.walletId = wallet.id;
  }

  if (/\b(danh muc|category)\b/.test(normalized)) {
    const categoryTarget = extractEditTarget(input, ["danh muc", "category"]);
    const categories = flattenTelegramItems(context.categories);
    const category =
      findExactByName(categories, categoryTarget) ||
      findBest(
        categories,
        categoryTarget || input,
        35,
      )?.item;
    if (!category)
      return { action: "none", reason: "I could not match that category." };
    changes.categoryId = category.id;
  }

  if (
    /\b(nguoi nhan|nguoi lien quan|lien quan|contact|person|recipient)\b/.test(
      normalized,
    )
  ) {
    const contactTarget = extractEditTarget(input, [
      "nguoi nhan",
      "nguoi lien quan",
      "lien quan",
      "contact",
      "person",
      "recipient",
    ]);
    const contact =
      findExactByName(context.contacts, contactTarget) ||
      findBest(context.contacts, contactTarget || input, 30)?.item;
    if (!contact)
      return { action: "none", reason: "I could not match that contact." };
    changes.contactId = contact.id;
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
