import { create } from 'zustand';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const mockUser = isLocalhost ? { id: 'local-dev-user', email: 'dev@localhost' } : null;
const mockSession = isLocalhost ? { access_token: 'mock-token' } : null;

// clearAuth just resets local state — does NOT call supabase.auth.signOut()
// signOut must be called explicitly in the UI before clearing
export const useAuthStore = create((set) => ({
    user: mockUser,
    session: mockSession,
    setAuth: (user, session) => set({ user, session }),
    clearAuth: () => set({ user: mockUser, session: mockSession }),
}));
