-- Conea データベーススキーマ修正マイグレーション
-- 2025-05-21 作成

-- トークン有効期限のタイムスタンプ型不一致の修正
ALTER TABLE IF EXISTS refresh_tokens 
  ALTER COLUMN expires_at TYPE TIMESTAMP WITH TIME ZONE;

-- APIログインデックス追加（パフォーマンス改善）
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at 
  ON api_logs(created_at);

-- チャットセッション関連インデックス追加
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id 
  ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at 
  ON chat_sessions(created_at);

-- チャットメッセージのテーブルとリレーション修正
ALTER TABLE IF EXISTS chat_messages 
  ADD CONSTRAINT IF NOT EXISTS fk_chat_messages_session_id 
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
  ON DELETE CASCADE;

-- JSONBへの型変換が必要な設定カラム（既存データを保持しながら変換）
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'settings' 
    AND data_type = 'json'
  ) THEN
    ALTER TABLE user_preferences 
      ALTER COLUMN settings TYPE JSONB USING settings::JSONB;
  END IF;
END
$$;

-- 不足しているユニーク制約を追加
ALTER TABLE IF EXISTS chat_sessions 
  ADD CONSTRAINT IF NOT EXISTS uq_chat_sessions_session_key 
  UNIQUE (session_key);

-- 欠落している外部キー制約の追加
ALTER TABLE IF EXISTS api_keys 
  ADD CONSTRAINT IF NOT EXISTS fk_api_keys_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE CASCADE;

-- パーティション管理のための日付インデックス追加
CREATE INDEX IF NOT EXISTS idx_api_logs_partition_key 
  ON api_logs(date_trunc('month', created_at));

-- 新しいAPI認証トークン管理用テーブルの権限設定
GRANT SELECT, INSERT, UPDATE, DELETE ON api_tokens TO conea_app_user;

-- トークンカウント用のカウンターキャッシュテーブル
CREATE TABLE IF NOT EXISTS token_count_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash VARCHAR(64) NOT NULL,
  token_count INTEGER NOT NULL,
  provider VARCHAR(20) NOT NULL,
  model VARCHAR(50) NOT NULL, 
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(text_hash, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_token_count_cache_last_accessed
  ON token_count_cache(last_accessed);

-- チャート画像キャッシュテーブル
CREATE TABLE IF NOT EXISTS chart_image_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_hash VARCHAR(64) NOT NULL,
  chart_data JSONB NOT NULL,
  image_data TEXT NOT NULL, -- Base64エンコードされた画像データ
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(chart_hash)
);

CREATE INDEX IF NOT EXISTS idx_chart_image_cache_last_accessed
  ON chart_image_cache(last_accessed);

-- AI会話履歴の永続化テーブル
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  provider_id VARCHAR(50) NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id
  ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at
  ON ai_conversations(updated_at);

-- AI会話メッセージテーブル
CREATE TABLE IF NOT EXISTS ai_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sequence_number INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_messages_conversation_id
  ON ai_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_messages_sequence
  ON ai_conversation_messages(conversation_id, sequence_number);

-- クリーンアップ関数: 古いキャッシュエントリを削除
CREATE OR REPLACE FUNCTION cleanup_old_cache_entries() 
RETURNS VOID AS $$
BEGIN
  -- 30日以上アクセスされていないトークンカウントキャッシュを削除
  DELETE FROM token_count_cache 
  WHERE last_accessed < NOW() - INTERVAL '30 days';
  
  -- 7日以上アクセスされていないチャート画像キャッシュを削除
  DELETE FROM chart_image_cache 
  WHERE last_accessed < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 更新日時自動更新トリガーをAI会話テーブルに追加
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE
  ON ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();