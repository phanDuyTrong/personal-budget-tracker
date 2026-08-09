import { describe, expect, it } from 'vitest';
import { parseMoneyInput } from '../money';

describe('parseMoneyInput', () => {
    it('keeps raw digit strings intact for VND values', () => {
        expect(parseMoneyInput('127294')).toBe(127294);
        expect(parseMoneyInput('70000')).toBe(70000);
    });

    it('parses Vietnamese thousand separators safely', () => {
        expect(parseMoneyInput('11.000')).toBe(11000);
        expect(parseMoneyInput('58.508.172')).toBe(58508172);
    });

    it('supports decimal-style inputs when they are intentional', () => {
        expect(parseMoneyInput('1,234.56')).toBe(1234.56);
        expect(parseMoneyInput('1.234,56')).toBe(1234.56);
    });
});
