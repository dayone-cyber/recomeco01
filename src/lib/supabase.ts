import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sem as duas variáveis o app continua 100% local (modo atual). */
export const cloudEnabled = !!url && !!anon;

// Apenas a chave pública (anon) vai no front. A proteção dos dados é o RLS do schema.sql.
export const supabase = cloudEnabled ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
