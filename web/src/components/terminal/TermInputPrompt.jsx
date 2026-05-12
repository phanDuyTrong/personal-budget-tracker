import React from 'react';

export function TermInputPrompt({ user = 'user', host = 'budget_os', command, active = true, className = '' }) {
    return (
        <div className={`flex items-center text-[var(--color-term-primary)] ${className}`}>
            <span className="mr-2">{user}@{host}:~$</span>
            <span>{command}</span>
            {active && <span className="blink-cursor ml-1"></span>}
        </div>
    );
}
