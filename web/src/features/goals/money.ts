export function enrichGoal(g: any, today = new Date()) {
    const target = Number(g.target_amount), current = Number(g.current_amount);
    const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
    const remaining = Math.max(target - current, 0);
    let requiredMonthlySaving: number | null = null, daysLeft: number | null = null;
    if (g.deadline) {
        const now = today, deadline = new Date(g.deadline);
        const monthsLeft = (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth());
        daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
        requiredMonthlySaving = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
    }
    return {
        ...g,
        percentage,
        remaining,
        requiredMonthlySaving,
        daysLeft,
        targetAmount: g.target_amount,
        currentAmount: g.current_amount,
        walletId: g.walletId ?? g.wallet_id ?? null,
    };
}

export function resolveGoalStatus({
    targetAmount,
    currentAmount,
    fallbackStatus = 'active',
}: {
    targetAmount: number;
    currentAmount: number;
    fallbackStatus?: string;
}) {
    if (targetAmount > 0) {
        return currentAmount >= targetAmount ? 'completed' : 'active';
    }

    return fallbackStatus;
}
