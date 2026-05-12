import React from 'react';

export function TermButton({ children, onClick, type = 'button', className = '', ...props }) {
    return (
        <button
            type={type}
            onClick={onClick}
            className={`bg-transparent text-[var(--color-term-primary)] border-none cursor-pointer font-mono text-base p-0 hover:bg-[var(--color-term-primary)] hover:text-[var(--color-term-bg)] hover:shadow-none transition-none focus:outline-none ${className}`}
            {...props}
        >
            [ {children} ]
        </button>
    );
}
