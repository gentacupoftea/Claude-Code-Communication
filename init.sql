-- Initialize Conea database

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables for future features
CREATE TABLE IF NOT EXISTS query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    provider VARCHAR(50) NOT NULL,
    response_time INTEGER NOT NULL,
    token_count INTEGER,
    quality_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_log_id UUID REFERENCES query_logs(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_query_logs_provider ON query_logs(provider);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);

-- Insert sample data (optional)
INSERT INTO query_logs (question, provider, response_time, token_count, quality_score)
VALUES 
    ('サンプル質問', 'claude', 1500, 250, 0.85),
    ('テスト質問', 'gpt-4', 2000, 300, 0.90)
ON CONFLICT DO NOTHING;