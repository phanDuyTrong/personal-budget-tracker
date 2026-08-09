import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card } from "@heroui/card";

function AuthLayout({ title, subtitle, children }) {
    const { user, isReady } = useAuthStore();

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }
    
    // Automatically redirect to dashboard if user is already authenticated or mocked
    if (user) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[120px] animate-pulse" />
            
            <div className="w-full max-w-md relative z-10 space-y-8">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-[2rem] flex items-center justify-center text-white font-black text-3xl mx-auto bg-primary shadow-2xl shadow-primary/40 rotate-12 hover:rotate-0 transition-transform duration-500">
                        B
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">{title}</h1>
                        <p className="text-sm font-medium text-neutral-500">{subtitle}</p>
                    </div>
                </div>
                <Card className="glass-card backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-2xl">
                    {children}
                </Card>
                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                    <ShieldCheckIcon className="h-4 w-4" />
                    Secure & Encrypted
                </div>
            </div>
        </div>
    );
}

export function Login() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (err) { setError(err.message); setLoading(false); return; }
        setAuth(data.user, data.session);
        navigate('/');
        setLoading(false);
    };

    return (
        <AuthLayout title="Welcome back" subtitle="Sign in to your Budget Manager">
            <form onSubmit={handleSubmit} className="space-y-6">
                <Input 
                    type="email" 
                    label="Email"
                    placeholder="you@example.com" 
                    value={form.email}
                    onValueChange={v => setForm(f => ({ ...f, email: v }))} 
                    required
                    variant="flat"
                    className="font-bold"
                />
                
                <Input 
                    type={showPw ? 'text' : 'password'} 
                    label="Password"
                    placeholder="••••••••" 
                    value={form.password}
                    onValueChange={v => setForm(f => ({ ...f, password: v }))} 
                    required
                    variant="flat"
                    className="font-bold"
                    endContent={
                        <button type="button" onClick={() => setShowPw(s => !s)} className="text-neutral-400 focus:outline-none">
                            {showPw ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    }
                />

                {error && <p className="text-[10px] font-bold text-center text-danger uppercase tracking-wider">{error}</p>}
                
                <Button 
                    type="submit" 
                    isLoading={loading}
                    color="primary"
                    className="w-full font-black text-lg py-7 rounded-2xl shadow-xl shadow-primary/20"
                >
                    Sign in
                </Button>
            </form>
            <div className="pt-6 border-t border-white/20 dark:border-neutral-800/20 mt-6">
                <p className="text-center text-sm font-medium text-neutral-500">
                    Don't have an account?{' '}
                    <Link to="/register" className="font-black text-primary hover:underline">Register</Link>
                </p>
            </div>
        </AuthLayout>
    );
}

export function Register() {
    const [form, setForm] = useState({ email: '', password: '', fullName: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        const { data, error: err } = await supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: { data: { full_name: form.fullName } },
        });
        if (err) { setError(err.message); setLoading(false); return; }
        setAuth(data.user, data.session);
        navigate('/');
        setLoading(false);
    };

    return (
        <AuthLayout title="Create account" subtitle="Start tracking your finances today">
            <form onSubmit={handleSubmit} className="space-y-6">
                <Input 
                    label="Full Name"
                    placeholder="John Doe" 
                    value={form.fullName}
                    onValueChange={v => setForm(f => ({ ...f, fullName: v }))} 
                    variant="flat"
                    className="font-bold"
                />
                <Input 
                    type="email" 
                    label="Email"
                    placeholder="you@example.com" 
                    value={form.email}
                    onValueChange={v => setForm(f => ({ ...f, email: v }))} 
                    required
                    variant="flat"
                    className="font-bold"
                />
                <Input 
                    type={showPw ? 'text' : 'password'} 
                    label="Password"
                    placeholder="Min 6 characters" 
                    value={form.password}
                    onValueChange={v => setForm(f => ({ ...f, password: v }))} 
                    required
                    variant="flat"
                    className="font-bold"
                    endContent={
                        <button type="button" onClick={() => setShowPw(s => !s)} className="text-neutral-400 focus:outline-none">
                            {showPw ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    }
                />
                {error && <p className="text-[10px] font-bold text-center text-danger uppercase tracking-wider">{error}</p>}
                
                <Button 
                    type="submit" 
                    isLoading={loading}
                    color="primary"
                    className="w-full font-black text-lg py-7 rounded-2xl shadow-xl shadow-primary/20"
                >
                    Create account
                </Button>
            </form>
            <div className="pt-6 border-t border-white/20 dark:border-neutral-800/20 mt-6">
                <p className="text-center text-sm font-medium text-neutral-500">
                    Already have an account?{' '}
                    <Link to="/login" className="font-black text-primary hover:underline">Sign in</Link>
                </p>
            </div>
        </AuthLayout>
    );
}
