import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const client = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// On 401: silently refresh, then retry
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
    failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
    failedQueue = [];
}

client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        original.headers.Authorization = `Bearer ${token}`;
                        return client(original);
                    })
                    .catch((err) => Promise.reject(err));
            }
            original._retry = true;
            isRefreshing = true;
            try {
                const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
                useAuthStore.getState().setToken(data.accessToken);
                processQueue(null, data.accessToken);
                original.headers.Authorization = `Bearer ${data.accessToken}`;
                return client(original);
            } catch (refreshError) {
                processQueue(refreshError, null);
                useAuthStore.getState().logout();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

export default client;
