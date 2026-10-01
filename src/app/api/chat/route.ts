import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // 1. APIキーの確認
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('【Error】GOOGLE_GENERATIVE_AI_API_KEY が設定されていません。');
      return new Response(
        JSON.stringify({ error: 'APIキーが設定されていません。.env.local を確認してください。' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];

    // 2. メッセージデータの安全な抽出 (CoreMessage形式への手動マッピング)
    const messages = rawMessages
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => {
        let content = '';
        if (typeof m.content === 'string') {
          content = m.content;
        } else if (Array.isArray(m.parts)) {
          content = m.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text ?? '')
            .join('');
        }
        return {
          role: m.role as 'user' | 'assistant',
          content,
        };
      })
      .filter((m: any) => m.content.trim().length > 0);

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: '送信するメッセージ本文がありません。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Gemini モデルの呼び出し (安定版モデル指定)
    const result = streamText({
      model: google('gemini-1.5-flash'),
      system: 'あなたはベーカリーのERPシステムのアシスタントAIです。ユーザーの業務をサポートし、丁寧かつ簡潔に答えてください。',
      messages,
    });

    // 4. ストリームレスポンスの返却
    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('===== API ROUTE ERROR =====');
    console.error(error);
    console.error('===========================');

    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}