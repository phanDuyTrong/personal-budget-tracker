import React, { useState, useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

const MONTHS = ['Th.1','Th.2','Th.3','Th.4','Th.5','Th.6','Th.7','Th.8','Th.9','Th.10','Th.11','Th.12'];
const MONTHS_FULL = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const DAYS = ['T2','T3','T4','T5','T6','T7','CN'];

function parseValue(value) {
    if (!value) return null;
    try {
        const s = value.split('T')[0];
        const [y, m, d] = s.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y, month: m - 1, day: d };
    } catch {
        return null;
    }
    return null;
}

// All sizing is driven by this single box
const W = 360;  // total overlay width in px
const PAD = 16; // p-4 on each side
const INNER = W - PAD * 2; // 328px usable inner width
const HEADER = 52; // nav row height px
const GRID_H = 252; // grid area height px (month-view reference)

export function DatePicker({ value, onChange, label, error, className = '' }) {
    const parsed = useMemo(() => parseValue(value), [value]);
    const today = new Date();

    const [open, setOpen] = useState(false);
    const [view, setView] = useState('day');
    const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [decadeStart, setDecadeStart] = useState(Math.floor(today.getFullYear() / 10) * 10);

    const handleOpen = () => {
        const y = parsed?.year ?? today.getFullYear();
        const m = parsed?.month ?? today.getMonth();
        setCursor({ year: y, month: m });
        setDecadeStart(Math.floor(y / 10) * 10);
        setView('day');
        setOpen(true);
    };

    const calendarDays = useMemo(() => {
        const { year, month } = cursor;
        const firstDow = new Date(year, month, 1).getDay();
        const offset = (firstDow + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();
        const prevM = month === 0 ? 11 : month - 1;
        const prevY = month === 0 ? year - 1 : year;
        const nextM = month === 11 ? 0 : month + 1;
        const nextY = month === 11 ? year + 1 : year;
        const days = [];
        for (let i = offset - 1; i >= 0; i--) days.push({ day: daysInPrev - i, month: prevM, year: prevY, cur: false });
        for (let d = 1; d <= daysInMonth; d++) days.push({ day: d, month, year, cur: true });
        while (days.length < 42) { const d = days.length - offset - daysInMonth + 1; days.push({ day: d, month: nextM, year: nextY, cur: false }); }
        return days;
    }, [cursor]);

    const selectDay = ({ day, month, year }) => {
        onChange(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        setOpen(false);
    };

    const isSel = (d, m, y) => parsed && parsed.day === d && parsed.month === m && parsed.year === y;
    const isTdy = (d, m, y) => today.getDate() === d && today.getMonth() === m && today.getFullYear() === y;

    const displayValue = parsed
        ? `${String(parsed.day).padStart(2, '0')}/${String(parsed.month + 1).padStart(2, '0')}/${parsed.year}`
        : '';

    const navBtn = 'p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-600 dark:text-neutral-300 shrink-0';
    const headBtn = 'font-black text-base px-3 py-1 rounded-xl hover:bg-primary/5 hover:text-primary transition-colors text-neutral-900 dark:text-white';

    // Gap constants (px) for explicit grid sizing
    const dayGap = 4;  // gap-1
    const gridGap = 8; // gap-2

    // Day cell size (square): determined by width
    // 7 cells + 6 gaps filling INNER px
    const dayCellW = (INNER - 6 * dayGap) / 7; // ~43px

    // Weekday header height
    const whH = 24;

    // Day grid height (6 rows of square cells + 5 gaps)
    const dayGridH = 6 * dayCellW + 5 * dayGap; // ~281px

    // Total day view height = HEADER + weekday-header + dayGridH
    const dayTotalH = HEADER + whH + dayGap + dayGridH;

    // Month/Year cell: 3 cols filling INNER
    const moCellW = (INNER - 2 * gridGap) / 3; // ~103px
    // 4 rows filling GRID_H
    const moCellH = (GRID_H - 3 * gridGap) / 4; // ~60px

    const moTotalH = HEADER + GRID_H;

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && <label className="text-xs font-black text-neutral-500 uppercase tracking-widest px-1">{label}</label>}
            <Popover isOpen={open} onOpenChange={setOpen} placement="bottom-start" offset={4}>
                <PopoverTrigger>
                    <button
                        type="button"
                        onClick={handleOpen}
                        className="w-full flex items-center justify-between gap-2 px-3 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-left"
                    >
                        <span className={`text-sm font-medium ${displayValue ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>
                            {displayValue || 'Chọn ngày...'}
                        </span>
                        <CalendarDaysIcon className="h-4 w-4 text-neutral-400 shrink-0" />
                    </button>
                </PopoverTrigger>

                <PopoverContent className="p-0 rounded-2xl shadow-2xl glass-modal backdrop-blur-2xl overflow-hidden">
                    {/* Width is forced on the INNER div, not PopoverContent (which ignores our styles in portal) */}

                    {/* ── Day View ── */}
                    {view === 'day' && (
                        <div style={{ width: `${W}px`, height: `${dayTotalH}px`, padding: `${PAD}px` }}>
                            {/* Nav header */}
                            <div style={{ height: `${HEADER}px` }} className="flex items-center justify-between">
                                <button className={navBtn} onClick={() => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 })}>
                                    <ChevronLeftIcon className="h-5 w-5" />
                                </button>
                                <button className={headBtn} onClick={() => setView('month')}>
                                    {MONTHS[cursor.month]} {cursor.year}
                                </button>
                                <button className={navBtn} onClick={() => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 })}>
                                    <ChevronRightIcon className="h-5 w-5" />
                                </button>
                            </div>
                            {/* Weekday labels */}
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${dayCellW}px)`, gap: `${dayGap}px`, height: `${whH}px`, marginBottom: `${dayGap}px` }}>
                                {DAYS.map(d => <div key={d} className="flex items-center justify-center text-[11px] font-black text-neutral-400">{d}</div>)}
                            </div>
                            {/* Day cells — explicit pixel grid so they fill width & are square */}
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${dayCellW}px)`, gridTemplateRows: `repeat(6, ${dayCellW}px)`, gap: `${dayGap}px` }}>
                                {calendarDays.map((cell, i) => (
                                    <button key={i} type="button" onClick={() => selectDay(cell)}
                                        style={{ width: `${dayCellW}px`, height: `${dayCellW}px` }}
                                        className={`rounded-lg text-sm font-bold transition-all flex items-center justify-center
                                            ${isSel(cell.day, cell.month, cell.year) ? 'bg-primary text-white'
                                            : isTdy(cell.day, cell.month, cell.year) ? 'ring-1 ring-primary text-primary'
                                            : cell.cur ? 'text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                            : 'text-neutral-300 dark:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                                    >{cell.day}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Month View ── */}
                    {view === 'month' && (
                        <div style={{ width: `${W}px`, height: `${moTotalH}px`, padding: `${PAD}px` }}>
                            <div style={{ height: `${HEADER}px` }} className="flex items-center justify-between">
                                <button className={navBtn} onClick={() => setCursor(c => ({ ...c, year: c.year - 1 }))}><ChevronLeftIcon className="h-5 w-5" /></button>
                                <button className={headBtn} onClick={() => { setDecadeStart(Math.floor(cursor.year / 10) * 10); setView('year'); }}>{cursor.year}</button>
                                <button className={navBtn} onClick={() => setCursor(c => ({ ...c, year: c.year + 1 }))}><ChevronRightIcon className="h-5 w-5" /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${moCellW}px)`, gridTemplateRows: `repeat(4, ${moCellH}px)`, gap: `${gridGap}px` }}>
                                {MONTHS_FULL.map((m, i) => (
                                    <button key={i} type="button"
                                        style={{ width: `${moCellW}px`, height: `${moCellH}px` }}
                                        onClick={() => { setCursor(c => ({ ...c, month: i })); setView('day'); }}
                                        className={`rounded-xl text-sm font-bold transition-all flex items-center justify-center
                                            ${parsed && parsed.month === i && parsed.year === cursor.year ? 'bg-primary text-white'
                                            : today.getMonth() === i && today.getFullYear() === cursor.year ? 'ring-1 ring-primary text-primary'
                                            : 'text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                                    >{m}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Year View ── */}
                    {view === 'year' && (
                        <div style={{ width: `${W}px`, height: `${moTotalH}px`, padding: `${PAD}px` }}>
                            <div style={{ height: `${HEADER}px` }} className="flex items-center justify-between">
                                <button className={navBtn} onClick={() => setDecadeStart(d => d - 12)}><ChevronLeftIcon className="h-5 w-5" /></button>
                                <span className="font-black text-base text-neutral-600 dark:text-neutral-300">{decadeStart} – {decadeStart + 11}</span>
                                <button className={navBtn} onClick={() => setDecadeStart(d => d + 12)}><ChevronRightIcon className="h-5 w-5" /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${moCellW}px)`, gridTemplateRows: `repeat(4, ${moCellH}px)`, gap: `${gridGap}px` }}>
                                {Array.from({ length: 12 }, (_, i) => decadeStart + i).map(y => (
                                    <button key={y} type="button"
                                        style={{ width: `${moCellW}px`, height: `${moCellH}px` }}
                                        onClick={() => { setCursor(c => ({ ...c, year: y })); setView('month'); }}
                                        className={`rounded-xl text-sm font-bold transition-all flex items-center justify-center
                                            ${parsed?.year === y ? 'bg-primary text-white'
                                            : today.getFullYear() === y ? 'ring-1 ring-primary text-primary'
                                            : 'text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                                    >{y}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
            {error && <p className="text-[10px] font-bold text-danger px-1 uppercase tracking-wider">{error}</p>}
        </div>
    );
}
