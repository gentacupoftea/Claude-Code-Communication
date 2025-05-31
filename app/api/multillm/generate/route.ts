import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, model, temperature, max_tokens } = await request.json();

    // デモ用のモデル応答
    const modelResponses: { [key: string]: string } = {
      'gpt-4o': `GPT-4oを使用した応答: ${prompt}について、高度な推論能力を活用してお答えします。`,
      'claude-3-5-sonnet': `Claude 3.5 Sonnetによる分析: ${prompt}に関して、安全性と正確性を重視した詳細な回答をお送りします。`,
      'gemini-1.5-pro': `Gemini 1.5 Proの見解: ${prompt}について、長文処理とマルチモーダル能力を活かして回答いたします。`,
      'default': `${model}を使用した応答: ${prompt}についてお答えします。`
    };

    const selectedResponse = modelResponses[model] || modelResponses['default'];

    // 遅延をシミュレート
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

    const response = {
      message: selectedResponse,
      usage: {
        prompt_tokens: Math.floor(Math.random() * 100) + 50,
        completion_tokens: Math.floor(Math.random() * 200) + 100,
        total_tokens: Math.floor(Math.random() * 300) + 150,
      },
      model: model,
      metadata: {
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 1000,
        response_time: Math.floor(Math.random() * 2000) + 500,
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('MultiLLM API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}