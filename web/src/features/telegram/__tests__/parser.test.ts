import { describe, expect, it } from "vitest";
import {
  findExplicitTripMatch,
  parseTelegramEdit,
  parseTelegramTransaction,
  resolveTelegramDraftSelection,
} from "../../../../../supabase/functions/_shared/telegram-parser";

const context = {
  now: new Date("2026-05-15T04:00:00.000Z"),
  timeZone: "Asia/Ho_Chi_Minh",
  defaultWalletId: "wallet-default",
  wallets: [
    { id: "wallet-cash", name: "Tiền mặt" },
    { id: "wallet-account", name: "Tài khoản" },
    { id: "wallet-tech", name: "Techcombank" },
    { id: "wallet-saving", name: "Savings" },
    { id: "wallet-default", name: "Default wallet" },
  ],
  categories: [
    { id: "cat-food", name: "Mua đồ ăn", type: "expense" },
    { id: "cat-gift", name: "Mua quà", type: "expense" },
    { id: "cat-travel-root", name: "Du lịch", type: "expense" },
    {
      id: "cat-travel-stay",
      name: "Khách sạn/Homestay",
      type: "expense",
      parent_id: "cat-travel-root",
    },
    { id: "cat-income-root", name: "Thu nhập", type: "income" },
    { id: "cat-income-salary", name: "Lương chính", parent_id: "cat-income-root" },
    { id: "cat-income-bonus", name: "Thưởng", parent_id: "cat-income-root" },
  ],
  contacts: [
    { id: "contact-colleague", name: "Đồng nghiệp" },
    { id: "contact-minh", name: "Minh" },
  ],
  trips: [
    {
      id: "trip-phu-yen",
      name: "[2026] Phú Yên với ín",
      destination: "Phú Yên",
    },
    {
      id: "trip-thai-lan",
      name: "[2025] Thái Lan với nhà cô sáu",
      destination: "Thái Lan",
    },
  ],
};

describe("parseTelegramTransaction", () => {
  it("parses Vietnamese expenses and keeps the user wording in description", () => {
    const result = parseTelegramTransaction(
      "ăn trưa 85k bằng tiền mặt",
      context,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.type).toBe("expense");
    expect(result.amount).toBe(85000);
    expect(result.walletId).toBe("wallet-cash");
    expect(result.categoryId).toBe("cat-food");
    expect(result.description).toBe("ăn trưa");
    expect(result.unmatched).not.toContain("contact");
  });

  it("parses English expenses", () => {
    const result = parseTelegramTransaction("lunch 85k from cash", context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.type).toBe("expense");
    expect(result.amount).toBe(85000);
    expect(result.categoryId).toBe("cat-food");
    expect(result.description).toBe("lunch");
  });

  it("matches food merchants and food words to the food category", () => {
    const result = parseTelegramTransaction(
      "ăn kem tại jolibee 121k tài khoản",
      context,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.walletId).toBe("wallet-account");
    expect(result.categoryId).toBe("cat-food");
    expect(result.description).toBe("ăn kem tại jolibee");
  });

  it("parses Vietnamese and English income shorthand", () => {
    const vi = parseTelegramTransaction(
      "nhận lương 20tr vào Techcombank",
      context,
    );
    const en = parseTelegramTransaction(
      "received salary 20m to Techcombank",
      context,
    );
    expect(vi.ok && vi.type).toBe("income");
    expect(vi.ok && vi.amount).toBe(20000000);
    expect(en.ok && en.type).toBe("income");
    expect(en.ok && en.amount).toBe(20000000);
  });

  it("treats cho tien wording as income and parses đ amounts correctly", () => {
    const result = parseTelegramTransaction(
      "anh A cho tiền 800.000đ vào Techcombank",
      context,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.type).toBe("income");
    expect(result.amount).toBe(800000);
    expect(result.walletId).toBe("wallet-tech");
    expect(result.description).toBe("anh A cho tiền");
  });

  it("keeps income categories only for income messages", () => {
    const result = parseTelegramTransaction(
      "nhận lương 56.921đ vào Techcombank",
      context,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.type).toBe("income");
    expect(result.amount).toBe(56921);
    expect(result.categoryId).toBe("cat-income-salary");
    expect(result.description).toBe("nhận lương");
  });

  it("parses transfer wallets and returns drafts when destination is missing", () => {
    const vi = parseTelegramTransaction(
      "chuyển 2tr từ tiền mặt sang Savings",
      context,
    );
    const en = parseTelegramTransaction(
      "transfer 2m from cash to savings",
      context,
    );
    const missing = parseTelegramTransaction("transfer 2m from cash", context);
    expect(vi.ok && vi.walletId).toBe("wallet-cash");
    expect(vi.ok && vi.toWalletId).toBe("wallet-saving");
    expect(en.ok && en.walletId).toBe("wallet-cash");
    expect(en.ok && en.toWalletId).toBe("wallet-saving");
    expect(missing.ok).toBe(true);
    if (!missing.ok) return;
    expect(missing.type).toBe("transfer");
    expect(missing.walletId).toBe("wallet-cash");
    expect(missing.toWalletId).toBeNull();
    expect(missing.unmatched).toContain("toWallet");
  });

  it("parses casual Vietnamese transfer connector wording", () => {
    const accountToCash = parseTelegramTransaction(
      "chuyển 500k tài khoản qua tiền mặt",
      context,
    );
    const withdraw = parseTelegramTransaction(
      "rút 300k từ tài khoản về tiền mặt",
      context,
    );

    expect(accountToCash.ok && accountToCash.type).toBe("transfer");
    expect(accountToCash.ok && accountToCash.walletId).toBe("wallet-account");
    expect(accountToCash.ok && accountToCash.toWalletId).toBe("wallet-cash");
    expect(withdraw.ok && withdraw.type).toBe("transfer");
    expect(withdraw.ok && withdraw.walletId).toBe("wallet-account");
    expect(withdraw.ok && withdraw.toWalletId).toBe("wallet-cash");
  });

  it("matches contacts from recipient-style Vietnamese wording", () => {
    const result = parseTelegramTransaction(
      "gửi Minh 50k bằng tài khoản",
      context,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.walletId).toBe("wallet-account");
    expect(result.contactId).toBe("contact-minh");
  });

  it("parses relative dates in both languages", () => {
    const vi = parseTelegramTransaction("ăn phở hôm qua 55k", context);
    const en = parseTelegramTransaction("pho yesterday 55k", context);
    expect(vi.ok && vi.date).toBe("2026-05-14");
    expect(en.ok && en.date).toBe("2026-05-14");
  });

  it("returns a wallet clarification draft when no fallback wallet is configured", () => {
    const contextWithoutDefault = { ...context, defaultWalletId: null };
    const mentionedWallet = parseTelegramTransaction(
      "ăn trưa 85k bằng tiền mặt",
      contextWithoutDefault,
    );
    const missingWallet = parseTelegramTransaction(
      "ăn trưa 85k",
      contextWithoutDefault,
    );

    expect(mentionedWallet.ok && mentionedWallet.walletId).toBe("wallet-cash");
    expect(missingWallet.ok).toBe(true);
    if (!missingWallet.ok) return;
    expect(missingWallet.walletId).toBe("");
    expect(missingWallet.unmatched).toContain("wallet");
  });

  it("understands Vietnamese gift contribution notes", () => {
    const result = parseTelegramTransaction(
      "góp tiền mua gà & vịt cho anh bâu 117k tài khoản",
      context,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amount).toBe(117000);
    expect(result.walletId).toBe("wallet-account");
    expect(result.categoryId).toBe("cat-gift");
    expect(result.contactId).toBe("contact-colleague");
    expect(result.description).toBe("góp tiền mua gà & vịt cho anh bâu");
  });

  it("does not auto-attach a trip when only the destination is mentioned in a non-travel transaction", () => {
    const result = parseTelegramTransaction(
      "mua đồ ăn ở Phú Yên 500k bằng tài khoản",
      context,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.type).toBe("expense");
    expect(result.tripId).toBeNull();
    expect(result.unmatched).not.toContain("trip");
  });

  it("does not auto-attach a trip even when the wording sounds travel-related", () => {
    const result = parseTelegramTransaction(
      "chi phí du lịch Phú Yên 770k bằng tài khoản",
      context,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tripId).toBeNull();
    expect(result.unmatched).not.toContain("trip");
  });

  it("only matches a trip when the message includes a year and destination", () => {
    expect(
      findExplicitTripMatch(context.trips as any, "cô sáu cho tiền 600k"),
    ).toBeNull();
    expect(
      findExplicitTripMatch(context.trips as any, "chi tiêu 2025 Thái Lan 600k"),
    )?.toMatchObject({
      id: "trip-thai-lan",
    });
  });
});

describe("parseTelegramEdit", () => {
  it("parses delete and amount edit commands", () => {
    expect(parseTelegramEdit("xóa", context).action).toBe("delete");
    expect(parseTelegramEdit("change amount 90000", context)).toMatchObject({
      action: "update",
      changes: { amount: 90000 },
    });
  });

  it("parses Vietnamese contact edit commands", () => {
    expect(
      parseTelegramEdit("sửa người nhận Đồng nghiệp", context),
    ).toMatchObject({
      action: "update",
      changes: { contactId: "contact-colleague" },
    });
  });
});

describe("resolveTelegramDraftSelection", () => {
  it("matches natural wallet follow-up text", () => {
    expect(
      resolveTelegramDraftSelection("tài khoản", "wallet", context),
    ).toMatchObject({
      kind: "select",
      id: "wallet-account",
    });
  });

  it("matches natural category follow-up text", () => {
    expect(
      resolveTelegramDraftSelection("đồ ăn", "category", context, {
        type: "expense",
      }),
    ).toMatchObject({
      kind: "select",
      id: "cat-food",
    });
  });

  it("allows skipping category or contact by text", () => {
    expect(
      resolveTelegramDraftSelection("bỏ qua", "category", context, {
        type: "expense",
      }),
    ).toMatchObject({ kind: "skip" });
    expect(
      resolveTelegramDraftSelection("skip", "contact", context),
    ).toMatchObject({ kind: "skip" });
  });

  it("matches contact names and cancel text", () => {
    expect(
      resolveTelegramDraftSelection("Minh", "contact", context),
    ).toMatchObject({
      kind: "select",
      id: "contact-minh",
    });
    expect(
      resolveTelegramDraftSelection("hủy", "wallet", context),
    ).toMatchObject({ kind: "cancel" });
  });
});
