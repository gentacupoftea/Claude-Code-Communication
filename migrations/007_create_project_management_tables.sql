-- Project Management System - Database Migration
-- 実行日: 2025-05-30
-- 概要: プロジェクト管理、チャット履歴、ファイルストレージ機能のためのテーブル作成

-- プロジェクトフォルダテーブル
CREATE TABLE IF NOT EXISTS project_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES project_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- ユーザーID（既存のユーザーテーブルと関連）
    
    -- プロンプト設定
    system_prompt TEXT,
    prompt_variables JSONB DEFAULT '{}',
    
    -- API設定（暗号化して保存）
    api_settings JSONB DEFAULT '{}',
    
    -- UI設定
    color VARCHAR(7), -- ヘックスカラーコード
    icon VARCHAR(50),
    is_expanded BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    -- メタデータ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- インデックス用
    CONSTRAINT project_folders_name_check CHECK (char_length(name) >= 1),
    CONSTRAINT project_folders_color_check CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- プロジェクトファイルテーブル
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- ファイル基本情報
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL, -- 保存時のファイル名
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    
    -- ストレージ情報
    storage_provider VARCHAR(50) DEFAULT 'gcs', -- gcs, s3, local
    storage_path TEXT NOT NULL,
    storage_url TEXT,
    
    -- 処理状況
    processing_status VARCHAR(20) DEFAULT 'uploading', -- uploading, processing, completed, error
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- ファイル内容のメタデータ
    metadata JSONB DEFAULT '{}', -- rows, columns, summary, etc.
    indexed BOOLEAN DEFAULT false, -- LLM検索用インデックス作成済みフラグ
    index_content TEXT, -- 検索用の抽出テキスト
    
    -- 権限設定
    is_public BOOLEAN DEFAULT false,
    access_level VARCHAR(20) DEFAULT 'private', -- private, project, public
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT project_files_size_check CHECK (file_size > 0),
    CONSTRAINT project_files_progress_check CHECK (progress >= 0 AND progress <= 100)
);

-- チャットセッションテーブル
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- セッション情報
    title VARCHAR(255) NOT NULL DEFAULT '新しいチャット',
    description TEXT,
    
    -- 設定
    system_prompt TEXT, -- セッション固有のプロンプト（プロジェクトの設定を上書き）
    model_settings JSONB DEFAULT '{}', -- LLM設定
    active_apis JSONB DEFAULT '{}', -- 使用中のAPI設定
    
    -- 状態
    status VARCHAR(20) DEFAULT 'active', -- active, archived, deleted
    is_pinned BOOLEAN DEFAULT false,
    tags VARCHAR(50)[] DEFAULT '{}',
    
    -- 統計情報
    message_count INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    
    -- 最後のメッセージ情報（パフォーマンス向上のため）
    last_message_content TEXT,
    last_message_role VARCHAR(20),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chat_sessions_title_check CHECK (char_length(title) >= 1)
);

-- チャットメッセージテーブル
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- メッセージ内容
    role VARCHAR(20) NOT NULL, -- user, assistant, system, function
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text', -- text, markdown, json, image
    
    -- メッセージメタデータ
    metadata JSONB DEFAULT '{}', -- llmProvider, tokensUsed, referencedFiles, thinking, etc.
    
    -- LLM関連情報
    llm_provider VARCHAR(50), -- openai, claude, gemini, etc.
    model_name VARCHAR(100),
    tokens_used INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    
    -- 参照ファイル
    referenced_files UUID[] DEFAULT '{}',
    
    -- 編集履歴
    edit_count INTEGER DEFAULT 0,
    original_content TEXT, -- 編集前の元の内容
    
    -- 状態
    is_edited BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    error_message TEXT,
    
    -- 順序管理
    sequence_number INTEGER NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant', 'system', 'function')),
    CONSTRAINT chat_messages_content_check CHECK (char_length(content) > 0),
    CONSTRAINT chat_messages_tokens_check CHECK (tokens_used >= 0),
    CONSTRAINT chat_messages_sequence_check CHECK (sequence_number > 0)
);

-- プロジェクト共有テーブル
CREATE TABLE IF NOT EXISTS project_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project_folders(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL,
    shared_with_user_id UUID NOT NULL,
    
    -- 権限設定
    permission_level VARCHAR(20) DEFAULT 'read', -- read, write, admin
    can_share BOOLEAN DEFAULT false,
    can_export BOOLEAN DEFAULT false,
    
    -- 制限設定
    expires_at TIMESTAMP WITH TIME ZONE,
    max_chat_sessions INTEGER,
    max_file_uploads INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT project_shares_permission_check CHECK (permission_level IN ('read', 'write', 'admin')),
    CONSTRAINT project_shares_unique_share UNIQUE (project_id, shared_with_user_id)
);

-- ファイルアクセスログテーブル
CREATE TABLE IF NOT EXISTS file_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    action VARCHAR(50) NOT NULL, -- upload, download, view, delete, index
    ip_address INET,
    user_agent TEXT,
    
    -- アクセス詳細
    access_method VARCHAR(50), -- web, api, direct
    referrer_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT file_access_logs_action_check CHECK (action IN ('upload', 'download', 'view', 'delete', 'index', 'share'))
);

-- プロジェクト使用統計テーブル
CREATE TABLE IF NOT EXISTS project_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- 統計期間
    stat_date DATE NOT NULL,
    
    -- 使用量統計
    chat_sessions_created INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    files_uploaded INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    
    -- ストレージ使用量
    storage_bytes_used BIGINT DEFAULT 0,
    
    -- 時間統計
    total_session_time_minutes INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT project_usage_stats_unique_date UNIQUE (project_id, user_id, stat_date)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_project_folders_parent_id ON project_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_user_id ON project_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_created_at ON project_folders(created_at);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_user_id ON project_files(user_id);
CREATE INDEX IF NOT EXISTS idx_project_files_status ON project_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_project_files_type ON project_files(file_type);
CREATE INDEX IF NOT EXISTS idx_project_files_created_at ON project_files(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity ON chat_sessions(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sequence ON chat_messages(chat_session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_with ON project_shares(shared_with_user_id);

CREATE INDEX IF NOT EXISTS idx_file_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_user_id ON file_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_created_at ON file_access_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_project_usage_stats_project_id ON project_usage_stats(project_id);
CREATE INDEX IF NOT EXISTS idx_project_usage_stats_date ON project_usage_stats(stat_date);

-- 全文検索インデックス
CREATE INDEX IF NOT EXISTS idx_project_files_content_search ON project_files USING gin(to_tsvector('japanese', index_content));
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_search ON chat_messages USING gin(to_tsvector('japanese', content));
CREATE INDEX IF NOT EXISTS idx_chat_sessions_title_search ON chat_sessions USING gin(to_tsvector('japanese', title));

-- トリガー関数: 更新日時自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー設定
CREATE TRIGGER update_project_folders_updated_at 
    BEFORE UPDATE ON project_folders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_files_updated_at 
    BEFORE UPDATE ON project_files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- トリガー関数: チャットセッション統計更新
CREATE OR REPLACE FUNCTION update_chat_session_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chat_sessions 
        SET 
            message_count = message_count + 1,
            last_message_content = NEW.content,
            last_message_role = NEW.role,
            last_activity_at = NOW(),
            total_tokens_used = total_tokens_used + COALESCE(NEW.tokens_used, 0)
        WHERE id = NEW.chat_session_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chat_sessions 
        SET 
            message_count = message_count - 1,
            total_tokens_used = total_tokens_used - COALESCE(OLD.tokens_used, 0)
        WHERE id = OLD.chat_session_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- チャットメッセージの統計更新トリガー
CREATE TRIGGER update_chat_session_stats_trigger
    AFTER INSERT OR DELETE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_session_stats();

-- 初期データ挿入（サンプル）
INSERT INTO project_folders (id, name, parent_id, user_id, system_prompt) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'プロジェクト', NULL, '00000000-0000-0000-0000-000000000000', NULL)
ON CONFLICT (id) DO NOTHING;

-- 権限テーブル（Row Level Security有効化）
ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLSポリシー例（実際の実装時に調整）
CREATE POLICY project_folders_user_policy ON project_folders
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY project_files_user_policy ON project_files
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY chat_sessions_user_policy ON chat_sessions
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY chat_messages_user_policy ON chat_messages
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

-- マイグレーション完了ログ
INSERT INTO migrations (name, executed_at) VALUES 
    ('007_create_project_management_tables', NOW())
ON CONFLICT (name) DO UPDATE SET executed_at = NOW();

COMMENT ON TABLE project_folders IS 'プロジェクトフォルダ管理テーブル - 階層構造のプロジェクト管理';
COMMENT ON TABLE project_files IS 'プロジェクトファイルテーブル - アップロードされたファイルの管理';
COMMENT ON TABLE chat_sessions IS 'チャットセッションテーブル - 各プロジェクト内のチャット履歴管理';
COMMENT ON TABLE chat_messages IS 'チャットメッセージテーブル - 個々のメッセージとメタデータ';
COMMENT ON TABLE project_shares IS 'プロジェクト共有テーブル - プロジェクトの共有権限管理';
COMMENT ON TABLE file_access_logs IS 'ファイルアクセスログテーブル - セキュリティと使用量追跡';
COMMENT ON TABLE project_usage_stats IS 'プロジェクト使用統計テーブル - 日次の使用量集計';