import os
import openai
from openai import AsyncOpenAI
from dotenv import load_dotenv
from typing import List, Dict, AsyncGenerator
import logging

# .envファイルから環境変数を読み込む
load_dotenv()

logger = logging.getLogger(__name__)

class MultiLLMService:
    def __init__(self):
        # 環境変数からAPIキーを取得
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OPENAI_API_KEY not found in environment variables. Using mock mode.")
            self.mock_mode = True
        else:
            self.mock_mode = False
            # 非同期対応のOpenAIクライアントを初期化
            self.client = AsyncOpenAI(api_key=self.api_key)

    async def stream_chat_completion(
        self, messages: List[Dict[str, str]], model: str = "gpt-3.5-turbo"
    ) -> AsyncGenerator[str, None]:
        """
        OpenAI APIを使用して、チャットの応答をストリーミングで生成します。
        モックモードの場合は、ダミー応答を返します。
        """
        if self.mock_mode:
            # モックモードの場合
            mock_message = "申し訳ございません。現在OpenAI APIキーが設定されていないため、モック応答を返しています。本番環境では実際のAI応答が表示されます。"
            for char in mock_message:
                yield char
                import asyncio
                await asyncio.sleep(0.02)
            return

        try:
            stream = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=1000
            )
            async for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            logger.error(f"Error during OpenAI API call: {e}")
            yield f"エラーが発生しました: {str(e)}"

# シングルトンインスタンスを作成
multi_llm_service = MultiLLMService()