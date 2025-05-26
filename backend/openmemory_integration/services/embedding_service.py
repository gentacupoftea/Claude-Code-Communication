"""
埋め込みサービス - テキストのベクトル埋め込みを生成
"""

from typing import List, Optional, Dict, Any
from abc import ABC, abstractmethod
import openai
import os
import numpy as np
from sentence_transformers import SentenceTransformer
import spacy
from ..models.vector_model import VectorEmbedding, EmbeddingMetadata


class EmbeddingService(ABC):
    """埋め込みサービスの抽象基底クラス"""
    
    @abstractmethod
    async def generate_embedding(self, text: str) -> List[float]:
        """テキストの埋め込みベクトルを生成"""
        pass
    
    @abstractmethod
    def get_model_name(self) -> str:
        """使用モデル名を取得"""
        pass
    
    @abstractmethod
    def get_dimension(self) -> int:
        """埋め込み次元数を取得"""
        pass


class OpenAIEmbeddingService(EmbeddingService):
    """OpenAI埋め込みサービス"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "text-embedding-ada-002"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.client = openai.AsyncOpenAI(api_key=self.api_key) if self.api_key else None
        
        # モデル別次元数
        self.model_dimensions = {
            "text-embedding-ada-002": 1536,
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072
        }
    
    async def generate_embedding(self, text: str) -> List[float]:
        """OpenAI APIでテキスト埋め込みを生成"""
        if not self.client:
            raise ValueError("OpenAI API keyが設定されていません")
        
        try:
            # テキストの前処理
            text = text.replace("\n", " ").strip()
            if not text:
                raise ValueError("空のテキストです")
            
            # OpenAI APIコール
            response = await self.client.embeddings.create(
                input=text,
                model=self.model
            )
            
            return response.data[0].embedding
            
        except Exception as e:
            print(f"OpenAI埋め込み生成エラー: {e}")
            # フォールバック: ゼロベクトル
            return [0.0] * self.get_dimension()
    
    def get_model_name(self) -> str:
        return f"openai/{self.model}"
    
    def get_dimension(self) -> int:
        return self.model_dimensions.get(self.model, 1536)


class SentenceTransformerService(EmbeddingService):
    """SentenceTransformer埋め込みサービス"""
    
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        try:
            self.model = SentenceTransformer(model_name)
        except Exception as e:
            print(f"SentenceTransformerモデル読み込みエラー: {e}")
            # フォールバック: より軽量なモデル
            self.model_name = "all-MiniLM-L6-v2"
            self.model = SentenceTransformer(self.model_name)
    
    async def generate_embedding(self, text: str) -> List[float]:
        """SentenceTransformerでテキスト埋め込みを生成"""
        try:
            # テキストの前処理
            text = text.replace("\n", " ").strip()
            if not text:
                raise ValueError("空のテキストです")
            
            # 埋め込み生成
            embedding = self.model.encode(text, convert_to_tensor=False)
            return embedding.tolist()
            
        except Exception as e:
            print(f"SentenceTransformer埋め込み生成エラー: {e}")
            # フォールバック: ゼロベクトル
            return [0.0] * self.get_dimension()
    
    def get_model_name(self) -> str:
        return f"sentence-transformers/{self.model_name}"
    
    def get_dimension(self) -> int:
        # モデルから次元数を取得
        return self.model.get_sentence_embedding_dimension()


class MultilingualEmbeddingService(EmbeddingService):
    """多言語対応埋め込みサービス"""
    
    def __init__(self):
        # 日本語特化モデル
        self.japanese_model = SentenceTransformerService("sentence-transformers/all-MiniLM-L6-v2")
        # 英語特化モデル
        self.english_model = SentenceTransformerService("sentence-transformers/all-mpnet-base-v2")
        
        # 言語検出用
        try:
            self.nlp = spacy.load("ja_core_news_sm")
        except OSError:
            # 日本語モデルがない場合、英語モデルを使用
            try:
                self.nlp = spacy.load("en_core_web_sm")
            except OSError:
                self.nlp = None
    
    def _detect_language(self, text: str) -> str:
        """テキストの言語を検出"""
        if not self.nlp:
            # spaCyが使えない場合、文字種で簡単判定
            import re
            if re.search(r'[ひらがなカタカナ漢字]', text):
                return "ja"
            return "en"
        
        # spaCyで言語検出
        doc = self.nlp(text[:100])  # 最初の100文字で判定
        
        # 日本語文字が含まれているかチェック
        import re
        if re.search(r'[ひらがなカタカナ漢字]', text):
            return "ja"
        return "en"
    
    async def generate_embedding(self, text: str) -> List[float]:
        """言語を検出して適切なモデルで埋め込みを生成"""
        language = self._detect_language(text)
        
        if language == "ja":
            return await self.japanese_model.generate_embedding(text)
        else:
            return await self.english_model.generate_embedding(text)
    
    def get_model_name(self) -> str:
        return "multilingual/adaptive"
    
    def get_dimension(self) -> int:
        # 統一次元数（全モデルで同じ次元数を使用）
        return 384


class HybridEmbeddingService(EmbeddingService):
    """ハイブリッド埋め込みサービス - 複数のサービスを組み合わせ"""
    
    def __init__(self):
        self.services = []
        
        # 利用可能なサービスを順番に試す
        try:
            # OpenAI（最優先）
            openai_service = OpenAIEmbeddingService()
            if openai_service.client:
                self.services.append(openai_service)
        except Exception:
            pass
        
        try:
            # SentenceTransformer（フォールバック）
            self.services.append(SentenceTransformerService())
        except Exception:
            pass
        
        if not self.services:
            raise RuntimeError("利用可能な埋め込みサービスがありません")
        
        self.primary_service = self.services[0]
    
    async def generate_embedding(self, text: str) -> List[float]:
        """プライマリサービスで埋め込みを生成、失敗時はフォールバック"""
        for service in self.services:
            try:
                return await service.generate_embedding(text)
            except Exception as e:
                print(f"埋め込み生成失敗 ({service.get_model_name()}): {e}")
                continue
        
        # 全サービスが失敗した場合
        raise RuntimeError("全ての埋め込みサービスが失敗しました")
    
    def get_model_name(self) -> str:
        return self.primary_service.get_model_name()
    
    def get_dimension(self) -> int:
        return self.primary_service.get_dimension()


class EmbeddingManager:
    """埋め込み管理クラス"""
    
    def __init__(self, service_type: str = "hybrid"):
        self.service = self._create_service(service_type)
    
    def _create_service(self, service_type: str) -> EmbeddingService:
        """埋め込みサービスを作成"""
        if service_type == "openai":
            return OpenAIEmbeddingService()
        elif service_type == "sentence-transformer":
            return SentenceTransformerService()
        elif service_type == "multilingual":
            return MultilingualEmbeddingService()
        elif service_type == "hybrid":
            return HybridEmbeddingService()
        else:
            raise ValueError(f"未対応のサービスタイプ: {service_type}")
    
    async def create_embedding(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> VectorEmbedding:
        """テキストからVectorEmbeddingオブジェクトを作成"""
        vector = await self.service.generate_embedding(text)
        
        embedding_metadata = EmbeddingMetadata(
            model_name=self.service.get_model_name(),
            dimension=self.service.get_dimension(),
            metadata=metadata or {}
        )
        
        return VectorEmbedding(
            text=text,
            vector=vector,
            metadata=embedding_metadata
        )
    
    async def calculate_similarity(self, text1: str, text2: str) -> float:
        """2つのテキスト間の類似度を計算"""
        embedding1 = await self.create_embedding(text1)
        embedding2 = await self.create_embedding(text2)
        
        return embedding1.cosine_similarity(embedding2.vector)
    
    def get_service_info(self) -> Dict[str, Any]:
        """埋め込みサービスの情報を取得"""
        return {
            "model_name": self.service.get_model_name(),
            "dimension": self.service.get_dimension(),
            "service_type": type(self.service).__name__
        }