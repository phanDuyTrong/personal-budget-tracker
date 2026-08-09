export function parseMoneyInput(value: unknown): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    if (value === null || value === undefined) {
        return 0;
    }

    let text = String(value).trim();
    if (!text) {
        return 0;
    }

    text = text.replace(/\s+/g, '');

    const hasComma = text.includes(',');
    const hasDot = text.includes('.');

    if (hasComma && hasDot) {
        if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
            text = text.replace(/\./g, '').replace(',', '.');
        } else {
            text = text.replace(/,/g, '');
        }
    } else if (hasComma) {
        text = /,\d{1,2}$/.test(text)
            ? text.replace(/\./g, '').replace(',', '.')
            : text.replace(/,/g, '');
    } else if (hasDot) {
        text = /\.\d{1,2}$/.test(text)
            ? text.replace(/,/g, '')
            : text.replace(/\./g, '');
    }

    text = text.replace(/[^\d.-]/g, '');

    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
}
