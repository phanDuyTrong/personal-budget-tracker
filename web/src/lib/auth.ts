import { supabase } from '@/lib/supabase';

export async function getRequiredUser(message = 'You must be signed in to continue.') {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error(message);
    return data.user;
}
