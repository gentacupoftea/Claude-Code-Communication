import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Authorization ヘッダーをチェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // デモ用のユーザープロフィール
    const profile = {
      id: '1',
      email: 'demo@conea.ai',
      name: 'Demo User',
      avatar: null,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}