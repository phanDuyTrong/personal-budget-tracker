import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';

import { useT } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

// We'll use lucide-react if heroicons aren't preferred, or just import from heroicons
import { 
    Squares2X2Icon, 
    WalletIcon as WalletHero, 
    ArrowsRightLeftIcon, 
    TagIcon, 
    ChartBarIcon, 
    TrophyIcon,
    ExclamationTriangleIcon,
    GlobeAmericasIcon as GlobeHero,
    Cog6ToothIcon,
    Bars3Icon,
    XMarkIcon,
    SunIcon,
    MoonIcon,
    ArrowRightOnRectangleIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline';

const navItems = [
    { name: 'dashboard', path: '/', icon: Squares2X2Icon },
    { name: 'wallets', path: '/wallets', icon: WalletHero },
    { name: 'transactions', path: '/transactions', icon: ArrowsRightLeftIcon },
    { name: 'categories', path: '/categories', icon: TagIcon },
    { name: 'budgets', path: '/budgets', icon: ChartBarIcon },
    { name: 'goals', path: '/goals', icon: TrophyIcon },
    { name: 'debts', path: '/debts', icon: ExclamationTriangleIcon },
    { name: 'travel', path: '/travel', icon: GlobeHero },
    { name: 'settings', path: '/settings', icon: Cog6ToothIcon },
];

export function AppShell() {
    const t = useT();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { theme, setTheme } = useSettingsStore();
    const { user, clearAuth } = useAuthStore();

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        clearAuth();
    };

    return (
        <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 overflow-hidden">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 border-r border-neutral-200 dark:border-neutral-800 glass-card backdrop-blur-xl">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">
                        B
                    </div>
                    <span className="font-bold text-xl tracking-tight">Budgetify</span>
                </div>
                
                <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                                ${isActive 
                                    ? 'bg-primary/10 text-primary font-medium' 
                                    : 'text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground'}
                            `}
                        >
                            <item.icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110`} />
                            {t(`nav.${item.name}`)}
                        </NavLink>
                    ))}
                </nav>

                {/* User & Actions */}
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 mt-auto">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserCircleIcon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{user?.email || 'User'}</p>
                            <p className="text-xs text-muted-foreground truncate">Budgetify Account</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2 px-1">
                        <button 
                            onClick={toggleTheme}
                            className="flex-1 flex justify-center items-center gap-2 p-2 rounded-lg text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground transition-colors"
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="flex-1 flex justify-center items-center gap-2 p-2 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            title="Logout"
                        >
                            <ArrowRightOnRectangleIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">B</div>
                    <span className="font-bold">Budgetify</span>
                </div>
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                    {isMobileMenuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Nav Overlay */}
            {/* Mobile Nav Overlay */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-neutral-50 dark:bg-neutral-950 pt-16 flex flex-col animate-in slide-in-from-top duration-300">
                    <div className="flex-1 overflow-y-auto flex flex-col">
                        <nav className="p-4 space-y-1 flex-1">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={({ isActive }) => `
                                        flex items-center gap-4 px-4 py-4 rounded-2xl transition-all
                                        ${isActive 
                                            ? 'bg-primary/10 text-primary font-bold' 
                                            : 'text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800'}
                                    `}
                                >
                                    <item.icon className="w-6 h-6" />
                                    <span className="text-lg">{t(`nav.${item.name}`)}</span>
                                </NavLink>
                            ))}
                        </nav>
                        
                        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 mt-auto pb-8">
                            <div className="flex items-center gap-3 px-4 py-2">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <UserCircleIcon className="w-7 h-7 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{user?.email || 'User'}</p>
                                </div>
                            </div>
                            <div className="flex gap-4 mt-4 px-2 pb-4">
                                <button 
                                    onClick={toggleTheme}
                                    className="flex-1 flex justify-center items-center gap-2 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-foreground"
                                >
                                    {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                                    <span className="font-medium">Theme</span>
                                </button>
                                <button 
                                    onClick={handleLogout}
                                    className="flex-1 flex justify-center items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-500"
                                >
                                    <ArrowRightOnRectangleIcon className="w-6 h-6" />
                                    <span className="font-medium">Logout</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <div className="flex-1 overflow-y-auto pt-16 md:pt-0">
                    <div className="max-w-7xl mx-auto p-4 md:p-8">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
