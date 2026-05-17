const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = "gemini-1.5-flash";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeLabel(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function flattenCategoryTree(categories = []) {
  const flat = [];
  const walk = (nodes = [], parentName = "") => {
    nodes.forEach((category) => {
      const label = parentName
        ? `${parentName} / ${category.name}`
        : category.name;
      flat.push({ ...category, label });
      if (category.children) walk(category.children, label);
    });
  };
  walk(categories);
  return flat;
}

function findClosestByName(items = [], candidates = []) {
  const normalizedCandidates = candidates.map(normalizeLabel).filter(Boolean);
  if (normalizedCandidates.length === 0) return null;

  const scored = items
    .map((item) => {
      const names = [item.name, item.label].map(normalizeLabel).filter(Boolean);
      const score = normalizedCandidates.reduce((best, candidate) => {
        const localScore = names.reduce((nameBest, name) => {
          if (name === candidate) return Math.max(nameBest, 100);
          if (name.includes(candidate) || candidate.includes(name))
            return Math.max(nameBest, 75);
          const candidateWords = candidate.split(" ");
          const sharedWords = candidateWords.filter(
            (word) => word.length > 2 && name.includes(word),
          ).length;
          return Math.max(nameBest, sharedWords * 20);
        }, 0);
        return Math.max(best, localScore);
      }, 0);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score >= 40 ? scored[0].item : null;
}

function extractJson(text = "") {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI did not return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function askGemini(prompt) {
  if (!API_KEY || API_KEY === "your-gemini-api-key") {
    throw new Error(
      "Missing VITE_GEMINI_API_KEY. Add it to web/.env.local to use AI Quick Add.",
    );
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Gemini request failed (${response.status}): ${details.slice(0, 160)}`,
    );
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ||
    "";
  return extractJson(text);
}

export function buildTransactionDraft(parsed = {}, context = {}) {
  const wallets = context.wallets || [];
  const categories = flattenCategoryTree(context.categories || []);
  const contacts = context.contacts || [];
  const type = ["income", "transfer"].includes(parsed.type)
    ? parsed.type
    : "expense";
  const wallet = findClosestByName(wallets, [
    parsed.walletName,
    parsed.fromWalletName,
    parsed.fromWallet,
    parsed.wallet,
  ]);
  const toWallet = findClosestByName(wallets, [
    parsed.toWalletName,
    parsed.toWallet,
  ]);
  const category =
    type === "transfer"
      ? null
      : findClosestByName(categories, [
          parsed.subCategory,
          parsed.categoryName,
          parsed.category,
          parsed.mainCategory,
        ]);
  const contact = findClosestByName(contacts, [
    parsed.contactName,
    parsed.person,
    parsed.contact,
  ]);
  const amount = Number(parsed.amount);

  return {
    amount: Number.isFinite(amount) && amount > 0 ? String(amount) : "",
    type,
    walletId: wallet?.id || "",
    toWalletId: type === "transfer" ? toWallet?.id || "" : "",
    categoryId: category?.id || "",
    contactId: contact?.id || "",
    tripId: "",
    description: parsed.description || parsed.note || "",
    date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date || "")
      ? parsed.date
      : todayISO(),
    isRecurring: false,
    isDebt: Boolean(parsed.isDebt || parsed.debt),
  };
}

export const aiService = {
  async parseTransaction(input, options = {}) {
    const context = Array.isArray(options) ? { wallets: options } : options;
    const wallets = (context.wallets || []).map((wallet) => wallet.name);
    const categories = flattenCategoryTree(context.categories || []).map(
      (category) => category.label || category.name,
    );
    const contacts = (context.contacts || []).map((contact) => contact.name);

    const prompt = `You are a personal finance assistant for a Vietnamese/English budget tracker.
Parse the user's sentence into one JSON object only.

User input: "${input}"
Today: ${todayISO()}
Available wallets: ${JSON.stringify(wallets)}
Available categories: ${JSON.stringify(categories)}
Available contacts: ${JSON.stringify(contacts)}

Rules:
- type must be exactly "expense", "income", or "transfer".
- amount must be a plain number. Vietnamese shorthand like "50k" means 50000, "1tr" or "1 triệu" means 1000000.
- walletName/fromWalletName/toWalletName should use the closest available wallet name when the user mentions one. Otherwise null.
- categoryName/mainCategory/subCategory should use the closest available category when possible.
- contactName/person should use the closest available contact if a person is mentioned.
- date must be YYYY-MM-DD. If no date is mentioned, use today.
- description should be short, natural, and human-readable.
- isDebt should be true only when the sentence clearly means lending, borrowing, or debt.

Return JSON with this shape:
{
  "type": "expense",
  "amount": 50000,
  "description": "coffee with Minh",
  "date": "${todayISO()}",
  "mainCategory": "Food",
  "subCategory": "Coffee",
  "categoryName": "Coffee",
  "person": "Minh",
  "contactName": "Minh",
  "walletName": "Cash",
  "fromWalletName": "Cash",
  "toWalletName": null,
  "isDebt": false
}`;

    return askGemini(prompt);
  },

  async getInsights(transactions) {
    if (!API_KEY || transactions.length === 0) return null;
    const recentTx = transactions.slice(0, 50);
    const prompt = `Analyze these financial transactions and suggest one chart.
Transactions: ${JSON.stringify(
      recentTx.map((transaction) => ({
        date: transaction.date,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
      })),
    )}
Return JSON: { "insight": string, "chartType": "pie" | "bar" | "line", "chartData": array, "chartTitle": string }`;

    try {
      return await askGemini(prompt);
    } catch {
      return null;
    }
  },
};
