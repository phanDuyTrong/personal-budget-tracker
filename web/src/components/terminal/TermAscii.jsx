import React from 'react';

export function AsciiProgressBar({ current, max, width = 20, color = 'var(--color-term-primary)' }) {
    const percentage = max > 0 ? (current / max) : 0;
    const filledLength = Math.min(width, Math.max(0, Math.floor(percentage * width)));
    const emptyLength = width - filledLength;
    
    const filled = '|'.repeat(Math.max(0, filledLength));
    const empty = '.'.repeat(Math.max(0, emptyLength));
    
    return (
        <span style={{ color }}>
            [{filled}{empty}] {Math.round(percentage * 100)}%
        </span>
    );
}

export function AsciiSparkline({ data = [] }) {
    if (data.length === 0) return 'NO_DATA';
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;
    
    const chars = ['_', '.', '-', '=', '+', '*', '#'];
    
    return data.map((val, i) => {
        if (range === 0) return '-';
        const percent = (val - min) / range;
        const index = Math.min(chars.length - 1, Math.floor(percent * chars.length));
        return chars[index];
    }).join('');
}
