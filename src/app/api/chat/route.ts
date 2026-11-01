import { createGoogle } from '@ai-sdk/google';
import { safeValidateUIMessages, convertToModelMessages, streamText } from 'ai';

export const maxDuration = 30;

const jsonResponse = (body: { error: string }, status: number) =>
  Response.json(body, { status });

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_GENERATIVE_AI_API_KEY または GEMINI_API_KEY が設定されていません。');
    return jsonResponse({ error: 'AI APIキーが設定されていません。.env.local を確認してください。' }, 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'リクエストのJSON形式が不正です。' }, 400);
  }

  if (typeof body !== 'object' || body === null || !('messages' in body) || !Array.isArray(body.messages)) {
    return jsonResponse({ error: 'メッセージ形式が不正です。' }, 400);
  }

  const validation = await safeValidateUIMessages({ messages: body.messages });
  if (!validation.success) {
    return jsonResponse({ error: 'メッセージ形式が不正です。' }, 400);
  }

  const messages = validation.data.filter((message) => message.role === 'user' || message.role === 'assistant');
  if (messages.length === 0) {
    return jsonResponse({ error: '送信するメッセージ本文がありません。' }, 400);
  }

  try {
    const result = streamText({
      model: createGoogle({ apiKey })('gemini-2.5-flash'),
      system: 'あなたはベーカリーのERPシステムのアシスタントAIです。ユーザーの業務をサポートし、丁寧かつ簡潔に答えてください。システム内データを直接参照できない場合は、その旨を明示してください。',
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    console.error('AIチャットの応答生成に失敗しました。', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'AIの応答生成に失敗しました。' },
      500
    );
  }
}