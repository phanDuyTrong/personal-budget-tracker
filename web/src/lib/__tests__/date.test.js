import { describe, expect, it } from 'vitest';
import { getMonthRangeByParts, getPreviousMonthRange, toISODate } from '@/lib/date';

describe('Vietnam timezone date helpers', () => {
    it('keeps Vietnam local dates instead of shifting through UTC', () => {
        expect(toISODate(new Date('2026-05-01T00:30:00+07:00'))).toBe('2026-05-01');
    });

    it('builds month ranges from explicit Vietnam calendar parts', () => {
        expect(getMonthRangeByParts(2026, 5)).toMatchObject({
            from: '2026-05-01',
            to: '2026-05-31',
        });
    });

    it('gets the previous month from a date-only string without timezone drift', () => {
        expect(getPreviousMonthRange('2026-05-01')).toMatchObject({
            from: '2026-04-01',
            to: '2026-04-30',
        });
    });
});
