import { describe, expect, it } from "vitest";
import {
  parseTelegramEdit,
  parseTelegramTransaction,
} from "../../../../../supabase/functions/_shared/telegram-parser";

const context = {
  now: new Date("2026-05-15T04:00:00.000Z"),
  timeZone: "Asia/Ho_Chi_Minh",
  defaultWalletId: "wallet-default",
  wallets: [
    { id: "wallet-cash", name: "Tiền mặt" },
    { id: "wallet-tech", name: "Techcombank" },
    { id: "wallet-saving", name: "Savings" },
    { id: "wallet-default", name: "Default wallet" },
  ],
  categories: [
    { id: "cat-food", name: "Ăn uống", type: "expense" },
    { id: "cat-salary", name: "Salary", type: "income" },
  ],
  contacts: [{ id: "contact-minh", name: "Minh" }],
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
    expect(result.description).toBe("ăn trưa");
  });

  it("parses English expenses", () => {
    const result = parseTelegramTransaction("lunch 85k from cash", context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.type).toBe("expense");
    expect(result.amount).toBe(85000);
    expect(result.description).toBe("lunch");
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

  it("parses transfer wallets and rejects missing destination wallets", () => {
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
    expect(missing.ok).toBe(false);
  });

  it("parses relative dates in both languages", () => {
    const vi = parseTelegramTransaction("ăn phở hôm qua 55k", context);
    const en = parseTelegramTransaction("pho yesterday 55k", context);
    expect(vi.ok && vi.date).toBe("2026-05-14");
    expect(en.ok && en.date).toBe("2026-05-14");
  });

  it("requires a wallet when no fallback wallet is configured", () => {
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
    expect(missingWallet.ok).toBe(false);
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
});
