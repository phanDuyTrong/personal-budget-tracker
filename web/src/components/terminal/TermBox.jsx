import React from 'react';

export function TermBox({ title, children, className = '' }) {
    return (
        <div className={`border border-[var(--color-term-primary)] bg-[var(--color-term-bg)] p-4 mb-6 relative ${className}`}>
            {title && (
                <div className="absolute top-[-12px] left-4 bg-[var(--color-term-bg)] px-2 font-bold uppercase text-[var(--color-term-primary)]">
                    +-- {title} --+
                </div>
            )}
            {children}
        </div>
    );
}
