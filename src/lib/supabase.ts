import { createClient } from '@supabase/supabase-js';

// .env.localに設定したURLとキーを読み込む
// ビルドエラー（GitHub Actions環境）を回避するためにフォールバック値を設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Supabaseと通信するクライアント（窓口）を作成
export const supabase = createClient(supabaseUrl, supabaseKey);