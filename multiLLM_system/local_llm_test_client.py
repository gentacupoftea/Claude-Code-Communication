# multiLLM_system/local_llm_test_client.py

import requests
import json
import os

API_BASE_URL = "http://localhost:8000"
# 環境変数からモデルを取得、なければデフォルト値を使用
DEFAULT_MODEL = os.getenv("LOCAL_LLM_MODEL", "command-r-plus")

def test_local_llm_generation(prompt: str):
    """ /generate エンドポイントをテストする """
    print(f"--- Testing /generate endpoint with local_llm (model: {DEFAULT_MODEL}) ---")
    try:
        response = requests.post(
            f"{API_BASE_URL}/generate",
            json={
                "prompt": prompt,
                "worker_type": "local_llm",
                "model_id": DEFAULT_MODEL
            }
        )
        response.raise_for_status()
        data = response.json()
        print("✅ Success!")
        print("Response:\n", json.dumps(data, indent=2, ensure_ascii=False))

    except requests.exceptions.RequestException as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_prompt = "日本の首都について、30文字以内で簡潔に教えてください。"
    test_local_llm_generation(test_prompt)
