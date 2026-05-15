export function toISODate(date) {
    return date.toISOString().split('T')[0];
}

export function getMonthRange(date = new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: toISODate(start), to: toISODate(end), start, end };
}

export function getDashboardDateRange(query = {}, today = new Date()) {
    const fallback = getMonthRange(today);
    return {
        from: query.date_from || fallback.from,
        to: query.date_to || fallback.to,
    };
}

export function getPreviousMonthRange(dateOrISO) {
    const date = dateOrISO instanceof Date ? dateOrISO : new Date(dateOrISO);
    return getMonthRange(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

export function getShiftedMonthRange(baseDate, monthOffset) {
    return getMonthRange(new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1));
}

export function monthLabel(date, locale = 'default') {
    return date.toLocaleString(locale, { month: 'short', year: '2-digit' });
}
