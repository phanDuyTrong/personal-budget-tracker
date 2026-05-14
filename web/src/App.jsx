import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { useSettingsStore, applyTheme, applyAccentColor } from '@/stores/settingsStore';
import { ToastProvider, ErrorBoundary } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { devMockSession, devMockUser, isDevMockAuthEnabled, useAuthStore } from '@/stores/authStore';
import { Login, Register } from '@/pages/Auth';
import { HeroUIProvider } from "@heroui/system";


// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

// Lazy load components for better bundling and isolation
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Wallets = lazy(() => import('@/pages/Wallets').then(m => ({ default: m.Wallets })));
const Transactions = lazy(() => import('@/pages/Transactions').then(m => ({ default: m.Transactions })));
const Categories = lazy(() => import('@/pages/Categories').then(m => ({ default: m.Categories })));
const Budgets = lazy(() => import('@/pages/Budgets').then(m => ({ default: m.Budgets })));
const Goals = lazy(() => import('@/pages/Goals').then(m => ({ default: m.Goals })));
const Debts = lazy(() => import('@/pages/Debts').then(m => ({ default: m.Debts })));
const TravelTracker = lazy(() => import('@/pages/TravelTracker').then(m => ({ default: m.TravelTracker })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));

// Loading component
const PageLoader = () => (
    <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
);

// Auth Initializer to sync Supabase session
function AuthInitializer() {
    const { setAuth, clearAuth } = useAuthStore();
    
    React.useEffect(() => {
        const handleSession = (session) => {
            if (session) {
                setAuth(session.user, session);
            } else if (isDevMockAuthEnabled) {
                setAuth(devMockUser, devMockSession);
            } else {
                clearAuth();
            }
        };

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleSession(session);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            handleSession(session);
        });

        return () => subscription.unsubscribe();
    }, [setAuth, clearAuth]);

    return null;
}


// Theme and Accent Color Initializer
function ThemeInitializer() {
    const { theme, accentColor } = useSettingsStore();
    
    React.useEffect(() => {
        applyTheme(theme);
        applyAccentColor(accentColor);
    }, [theme, accentColor]);
    
    return null;
}

// Protected Route Component
function ProtectedRoute({ children }) {
    const { user, session } = useAuthStore();
    if (!user || !session) {
        return <Navigate to="/login" replace />;
    }
    return children;
}


export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <HeroUIProvider>
                <ToastProvider>
                    <ThemeInitializer />
                    <BrowserRouter>
                        <AuthInitializer />
                        <ErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <Routes>
                                    {/* Auth Routes */}
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/register" element={<Register />} />

                                    {/* Protected App Routes */}
                                    <Route path="/" element={
                                        <ProtectedRoute>
                                            <AppShell />
                                        </ProtectedRoute>
                                    }>
                                        <Route index element={<Dashboard />} />
                                        <Route path="wallets" element={<Wallets />} />
                                        <Route path="transactions" element={<Transactions />} />
                                        <Route path="categories" element={<Categories />} />
                                        <Route path="budgets" element={<Budgets />} />
                                        <Route path="goals" element={<Goals />} />
                                        <Route path="debts" element={<Debts />} />
                                        <Route path="travel" element={<TravelTracker />} />
                                        <Route path="settings" element={<Settings />} />
                                    </Route>

                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Suspense>
                        </ErrorBoundary>
                    </BrowserRouter>
                </ToastProvider>
            </HeroUIProvider>
        </QueryClientProvider>
    );
}
