import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ThemeCustomizer } from './ThemeCustomizer';
import { LayoutDashboard, WalletCards, Languages, Settings } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AIAssistant } from '@/components/AIAssistant';

const Layout = () => {
    const { toggleLanguage, t, language } = useLanguage();
    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            {/* Top Header */}
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
                    <div className="flex items-center gap-2 font-bold text-xl">
                        <span className="text-primary">Budget</span>Manager
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleLanguage}
                            className="p-2 mr-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Toggle Language"
                            title={language === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang Tiếng Anh'}
                        >
                            <Languages className="h-5 w-5" />
                        </button>
                        <ThemeCustomizer />
                    </div>
                </div>
            </header>

            <div className="flex container max-w-screen-2xl mx-auto">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex w-64 flex-col border-r border-border min-h-[calc(100vh-3.5rem)] py-6 pr-6">
                    <nav className="space-y-2">
                        <NavLink
                            to="/"
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'}`
                            }
                        >
                            <LayoutDashboard className="h-5 w-5" />
                            <span className="font-medium">{t('dashboard')}</span>
                        </NavLink>
                        <NavLink
                            to="/transactions"
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'}`
                            }
                        >
                            <WalletCards className="h-5 w-5" />
                            <span className="font-medium">{t('transactions')}</span>
                        </NavLink>
                        <NavLink
                            to="/settings"
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'}`
                            }
                        >
                            <Settings className="h-5 w-5" />
                            <span className="font-medium">Settings</span>
                        </NavLink>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-4 md:p-6 pb-24 md:pb-8 min-h-[calc(100vh-3.5rem)]">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border bg-background flex items-center justify-around md:hidden px-4 mb-safe">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center w-full h-full gap-1 text-xs ${isActive ? 'text-primary' : 'text-muted-foreground'}`
                    }
                >
                    <LayoutDashboard className="h-5 w-5" />
                    <span>{t('dashboard')}</span>
                </NavLink>
                <NavLink
                    to="/transactions"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center w-full h-full gap-1 text-xs ${isActive ? 'text-primary' : 'text-muted-foreground'}`
                    }
                >
                    <WalletCards className="h-5 w-5" />
                    <span>{t('transactions')}</span>
                </NavLink>
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center w-full h-full gap-1 text-xs ${isActive ? 'text-primary' : 'text-muted-foreground'}`
                    }
                >
                    <Settings className="h-5 w-5" />
                    <span>Settings</span>
                </NavLink>
            </nav>
            {/* Spacer for bottom nav on mobile */}
            <div className="h-16 md:hidden" />

            <AIAssistant />
        </div>
    );
};

export default Layout;
