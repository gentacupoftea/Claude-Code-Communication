import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { content, sessionId, model } = await request.json();

    // デモ用のチャット応答
    const responses = [
      `こんにちは！${content}についてお答えします。`,
      `「${content}」について詳しく説明いたします。`,
      `ご質問「${content}」への回答をお送りします。`,
      `${content}に関する情報をお調べしました。`,
    ];

    const selectedResponse = responses[Math.floor(Math.random() * responses.length)];

    // 遅延をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const response = {
      message: {
        id: `msg-${Date.now()}`,
        content: content,
        role: 'user',
        timestamp: new Date().toISOString(),
      },
      response: {
        id: `res-${Date.now()}`,
        content: selectedResponse,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        model: model || 'demo-model',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}