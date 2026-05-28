import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const timeZone = Deno.env.get("BOT_TIME_ZONE") || "Asia/Ho_Chi_Minh";

const supabase = createClient(supabaseUrl, serviceRoleKey);

function formatAmount(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}₫`;
}

function formatCompactAmount(amount: number) {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}b`;
  }
  if (abs >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (abs >= 1_000) {
    return `${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `${Math.round(amount)}`;
}

function emojiForLabel(name?: string | null) {
  const normalized = (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return "🏷️";
  if (/(khach san|homestay|hotel|resort|luu tru)/.test(normalized)) return "🏨";
  if (/(an uong|an sang|an trua|an toi|food|drink|cafe|tra sua|pizza|burger|nuoc)/.test(normalized)) return "🍕";
  if (/(ve may bay|san bay|plane|flight|airfare)/.test(normalized)) return "✈️";
  if (/(taxi|grab|xe om|bus|tau|ve xe|thue xe|xang xe|parking|gui xe)/.test(normalized)) return "🚕";
  if (/(mua qua|qua|gift|shopping|mua sam|quan ao|my pham)/.test(normalized)) return "🎁";
  if (/(giai tri|xem phim|karaoke|game|concert|tour|vui choi)/.test(normalized)) return "🎉";
  if (/(suc khoe|benh|thuoc|y te|kham)/.test(normalized)) return "💊";
  if (/(ca nhan|hair|toc|nail|spa|skin|cham soc)/.test(normalized)) return "🧴";
  if (/(cho tien|nguoi than|gia dinh|tu thien|charity|donate)/.test(normalized)) return "💌";
  if (/(luong|salary|bonus|thuong|income|refund|hoan tien)/.test(normalized)) return "💰";
  if (/(debt|cong no|tra no|cho muon|muon tien)/.test(normalized)) return "🤝";
  if (/(du lich|trip|travel)/.test(normalized)) return "🧳";
  return "🏷️";
}

function todayInTimeZone(now = new Date(), tz = timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function startOfMonth(dateString: string) {
  return `${dateString.slice(0, 7)}-01`;
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

function budgetEmoji(ratio: number) {
  if (ratio >= 1) return "🔴";
  if (ratio >= 0.8) return "🟡";
  return "🟢";
}

function budgetLabel(ratio: number) {
  if (ratio >= 1) return "vượt ngân sách";
  if (ratio >= 0.8) return "sắp chạm ngưỡng";
  return "vẫn an toàn";
}

function enrichGoal(goal: any, today = new Date()) {
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

function goalEmoji(goal: any) {
  if (goal.percentage >= 100) return "🟢";
  if (goal.daysLeft !== null && goal.daysLeft !== undefined) {
    if (goal.daysLeft < 0) return "🔴";
    if (goal.daysLeft <= 30) return "🔴";
    if (goal.daysLeft <= 60) return "🟡";
  }
  if (goal.percentage >= 80) return "🟢";
  return "🟡";
}

function shouldWarnGoal(goal: any) {
  if (goal.percentage >= 100) return false;
  if (goal.daysLeft !== null && goal.daysLeft !== undefined) {
    if (goal.daysLeft < 0) return true;
    if (goal.daysLeft <= 60) return true;
  }
  return false;
}

async function sendTelegramMessage(chatId: string, text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || "Telegram sendMessage failed.");
  }
}

async function buildWeeklyAlert(userId: string) {
  const today = todayInTimeZone();
  const monthStart = startOfMonth(today);

  const [
    { data: budgets, error: budgetError },
    { data: categories, error: categoryError },
    { data: expenseRows, error: expenseError },
    { data: goals, error: goalError },
  ] = await Promise.all([
    supabase
      .from("budgets")
      .select("id,amount,category_id,category:categories(id,name,parent_id)")
      .eq("user_id", userId),
    supabase
      .from("categories")
      .select("id,name,parent_id")
      .eq("user_id", userId),
    supabase
      .from("transactions")
      .select("amount,category_id")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("date", monthStart)
      .lte("date", today),
    supabase
      .from("goals")
      .select("id,name,target_amount,current_amount,deadline,status")
      .eq("user_id", userId),
  ]);

  if (budgetError) throw budgetError;
  if (categoryError) throw categoryError;
  if (expenseError) throw expenseError;
  if (goalError) throw goalError;

  const budgetRows = (budgets || [])
    .map((budget: any) => {
      const categoryIds = collectCategoryIds(categories || [], budget.category_id);
      const spent = (expenseRows || [])
        .filter((tx: any) => categoryIds.includes(tx.category_id))
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
      const limit = Number(budget.amount || 0);
      const ratio = limit > 0 ? spent / limit : 0;
      return {
        name: budget.category?.name || "Khác",
        spent,
        limit,
        ratio,
      };
    })
    .filter((row: any) => row.ratio >= 0.8)
    .sort((a: any, b: any) => b.ratio - a.ratio);

  const goalRows = (goals || [])
    .map((goal: any) => enrichGoal(goal))
    .filter((goal: any) => shouldWarnGoal(goal))
    .sort((a: any, b: any) => {
      const aDays = a.daysLeft ?? 999999;
      const bDays = b.daysLeft ?? 999999;
      return aDays - bDays;
    });

  if (budgetRows.length === 0 && goalRows.length === 0) return null;

  const lines = [
    "📬 Check-in cuối tuần nè",
    "Mình gom nhanh các mục nên để mắt trước khi sang tuần mới:",
  ];

  if (budgetRows.length) {
    lines.push("", "📒 Budget:");
    budgetRows.slice(0, 6).forEach((budget: any) => {
      lines.push(
        `${budgetEmoji(budget.ratio)} ${emojiForLabel(budget.name)} ${budget.name}: ${formatCompactAmount(budget.spent)}/${formatCompactAmount(budget.limit)} (${Math.round(budget.ratio * 100)}%) • ${budgetLabel(budget.ratio)}`,
      );
    });
  }

  if (goalRows.length) {
    lines.push("", "🎯 Goals:");
    goalRows.slice(0, 6).forEach((goal: any) => {
      const deadlineText =
        goal.daysLeft === null || goal.daysLeft === undefined
          ? "chưa có deadline"
          : goal.daysLeft < 0
            ? `trễ ${Math.abs(goal.daysLeft)} ngày`
            : `còn ${goal.daysLeft} ngày`;
      lines.push(
        `${goalEmoji(goal)} ${goal.name}: ${goal.percentage}% • còn ${formatAmount(Number(goal.remaining || 0))} • ${deadlineText}`,
      );
    });
  }

  lines.push(
    "",
    "Muốn soi kỹ hơn thì cứ hỏi mình kiểu “ngân sách tháng này”, “goal nào đang chậm”, hoặc “chi tiêu chuyến Đà Lạt” nha ✨",
  );

  return lines.join("\n");
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);

    const { data: links, error } = await supabase
      .from("telegram_user_links")
      .select("user_id,chat_id");
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    let sent = 0;
    const failures: Array<{ userId: string; error: string }> = [];
    const previews: Array<{ userId: string; chatId: string; message: string }> = [];
    for (const link of links || []) {
      try {
        const message = await buildWeeklyAlert(link.user_id);
        if (!message) continue;
        if (dryRun) {
          previews.push({
            userId: link.user_id,
            chatId: String(link.chat_id),
            message,
          });
        } else {
          await sendTelegramMessage(String(link.chat_id), message);
          sent += 1;
        }
      } catch (sendError) {
        failures.push({
          userId: link.user_id,
          error: sendError instanceof Error ? sendError.message : String(sendError),
        });
      }
    }

    return jsonResponse({
      ok: true,
      dryRun,
      scanned: (links || []).length,
      sent: dryRun ? 0 : sent,
      previews,
      failures,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
