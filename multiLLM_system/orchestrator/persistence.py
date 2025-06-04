"""
Orchestrator用の永続化層
タスク、会話、状態の永続化を管理
"""
import os
import json
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from contextlib import asynccontextmanager
import redis.asyncio as redis
import asyncpg
from dataclasses import asdict
import pickle

logger = logging.getLogger(__name__)


class PersistenceManager:
    """永続化マネージャー - Redis（短期）とPostgreSQL（長期）を管理"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.redis_client: Optional[redis.Redis] = None
        self.pg_pool: Optional[asyncpg.Pool] = None
        
        # Redis設定
        self.redis_config = config.get('redis', {
            'host': os.getenv('REDIS_HOST', 'localhost'),
            'port': int(os.getenv('REDIS_PORT', 6379)),
            'db': int(os.getenv('REDIS_DB', 0)),
            'password': os.getenv('REDIS_PASSWORD')
        })
        
        # PostgreSQL設定
        self.pg_config = {
            'host': os.getenv('PG_HOST', 'localhost'),
            'port': int(os.getenv('PG_PORT', 5432)),
            'database': os.getenv('PG_DATABASE', 'multillm'),
            'user': os.getenv('PG_USER', 'postgres'),
            'password': os.getenv('PG_PASSWORD', 'postgres')
        }
        
        # キャッシュ設定
        self.cache_ttl = config.get('cache_ttl', 3600)  # 1時間
        self.max_retries = 3
        self.retry_delay = 1.0
    
    async def initialize(self):
        """接続の初期化"""
        logger.info("🔧 Initializing persistence layer...")
        
        # Redis接続
        try:
            self.redis_client = await redis.Redis(
                host=self.redis_config['host'],
                port=self.redis_config['port'],
                db=self.redis_config['db'],
                password=self.redis_config.get('password'),
                decode_responses=False  # バイナリデータを扱うため
            )
            await self.redis_client.ping()
            logger.info("✅ Redis connected successfully")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            # Redisが利用できない場合も続行（デグレード動作）
            self.redis_client = None
        
        # PostgreSQL接続
        try:
            self.pg_pool = await asyncpg.create_pool(
                **self.pg_config,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            await self._create_tables()
            logger.info("✅ PostgreSQL connected successfully")
        except Exception as e:
            logger.error(f"❌ PostgreSQL connection failed: {e}")
            raise  # PostgreSQLは必須
    
    async def shutdown(self):
        """接続のクリーンアップ"""
        if self.redis_client:
            await self.redis_client.close()
        if self.pg_pool:
            await self.pg_pool.close()
    
    async def _create_tables(self):
        """必要なテーブルの作成"""
        async with self.pg_pool.acquire() as conn:
            # タスクテーブル
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS tasks (
                    id VARCHAR(64) PRIMARY KEY,
                    type VARCHAR(50) NOT NULL,
                    description TEXT,
                    priority INTEGER NOT NULL,
                    user_id VARCHAR(64) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    assigned_worker VARCHAR(64),
                    result JSONB,
                    metadata JSONB,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    completed_at TIMESTAMP
                )
            ''')
            
            # 会話テーブル
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS conversations (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    messages JSONB NOT NULL DEFAULT '[]',
                    total_tokens INTEGER DEFAULT 0,
                    start_time TIMESTAMP NOT NULL DEFAULT NOW(),
                    end_time TIMESTAMP,
                    metadata JSONB,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            ''')
            
            # LLM応答ログテーブル
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS llm_responses (
                    id VARCHAR(64) PRIMARY KEY,
                    conversation_id VARCHAR(64) REFERENCES conversations(id),
                    task_id VARCHAR(64) REFERENCES tasks(id),
                    provider VARCHAR(50) NOT NULL,
                    model VARCHAR(50) NOT NULL,
                    content TEXT NOT NULL,
                    tokens JSONB,
                    metadata JSONB,
                    duration FLOAT,
                    error TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            ''')
            
            # Orchestrator状態テーブル
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS orchestrator_state (
                    id VARCHAR(64) PRIMARY KEY,
                    state_type VARCHAR(50) NOT NULL,
                    state_data JSONB NOT NULL,
                    version INTEGER DEFAULT 1,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            ''')
            
            # インデックスの作成
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_llm_responses_conversation ON llm_responses(conversation_id)')
    
    # ==================== タスク管理 ====================
    
    async def save_task(self, task: 'Task') -> bool:
        """タスクの保存"""
        try:
            # Redisに短期保存
            if self.redis_client:
                key = f"task:{task.id}"
                await self.redis_client.setex(
                    key, 
                    self.cache_ttl,
                    pickle.dumps(asdict(task))
                )
            
            # PostgreSQLに永続保存
            async with self.pg_pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO tasks (id, type, description, priority, user_id, 
                                     status, assigned_worker, result, metadata, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        assigned_worker = EXCLUDED.assigned_worker,
                        result = EXCLUDED.result,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                ''', 
                    task.id,
                    task.type.value,
                    task.description,
                    task.priority.value,
                    task.user_id,
                    task.status,
                    task.assigned_worker,
                    json.dumps(task.result) if task.result else None,
                    json.dumps(task.metadata) if task.metadata else None,
                    task.created_at
                )
            
            return True
        except Exception as e:
            logger.error(f"Failed to save task {task.id}: {e}")
            return False
    
    async def get_task(self, task_id: str) -> Optional[Dict]:
        """タスクの取得"""
        try:
            # まずRedisから取得を試みる
            if self.redis_client:
                key = f"task:{task_id}"
                data = await self.redis_client.get(key)
                if data:
                    return pickle.loads(data)
            
            # RedisになければPostgreSQLから取得
            async with self.pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    'SELECT * FROM tasks WHERE id = $1',
                    task_id
                )
                if row:
                    task_data = dict(row)
                    # Redisにキャッシュ
                    if self.redis_client:
                        await self.redis_client.setex(
                            f"task:{task_id}",
                            self.cache_ttl,
                            pickle.dumps(task_data)
                        )
                    return task_data
            
            return None
        except Exception as e:
            logger.error(f"Failed to get task {task_id}: {e}")
            return None
    
    async def update_task_status(self, task_id: str, status: str, result: Optional[Dict] = None, metadata: Optional[Dict] = None):
        """タスクステータスの更新"""
        try:
            async with self.pg_pool.acquire() as conn:
                query = '''
                    UPDATE tasks 
                    SET status = $2, updated_at = NOW()
                '''
                params = [task_id, status]
                param_count = 2
                
                if result is not None:
                    param_count += 1
                    query += f', result = ${param_count}'
                    params.append(json.dumps(result))
                
                if metadata is not None:
                    param_count += 1
                    query += f', metadata = ${param_count}'
                    params.append(json.dumps(metadata))
                
                if status == 'completed':
                    query += f', completed_at = NOW()'
                elif status == 'interrupted':
                    # 中断されたタスクの場合も終了時刻を記録
                    query += f', completed_at = NOW()'
                
                query += ' WHERE id = $1'
                
                await conn.execute(query, *params)
            
            # Redisキャッシュをクリア
            if self.redis_client:
                await self.redis_client.delete(f"task:{task_id}")
                
        except Exception as e:
            logger.error(f"Failed to update task status {task_id}: {e}")
    
    async def get_pending_tasks(self, limit: int = 100) -> List[Dict]:
        """未処理タスクの取得"""
        try:
            async with self.pg_pool.acquire() as conn:
                rows = await conn.fetch('''
                    SELECT * FROM tasks 
                    WHERE status = 'pending' 
                    ORDER BY priority ASC, created_at ASC
                    LIMIT $1
                ''', limit)
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get pending tasks: {e}")
            return []
    
    async def get_tasks_by_status(self, status: str, limit: int = 100) -> List[Dict]:
        """ステータス別タスクの取得"""
        try:
            async with self.pg_pool.acquire() as conn:
                rows = await conn.fetch('''
                    SELECT * FROM tasks 
                    WHERE status = $1 
                    ORDER BY priority ASC, created_at ASC
                    LIMIT $2
                ''', status, limit)
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get tasks by status {status}: {e}")
            return []
    
    # ==================== 会話管理 ====================
    
    async def save_conversation(self, conversation: 'ConversationLog') -> bool:
        """会話の保存"""
        try:
            conv_dict = asdict(conversation)
            
            # Redisに短期保存
            if self.redis_client:
                key = f"conversation:{conversation.conversation_id}"
                await self.redis_client.setex(
                    key,
                    self.cache_ttl * 24,  # 会話は24時間キャッシュ
                    pickle.dumps(conv_dict)
                )
            
            # PostgreSQLに永続保存
            async with self.pg_pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO conversations (id, user_id, messages, total_tokens, 
                                             start_time, end_time, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO UPDATE SET
                        messages = EXCLUDED.messages,
                        total_tokens = EXCLUDED.total_tokens,
                        end_time = EXCLUDED.end_time,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                ''',
                    conversation.conversation_id,
                    conv_dict.get('user_id', 'unknown'),
                    json.dumps(conversation.messages),
                    conversation.total_tokens,
                    conversation.start_time,
                    conversation.end_time,
                    json.dumps(conv_dict.get('metadata', {}))
                )
                
                # LLM応答の保存
                for llm_response in conversation.llm_responses:
                    await self._save_llm_response(conn, llm_response, conversation.conversation_id)
            
            return True
        except Exception as e:
            logger.error(f"Failed to save conversation {conversation.conversation_id}: {e}")
            return False
    
    async def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        """会話の取得"""
        try:
            # まずRedisから取得
            if self.redis_client:
                key = f"conversation:{conversation_id}"
                data = await self.redis_client.get(key)
                if data:
                    return pickle.loads(data)
            
            # RedisになければPostgreSQLから取得
            async with self.pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    'SELECT * FROM conversations WHERE id = $1',
                    conversation_id
                )
                if row:
                    conv_data = dict(row)
                    
                    # LLM応答も取得
                    llm_rows = await conn.fetch(
                        'SELECT * FROM llm_responses WHERE conversation_id = $1',
                        conversation_id
                    )
                    conv_data['llm_responses'] = [dict(row) for row in llm_rows]
                    
                    # Redisにキャッシュ
                    if self.redis_client:
                        await self.redis_client.setex(
                            f"conversation:{conversation_id}",
                            self.cache_ttl * 24,
                            pickle.dumps(conv_data)
                        )
                    
                    return conv_data
            
            return None
        except Exception as e:
            logger.error(f"Failed to get conversation {conversation_id}: {e}")
            return None
    
    async def _save_llm_response(self, conn: asyncpg.Connection, 
                                llm_response: 'LLMResponse', 
                                conversation_id: str):
        """LLM応答の保存（内部メソッド）"""
        await conn.execute('''
            INSERT INTO llm_responses (id, conversation_id, provider, model,
                                     content, tokens, metadata, duration, error)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ''',
            llm_response.id,
            conversation_id,
            llm_response.provider,
            llm_response.model,
            llm_response.content,
            json.dumps(llm_response.tokens),
            json.dumps(llm_response.metadata),
            llm_response.duration,
            llm_response.error
        )
    
    # ==================== Orchestrator状態管理 ====================
    
    async def save_orchestrator_state(self, state_type: str, state_data: Dict) -> bool:
        """Orchestratorの状態保存"""
        try:
            state_id = f"{state_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            async with self.pg_pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO orchestrator_state (id, state_type, state_data)
                    VALUES ($1, $2, $3)
                ''',
                    state_id,
                    state_type,
                    json.dumps(state_data)
                )
            
            return True
        except Exception as e:
            logger.error(f"Failed to save orchestrator state: {e}")
            return False
    
    async def get_latest_orchestrator_state(self, state_type: str) -> Optional[Dict]:
        """最新のOrchestrator状態取得"""
        try:
            async with self.pg_pool.acquire() as conn:
                row = await conn.fetchrow('''
                    SELECT * FROM orchestrator_state 
                    WHERE state_type = $1 
                    ORDER BY created_at DESC 
                    LIMIT 1
                ''', state_type)
                
                if row:
                    return dict(row)
            
            return None
        except Exception as e:
            logger.error(f"Failed to get orchestrator state: {e}")
            return None
    
    # ==================== ユーティリティ ====================
    
    @asynccontextmanager
    async def redis_pipeline(self):
        """Redisパイプライン用コンテキストマネージャー"""
        if self.redis_client:
            async with self.redis_client.pipeline() as pipe:
                yield pipe
        else:
            yield None
    
    async def health_check(self) -> Dict[str, bool]:
        """ヘルスチェック"""
        health = {
            'redis': False,
            'postgresql': False
        }
        
        # Redisチェック
        if self.redis_client:
            try:
                await self.redis_client.ping()
                health['redis'] = True
            except:
                pass
        
        # PostgreSQLチェック
        if self.pg_pool:
            try:
                async with self.pg_pool.acquire() as conn:
                    await conn.fetchval('SELECT 1')
                health['postgresql'] = True
            except:
                pass
        
        return health
    
    # ==================== トランザクション管理 ====================
    
    @asynccontextmanager
    async def transaction(self):
        """トランザクションコンテキストマネージャー"""
        async with self.pg_pool.acquire() as conn:
            async with conn.transaction():
                yield conn
    
    async def archive_old_conversations(self, days_old: int = 30) -> int:
        """古い会話をアーカイブ"""
        try:
            archived_count = 0
            async with self.transaction() as conn:
                # アーカイブテーブルの作成
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS conversations_archive (
                        LIKE conversations INCLUDING ALL
                    )
                ''')
                
                # 古い会話をアーカイブに移動
                result = await conn.execute('''
                    WITH moved AS (
                        DELETE FROM conversations 
                        WHERE end_time IS NOT NULL 
                        AND end_time < NOW() - INTERVAL '%s days'
                        RETURNING *
                    )
                    INSERT INTO conversations_archive 
                    SELECT * FROM moved
                ''', days_old)
                
                archived_count = int(result.split()[-1]) if result else 0
                logger.info(f"Archived {archived_count} conversations older than {days_old} days")
            
            return archived_count
        except Exception as e:
            logger.error(f"Failed to archive conversations: {e}")
            return 0
    
    async def get_task_statistics(self, user_id: Optional[str] = None) -> Dict:
        """タスク統計の取得"""
        try:
            async with self.pg_pool.acquire() as conn:
                if user_id:
                    query = '''
                        SELECT 
                            status, 
                            COUNT(*) as count,
                            AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))) as avg_duration
                        FROM tasks 
                        WHERE user_id = $1
                        GROUP BY status
                    '''
                    rows = await conn.fetch(query, user_id)
                else:
                    query = '''
                        SELECT 
                            status, 
                            COUNT(*) as count,
                            AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))) as avg_duration
                        FROM tasks 
                        GROUP BY status
                    '''
                    rows = await conn.fetch(query)
                
                stats = {
                    'by_status': {row['status']: {
                        'count': row['count'],
                        'avg_duration_seconds': float(row['avg_duration']) if row['avg_duration'] else None
                    } for row in rows},
                    'total': sum(row['count'] for row in rows)
                }
                
                return stats
        except Exception as e:
            logger.error(f"Failed to get task statistics: {e}")
            return {}