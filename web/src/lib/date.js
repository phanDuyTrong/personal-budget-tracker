export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function pad2(value) {
    return String(value).padStart(2, '0');
}

function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateFromParts(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day, 12));
}

export function toDateString(year, month, day) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function getVietnamDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const get = (type) => Number(parts.find((part) => part.type === type)?.value);
    return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
    };
}

export function toISODate(date) {
    const { year, month, day } = getVietnamDateParts(date);
    return toDateString(year, month, day);
}

export function getMonthRange(date = new Date()) {
    const parts = typeof date === 'string' ? parseDateString(date) : getVietnamDateParts(date);
    return getMonthRangeByParts(parts.year, parts.month);
}

export function getMonthRangeByParts(year, month) {
    const lastDay = daysInMonth(year, month);
    const start = dateFromParts(year, month, 1);
    const end = dateFromParts(year, month, lastDay);
    return {
        from: toDateString(year, month, 1),
        to: toDateString(year, month, lastDay),
        start,
        end,
    };
}

export function getDashboardDateRange(query = {}, today = new Date()) {
    const fallback = getMonthRange(today);
    return {
        from: query.date_from || fallback.from,
        to: query.date_to || fallback.to,
    };
}

export function getPreviousMonthRange(dateOrISO) {
    const parts = dateOrISO instanceof Date ? getVietnamDateParts(dateOrISO) : parseDateString(dateOrISO);
    const previousMonthDate = new Date(Date.UTC(parts.year, parts.month - 2, 1, 12));
    return getMonthRange(previousMonthDate);
}

export function getShiftedMonthRange(baseDate, monthOffset) {
    const parts = baseDate instanceof Date ? getVietnamDateParts(baseDate) : parseDateString(baseDate);
    const shifted = new Date(Date.UTC(parts.year, parts.month - 1 + monthOffset, 1, 12));
    return getMonthRange(shifted);
}

export function monthLabel(date, locale = 'default') {
    return date.toLocaleString(locale, { month: 'short', year: '2-digit', timeZone: APP_TIME_ZONE });
}

export function parseDateString(dateString) {
    const [year, month, day] = String(dateString).split('-').map(Number);
    return { year, month, day };
}

export function getDayOfMonth(dateString) {
    return parseDateString(dateString).day;
}
