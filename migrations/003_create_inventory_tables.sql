-- 在庫管理機能のテーブル作成

-- 在庫テーブル
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255),
    sku VARCHAR(255),
    title VARCHAR(500),
    available_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    on_hand_quantity INTEGER NOT NULL DEFAULT 0,
    incoming_quantity INTEGER NOT NULL DEFAULT 0,
    price DECIMAL(12,2),
    currency_code VARCHAR(3),
    weight DECIMAL(12,4),
    weight_unit VARCHAR(10),
    requires_shipping BOOLEAN DEFAULT true,
    tracked BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(variant_id, location_id)
);

-- 在庫履歴テーブル
CREATE TABLE IF NOT EXISTS inventory_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    cost_change DECIMAL(12,2),
    reason TEXT,
    reference_id VARCHAR(255), -- 注文ID、調整ID等
    changed_by VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 在庫アラートテーブル
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255),
    alert_type VARCHAR(50) NOT NULL,
    threshold_type VARCHAR(20) NOT NULL, -- 'quantity' or 'percentage'
    threshold_value INTEGER,
    threshold_percentage DECIMAL(5,2),
    current_value INTEGER,
    notification_channels JSONB,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'active',
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 在庫アラート履歴テーブル
CREATE TABLE IF NOT EXISTS inventory_alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES inventory_alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    alert_value INTEGER,
    notification_sent BOOLEAN DEFAULT false,
    notification_channels JSONB,
    error_message TEXT
);

-- 在庫分析結果テーブル
CREATE TABLE IF NOT EXISTS inventory_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255),
    analysis_date DATE NOT NULL,
    turnover_rate DECIMAL(8,4),
    average_daily_sales DECIMAL(12,2),
    stock_days_remaining INTEGER,
    stockout_risk_score DECIMAL(5,2),
    overstock_score DECIMAL(5,2),
    abc_classification CHAR(1),
    seasonal_factor DECIMAL(5,2),
    reorder_point INTEGER,
    optimal_stock_level INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(variant_id, location_id, analysis_date)
);

-- 在庫調整理由マスタ
CREATE TABLE IF NOT EXISTS inventory_adjustment_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    requires_note BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_inventory_variant_location ON inventory(variant_id, location_id);
CREATE INDEX idx_inventory_last_updated ON inventory(last_updated);
CREATE INDEX idx_inventory_available_quantity ON inventory(available_quantity);
CREATE INDEX idx_inventory_history_inventory_id ON inventory_history(inventory_id);
CREATE INDEX idx_inventory_history_changed_at ON inventory_history(changed_at);
CREATE INDEX idx_inventory_alerts_variant_id ON inventory_alerts(variant_id);
CREATE INDEX idx_inventory_alerts_status ON inventory_alerts(status);
CREATE INDEX idx_inventory_analytics_variant_date ON inventory_analytics(variant_id, analysis_date);

-- トリガー: updated_atの自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_alerts_updated_at BEFORE UPDATE
    ON inventory_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 初期データ: 在庫調整理由
INSERT INTO inventory_adjustment_reasons (code, description, requires_note) VALUES
    ('damage', '商品破損', true),
    ('loss', '紛失', true),
    ('theft', '盗難', true),
    ('return', '返品', false),
    ('correction', '数量訂正', true),
    ('received', '入荷', false),
    ('manual', '手動調整', true),
    ('quality', '品質問題', true),
    ('promotion', 'プロモーション', false),
    ('sample', 'サンプル提供', false);