import { createClient } from '@supabase/supabase-js';

// .env.localに設定したURLとキーを読み込む
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabaseと通信するクライアント（窓口）を作成
export const supabase = createClient(supabaseUrl, supabaseKey);