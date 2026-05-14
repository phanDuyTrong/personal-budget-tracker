import { create } from 'zustand';

export const isDevMockAuthEnabled = import.meta.env.VITE_DEV_MOCK_AUTH === 'true';
export const devMockUser = isDevMockAuthEnabled ? { id: 'local-dev-user', email: 'dev@localhost' } : null;
export const devMockSession = isDevMockAuthEnabled ? { access_token: 'mock-token' } : null;

// clearAuth just resets local state - it does NOT call supabase.auth.signOut().
// signOut must be called explicitly in the UI before clearing.
export const useAuthStore = create((set) => ({
    user: devMockUser,
    session: devMockSession,
    setAuth: (user, session) => set({ user, session }),
    clearAuth: () => set({ user: devMockUser, session: devMockSession }),
}));
