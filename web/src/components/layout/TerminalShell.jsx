import React from 'react';
import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function TerminalShell() {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="theme-terminal crt-flicker min-h-screen">
      {/* Global CRT overlay */}
      <div className="crt-overlay"></div>
      
      {/* Shell content */}
      <div className="term-container relative z-10 p-4 font-mono">
        <header className="mb-8 border-b-2 border-[var(--color-term-primary)] pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold">[ BUDGET_MANAGER_OS v1.0.0 ]</h1>
            <nav className="text-sm mt-2 flex gap-4 text-[var(--color-term-secondary)]">
              <Link to="/terminal" className="hover:text-[var(--color-term-primary)] hover:bg-[var(--color-term-bg)]">[/DASHBOARD]</Link>
              <Link to="/terminal/wallets" className="hover:text-[var(--color-term-primary)] hover:bg-[var(--color-term-bg)]">[/ACTIVE_NODES]</Link>
            </nav>
          </div>
          <div className="text-right">
            <p>USER: {user.email || 'ROOT'}</p>
            <p>ACCESS: GRANTED</p>
          </div>
        </header>

        <main>
          <Outlet />
        </main>

        <footer className="mt-8 border-t border-[var(--color-term-primary)] pt-4 text-center text-sm" style={{ color: 'var(--color-term-muted)' }}>
          <p>BUDGET_OS (C) 2026. USE OF THIS SYSTEM IS MONITORED.</p>
        </footer>
      </div>
    </div>
  );
}
