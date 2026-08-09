import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettingsStore, applyTheme, applyAccentColor } from '@/stores/settingsStore';
import { ErrorBoundary } from '@/components/ui';
import { ToastProvider } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { devMockSession, devMockUser, isDevMockAuthEnabled, useAuthStore } from '@/stores/authStore';
import { HeroUIProvider } from "@heroui/system";
import { invalidateFinanceQueries, resetFinanceQueries } from '@/lib/queryInvalidation';


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
const AppShell = lazy(() => import('@/components/layout/AppShell').then(m => ({ default: m.AppShell })));
const Login = lazy(() => import('@/pages/Auth').then(m => ({ default: m.Login })));
const Register = lazy(() => import('@/pages/Auth').then(m => ({ default: m.Register })));
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
    const { setAuth, clearAuth, markReady } = useAuthStore();
    
    React.useEffect(() => {
        let isActive = true;

        const handleSession = (session) => {
            if (!isActive) return;
            if (session) {
                setAuth(session.user, session);
            } else if (isDevMockAuthEnabled) {
                setAuth(devMockUser, devMockSession);
            } else {
                clearAuth();
                resetFinanceQueries(queryClient);
            }
        };

        // Initial session check
        (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                handleSession(session);
            } catch {
                clearAuth();
                resetFinanceQueries(queryClient);
            } finally {
                if (isActive) markReady();
            }
        })();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            handleSession(session);
            if (isActive) markReady();
        });

        return () => {
            isActive = false;
            subscription.unsubscribe();
        };
    }, [setAuth, clearAuth, markReady]);

    return null;
}

function RealtimeFinanceSync() {
    const { session } = useAuthStore();

    React.useEffect(() => {
        const userId = session?.user?.id;
        if (!userId) return undefined;

        const invalidateFinance = () => {
            invalidateFinanceQueries(queryClient);
        };

        const channel = supabase
            .channel(`budget-sync-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, invalidateFinance)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_splits' }, invalidateFinance)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, invalidateFinance)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, invalidateFinance)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, invalidateFinance)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, invalidateFinance)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, invalidateFinance)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, invalidateFinance)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

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
    const { user, session, isReady } = useAuthStore();
    if (!isReady) {
        return <PageLoader />;
    }
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
                        <RealtimeFinanceSync />
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
