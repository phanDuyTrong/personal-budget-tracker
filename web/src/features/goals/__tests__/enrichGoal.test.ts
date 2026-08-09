import { describe, expect, it } from 'vitest';
import { enrichGoal, resolveGoalStatus } from '../money';

describe('enrichGoal', () => {
    it('calculates progress, remaining amount, days left, and required monthly saving', () => {
        const goal = enrichGoal(
            {
                id: 'goal-1',
                name: 'Emergency Fund',
                target_amount: 1200,
                current_amount: 300,
                deadline: '2026-08-01',
            },
            new Date('2026-05-01T00:00:00.000Z'),
        );

        expect(goal.percentage).toBe(25);
        expect(goal.remaining).toBe(900);
        expect(goal.requiredMonthlySaving).toBe(300);
        expect(goal.daysLeft).toBe(92);
        expect(goal.targetAmount).toBe(1200);
        expect(goal.currentAmount).toBe(300);
    });

    it('caps progress at 100 percent when the goal is overfunded', () => {
        const goal = enrichGoal({ target_amount: 1000, current_amount: 1500, deadline: null });

        expect(goal.percentage).toBe(100);
        expect(goal.remaining).toBe(0);
        expect(goal.requiredMonthlySaving).toBeNull();
        expect(goal.daysLeft).toBeNull();
    });

    it('derives goal status from the final target and current amounts', () => {
        expect(resolveGoalStatus({ targetAmount: 1000, currentAmount: 400 })).toBe('active');
        expect(resolveGoalStatus({ targetAmount: 1000, currentAmount: 1000 })).toBe('completed');
        expect(resolveGoalStatus({ targetAmount: 0, currentAmount: 500, fallbackStatus: 'paused' })).toBe('paused');
    });
});
