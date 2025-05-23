"""
Memory Sync Service - OpenMemory同期サービス
全LLMの記憶を定期的に同期し、コンテキストを共有
"""

import asyncio
import logging
import json
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import hashlib
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


@dataclass
class MemoryEntry:
    """メモリエントリー"""
    id: str
    worker_name: str
    content: str
    metadata: Dict[str, Any]
    timestamp: datetime
    importance: float = 0.5  # 0.0-1.0
    
    def to_dict(self) -> Dict:
        """辞書に変換"""
        return {
            'id': self.id,
            'worker_name': self.worker_name,
            'content': self.content,
            'metadata': self.metadata,
            'timestamp': self.timestamp.isoformat(),
            'importance': self.importance
        }


class MemorySyncService:
    """
    OpenMemoryと連携してLLM間でメモリを同期
    """
    
    def __init__(self, config: Dict):
        self.config = config
        self.openmemory_url = config.get('storage', {}).get('connectionString', 'http://localhost:8765')
        self.sync_interval = config.get('syncInterval', 300)  # 5分
        self.conflict_resolution = config.get('conflictResolution', 'latest')
        
        # メモリキャッシュ
        self.memory_cache = {}
        self.last_sync = {}
        
        # 同期状態
        self.syncing = False
        self.sync_lock = asyncio.Lock()
        
        # HTTPセッション
        self.session = None
    
    async def initialize(self):
        """サービスの初期化"""
        logger.info("🧠 Initializing Memory Sync Service...")
        
        # HTTPセッションを作成
        self.session = aiohttp.ClientSession()
        
        # 初期同期
        await self.sync_all()
        
        # 定期同期を開始
        asyncio.create_task(self._sync_loop())
        
        logger.info("✅ Memory Sync Service initialized")
    
    async def shutdown(self):
        """サービスのシャットダウン"""
        if self.session:
            await self.session.close()
    
    async def _sync_loop(self):
        """定期的な同期ループ"""
        while True:
            await asyncio.sleep(self.sync_interval)
            try:
                await self.sync_all()
            except Exception as e:
                logger.error(f"Sync loop error: {e}")
    
    async def sync_all(self):
        """全Workerのメモリを同期"""
        async with self.sync_lock:
            if self.syncing:
                logger.warning("Sync already in progress, skipping...")
                return
            
            self.syncing = True
            logger.info("🔄 Starting memory synchronization...")
            
            try:
                # OpenMemoryから最新のメモリを取得
                remote_memories = await self._fetch_remote_memories()
                
                # ローカルメモリと統合
                merged_memories = await self._merge_memories(remote_memories)
                
                # OpenMemoryに保存
                await self._save_to_openmemory(merged_memories)
                
                # ローカルキャッシュを更新
                self.memory_cache = merged_memories
                
                logger.info(f"✅ Memory sync completed. Total entries: {len(merged_memories)}")
                
            except Exception as e:
                logger.error(f"Memory sync failed: {e}")
            finally:
                self.syncing = False
    
    async def _fetch_remote_memories(self) -> Dict[str, List[MemoryEntry]]:
        """OpenMemoryから記憶を取得"""
        try:
            # URLバリデーション
            if not self._validate_url(self.openmemory_url):
                raise ValueError(f"Invalid OpenMemory URL: {self.openmemory_url}")
            
            # 最後の同期時刻以降の更新を取得
            since = datetime.now() - timedelta(seconds=self.sync_interval * 2)
            
            async with self.session.get(
                f"{self.openmemory_url}/api/memories",
                params={
                    'since': since.isoformat(),
                    'client': 'multiLLM'
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Worker別に整理
                    memories_by_worker = {}
                    for item in data.get('memories', []):
                        worker_name = item.get('metadata', {}).get('worker_name', 'unknown')
                        
                        if worker_name not in memories_by_worker:
                            memories_by_worker[worker_name] = []
                        
                        memories_by_worker[worker_name].append(MemoryEntry(
                            id=item['id'],
                            worker_name=worker_name,
                            content=item['content'],
                            metadata=item.get('metadata', {}),
                            timestamp=datetime.fromisoformat(item['created_at']),
                            importance=item.get('metadata', {}).get('importance', 0.5)
                        ))
                    
                    return memories_by_worker
                else:
                    logger.error(f"Failed to fetch memories: {response.status}")
                    return {}
                    
        except Exception as e:
            logger.error(f"Error fetching remote memories: {e}")
            return {}
    
    async def _merge_memories(self, remote_memories: Dict[str, List[MemoryEntry]]) -> Dict[str, List[MemoryEntry]]:
        """ローカルとリモートのメモリをマージ"""
        merged = {}
        
        # すべてのWorkerを処理
        all_workers = set(self.memory_cache.keys()) | set(remote_memories.keys())
        
        for worker_name in all_workers:
            local_entries = self.memory_cache.get(worker_name, [])
            remote_entries = remote_memories.get(worker_name, [])
            
            # コンフリクト解決
            if self.conflict_resolution == 'latest':
                # タイムスタンプでソートして最新を優先
                all_entries = local_entries + remote_entries
                all_entries.sort(key=lambda x: x.timestamp, reverse=True)
                
                # 重複を除去（IDベース）
                seen_ids = set()
                unique_entries = []
                for entry in all_entries:
                    if entry.id not in seen_ids:
                        seen_ids.add(entry.id)
                        unique_entries.append(entry)
                
                merged[worker_name] = unique_entries[:100]  # 最新100件を保持
                
            elif self.conflict_resolution == 'merge':
                # 内容をマージ（実装は複雑になるため簡略化）
                merged[worker_name] = self._merge_entries(local_entries, remote_entries)
            
            else:  # manual
                # 手動解決が必要な場合はローカルを優先
                merged[worker_name] = local_entries
        
        return merged
    
    def _merge_entries(self, local: List[MemoryEntry], remote: List[MemoryEntry]) -> List[MemoryEntry]:
        """エントリーをマージ（詳細実装）"""
        # IDでインデックス化
        local_by_id = {e.id: e for e in local}
        remote_by_id = {e.id: e for e in remote}
        
        merged = []
        
        # 両方に存在するエントリーをマージ
        for entry_id in set(local_by_id.keys()) & set(remote_by_id.keys()):
            local_entry = local_by_id[entry_id]
            remote_entry = remote_by_id[entry_id]
            
            # より新しい方を選択
            if local_entry.timestamp > remote_entry.timestamp:
                merged.append(local_entry)
            else:
                merged.append(remote_entry)
        
        # ローカルのみのエントリー
        for entry_id in set(local_by_id.keys()) - set(remote_by_id.keys()):
            merged.append(local_by_id[entry_id])
        
        # リモートのみのエントリー
        for entry_id in set(remote_by_id.keys()) - set(local_by_id.keys()):
            merged.append(remote_by_id[entry_id])
        
        return sorted(merged, key=lambda x: x.timestamp, reverse=True)[:100]
    
    def _validate_url(self, url: str) -> bool:
        """URLの妥当性を検証"""
        try:
            parsed = urlparse(url)
            # HTTPまたはHTTPSのみ許可
            if parsed.scheme not in ['http', 'https']:
                return False
            # ホスト名が存在することを確認
            if not parsed.netloc:
                return False
            # ホワイトリスト（必要に応じて追加）
            allowed_hosts = ['localhost', '127.0.0.1', 'openmemory.internal']
            if self.config.get('allowedHosts'):
                allowed_hosts.extend(self.config['allowedHosts'])
            # ホスト名チェック（プロダクション環境では必須）
            # if parsed.hostname not in allowed_hosts:
            #     return False
            return True
        except Exception:
            return False
    
    async def _save_to_openmemory(self, memories: Dict[str, List[MemoryEntry]]):
        """OpenMemoryに保存"""
        try:
            # バッチ保存用のデータを準備
            batch_data = []
            
            for worker_name, entries in memories.items():
                for entry in entries[:10]:  # 各Workerの最新10件を保存
                    batch_data.append({
                        'content': entry.content,
                        'metadata': {
                            **entry.metadata,
                            'worker_name': worker_name,
                            'importance': entry.importance,
                            'multiLLM': True
                        }
                    })
            
            if batch_data:
                async with self.session.post(
                    f"{self.openmemory_url}/api/memories/batch",
                    json={'memories': batch_data},
                    headers={'Content-Type': 'application/json'}
                ) as response:
                    if response.status == 200:
                        logger.info(f"📤 Saved {len(batch_data)} memories to OpenMemory")
                    else:
                        logger.error(f"Failed to save memories: {response.status}")
                        
        except Exception as e:
            logger.error(f"Error saving to OpenMemory: {e}")
    
    async def add_memory(self, worker_name: str, content: str, metadata: Optional[Dict] = None, importance: float = 0.5):
        """新しいメモリを追加"""
        entry = MemoryEntry(
            id=self._generate_id(worker_name, content),
            worker_name=worker_name,
            content=content,
            metadata=metadata or {},
            timestamp=datetime.now(),
            importance=importance
        )
        
        # ローカルキャッシュに追加
        if worker_name not in self.memory_cache:
            self.memory_cache[worker_name] = []
        
        self.memory_cache[worker_name].insert(0, entry)
        
        # 重要度が高い場合は即座に同期
        if importance > 0.8:
            await self._save_single_memory(entry)
    
    async def _save_single_memory(self, entry: MemoryEntry):
        """単一のメモリを即座に保存"""
        try:
            async with self.session.post(
                f"{self.openmemory_url}/api/memories",
                json={
                    'content': entry.content,
                    'metadata': {
                        **entry.metadata,
                        'worker_name': entry.worker_name,
                        'importance': entry.importance,
                        'multiLLM': True
                    }
                }
            ) as response:
                if response.status == 200:
                    logger.info(f"📤 High importance memory saved immediately")
                    
        except Exception as e:
            logger.error(f"Error saving single memory: {e}")
    
    def _generate_id(self, worker_name: str, content: str) -> str:
        """メモリエントリーのIDを生成"""
        data = f"{worker_name}:{content}:{datetime.now().isoformat()}"
        return hashlib.md5(data.encode()).hexdigest()
    
    async def search_memories(self, query: str, worker_filter: Optional[List[str]] = None, limit: int = 10) -> List[MemoryEntry]:
        """メモリを検索"""
        results = []
        
        # ローカルキャッシュから検索
        for worker_name, entries in self.memory_cache.items():
            if worker_filter and worker_name not in worker_filter:
                continue
            
            for entry in entries:
                if query.lower() in entry.content.lower():
                    results.append(entry)
                    if len(results) >= limit:
                        break
        
        # 重要度でソート
        results.sort(key=lambda x: x.importance, reverse=True)
        
        return results[:limit]
    
    async def get_worker_context(self, worker_name: str) -> Dict[str, Any]:
        """特定Workerのコンテキストを取得"""
        entries = self.memory_cache.get(worker_name, [])
        
        if not entries:
            return {'memories': [], 'summary': 'No memories found'}
        
        # 最新のメモリ
        recent_memories = [e.to_dict() for e in entries[:5]]
        
        # 重要なメモリ
        important_memories = [
            e.to_dict() for e in entries 
            if e.importance > 0.7
        ][:5]
        
        # サマリー生成（簡易版）
        summary = f"Worker {worker_name} has {len(entries)} memories. "
        summary += f"Most recent: {entries[0].content[:50]}..." if entries else ""
        
        return {
            'worker_name': worker_name,
            'total_memories': len(entries),
            'recent_memories': recent_memories,
            'important_memories': important_memories,
            'summary': summary
        }
    
    async def create_conversation_summary(self, conversation_id: str, messages: List[Dict], metadata: Dict) -> str:
        """会話を要約してメモリに保存"""
        # 会話の要約を生成（実際はLLMを使用）
        summary = f"Conversation {conversation_id}: {len(messages)} messages exchanged. "
        summary += f"Topics: {', '.join(metadata.get('topics', ['general']))}"
        
        # 要約をメモリに保存
        await self.add_memory(
            worker_name='orchestrator',
            content=summary,
            metadata={
                'type': 'conversation_summary',
                'conversation_id': conversation_id,
                'message_count': len(messages),
                **metadata
            },
            importance=0.7
        )
        
        return summary
    
    def get_sync_status(self) -> Dict[str, Any]:
        """同期ステータスを取得"""
        return {
            'syncing': self.syncing,
            'last_sync': max(self.last_sync.values()).isoformat() if self.last_sync else None,
            'memory_count': sum(len(entries) for entries in self.memory_cache.values()),
            'workers': list(self.memory_cache.keys()),
            'sync_interval': self.sync_interval
        }


# 使用例
async def main():
    config = {
        'syncInterval': 300,
        'conflictResolution': 'latest',
        'storage': {
            'type': 'openmemory',
            'connectionString': 'http://localhost:8765'
        }
    }
    
    service = MemorySyncService(config)
    await service.initialize()
    
    # メモリを追加
    await service.add_memory(
        worker_name='backend_worker',
        content='APIエンドポイント/api/usersを実装しました',
        metadata={'task_id': '123', 'type': 'implementation'},
        importance=0.8
    )
    
    # メモリを検索
    results = await service.search_memories('API')
    for result in results:
        print(f"Found: {result.content} (importance: {result.importance})")
    
    # ステータス確認
    status = service.get_sync_status()
    print(f"Sync status: {json.dumps(status, indent=2)}")
    
    await service.shutdown()


if __name__ == "__main__":
    asyncio.run(main())