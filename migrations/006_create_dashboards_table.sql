-- ダッシュボード保存・管理・共有機能のためのテーブル作成
-- Migration 006: Create Dashboards Table

-- ダッシュボードメインテーブル
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL, -- ダッシュボードの設定情報（レイアウト、ウィジェット等）
    thumbnail_url VARCHAR(500), -- プレビュー画像のURL
    tags TEXT[] DEFAULT '{}', -- タグ配列（売上分析、在庫管理、顧客分析等）
    visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'limited')),
    share_token UUID UNIQUE, -- 共有用のユニークトークン
    share_expires_at TIMESTAMP WITH TIME ZONE, -- 共有リンクの有効期限
    password_hash VARCHAR(255), -- パスワード保護用（オプション）
    access_count INTEGER DEFAULT 0, -- アクセス数
    unique_visitors INTEGER DEFAULT 0, -- ユニークビジター数
    created_by UUID NOT NULL, -- 作成者のユーザーID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    is_template BOOLEAN DEFAULT FALSE, -- テンプレートフラグ
    template_category VARCHAR(100), -- テンプレートカテゴリ（EC、小売、製造等）
    version INTEGER DEFAULT 1 -- バージョン番号
);

-- ダッシュボードバージョン管理テーブル
CREATE TABLE IF NOT EXISTS dashboard_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    config JSONB NOT NULL, -- その時点での設定情報
    change_description TEXT, -- 変更内容の説明
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dashboard_id, version_number)
);

-- ダッシュボード共有権限テーブル
CREATE TABLE IF NOT EXISTS dashboard_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    user_id UUID, -- NULL の場合は匿名アクセス
    permission_type VARCHAR(20) NOT NULL CHECK (permission_type IN ('view', 'edit', 'admin')),
    granted_by UUID NOT NULL, -- 権限を付与したユーザー
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE, -- 権限の有効期限
    UNIQUE(dashboard_id, user_id)
);

-- ダッシュボードアクセスログテーブル
CREATE TABLE IF NOT EXISTS dashboard_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    user_id UUID, -- NULL の場合は匿名アクセス
    ip_address INET,
    user_agent TEXT,
    referer TEXT,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('view', 'edit', 'share')),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ダッシュボードお気に入りテーブル
CREATE TABLE IF NOT EXISTS dashboard_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    favorited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dashboard_id, user_id)
);

-- ダッシュボードコメントテーブル（コラボレーション機能用）
CREATE TABLE IF NOT EXISTS dashboard_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    comment TEXT NOT NULL,
    position_x FLOAT, -- コメントの位置（X座標）
    position_y FLOAT, -- コメントの位置（Y座標）
    widget_id VARCHAR(100), -- 特定のウィジェットへのコメントの場合
    parent_comment_id UUID REFERENCES dashboard_comments(id), -- 返信コメントの場合
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT FALSE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboards_visibility ON dashboards(visibility);
CREATE INDEX IF NOT EXISTS idx_dashboards_share_token ON dashboards(share_token);
CREATE INDEX IF NOT EXISTS idx_dashboards_tags ON dashboards USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_at ON dashboards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboards_is_template ON dashboards(is_template);

CREATE INDEX IF NOT EXISTS idx_dashboard_versions_dashboard_id ON dashboard_versions(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_versions_version ON dashboard_versions(dashboard_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_dashboard_id ON dashboard_permissions(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_user_id ON dashboard_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_access_logs_dashboard_id ON dashboard_access_logs(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_logs_accessed_at ON dashboard_access_logs(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_favorites_user_id ON dashboard_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_favorites_dashboard_id ON dashboard_favorites(dashboard_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_comments_dashboard_id ON dashboard_comments(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_comments_user_id ON dashboard_comments(user_id);

-- トリガー関数：updated_at自動更新
CREATE OR REPLACE FUNCTION update_dashboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー作成
CREATE TRIGGER update_dashboards_updated_at
    BEFORE UPDATE ON dashboards
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_updated_at();

CREATE TRIGGER update_dashboard_comments_updated_at
    BEFORE UPDATE ON dashboard_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_updated_at();

-- デフォルトテンプレートの挿入
INSERT INTO dashboards (name, description, config, tags, visibility, is_template, template_category, created_by)
VALUES 
    ('売上分析ダッシュボード', 'ECサイト向けの基本的な売上分析テンプレート', 
     '{"layout": [{"i": "sales-chart", "x": 0, "y": 0, "w": 6, "h": 4}], "widgets": [{"id": "sales-chart", "type": "line-chart", "title": "売上推移", "config": {"dataSource": "sales", "timeRange": "30d"}}]}',
     ARRAY['売上分析', 'EC', 'テンプレート'], 'public', true, 'EC',
     '00000000-0000-0000-0000-000000000000'),
    
    ('在庫管理ダッシュボード', '在庫状況を監視するためのテンプレート',
     '{"layout": [{"i": "inventory-table", "x": 0, "y": 0, "w": 12, "h": 6}], "widgets": [{"id": "inventory-table", "type": "data-table", "title": "在庫一覧", "config": {"dataSource": "inventory", "columns": ["product_name", "stock_quantity", "last_updated"]}}]}',
     ARRAY['在庫管理', '小売', 'テンプレート'], 'public', true, '小売',
     '00000000-0000-0000-0000-000000000000'),
    
    ('顧客分析ダッシュボード', '顧客データの分析と可視化テンプレート',
     '{"layout": [{"i": "customer-kpi", "x": 0, "y": 0, "w": 3, "h": 2}, {"i": "customer-chart", "x": 3, "y": 0, "w": 9, "h": 4}], "widgets": [{"id": "customer-kpi", "type": "kpi", "title": "総顧客数", "config": {"dataSource": "customers", "metric": "count"}}, {"id": "customer-chart", "type": "bar-chart", "title": "顧客属性分析", "config": {"dataSource": "customer-demographics"}}]}',
     ARRAY['顧客分析', 'CRM', 'テンプレート'], 'public', true, 'CRM',
     '00000000-0000-0000-0000-000000000000');

COMMENT ON TABLE dashboards IS 'ダッシュボードのメタデータと設定を保存するテーブル';
COMMENT ON TABLE dashboard_versions IS 'ダッシュボードのバージョン履歴を管理するテーブル';
COMMENT ON TABLE dashboard_permissions IS 'ダッシュボードの共有権限を管理するテーブル';
COMMENT ON TABLE dashboard_access_logs IS 'ダッシュボードへのアクセスログを記録するテーブル';
COMMENT ON TABLE dashboard_favorites IS 'ユーザーのお気に入りダッシュボードを管理するテーブル';
COMMENT ON TABLE dashboard_comments IS 'ダッシュボードへのコメント（コラボレーション機能）を管理するテーブル';