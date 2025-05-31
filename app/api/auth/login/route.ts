import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // デモ用の認証処理（実際の実装では適切な認証ロジックを使用）
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 遅延をシミュレート
    await new Promise(resolve => setTimeout(resolve, 500));

    // デモ用のトークンとユーザー情報
    const token = `demo-token-${Date.now()}`;
    const user = {
      id: '1',
      email: email,
      name: 'Demo User',
      avatar: null,
    };

    const response = {
      token,
      user,
      expiresIn: 3600, // 1時間
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}