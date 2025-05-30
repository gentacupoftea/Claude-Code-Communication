#!/bin/bash

# Conea MultiLLM デプロイスクリプト

set -e

echo "🚀 Conea MultiLLM System Deployment"
echo "===================================="

# 環境設定の確認
check_requirements() {
    echo "📋 前提条件をチェック中..."
    
    # Docker のチェック
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker がインストールされていません"
        exit 1
    fi
    
    # Docker Compose のチェック
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose がインストールされていません"
        exit 1
    fi
    
    echo "✅ 前提条件OK"
}

# 環境変数の設定
setup_environment() {
    echo "🔧 環境設定中..."
    
    if [ ! -f .env ]; then
        echo "📝 .env ファイルを作成中..."
        cp .env.example .env
        
        echo ""
        echo "⚠️  重要: .env ファイルを編集して以下を設定してください:"
        echo "   - ANTHROPIC_API_KEY"
        echo "   - OPENAI_API_KEY"
        echo "   - GOOGLE_CLOUD_PROJECT_ID (Gemini用)"
        echo "   - JWT_SECRET"
        echo "   - DATABASE_PASSWORD"
        echo ""
        read -p "設定が完了したら Enter を押してください..."
    fi
    
    # SSL証明書ディレクトリの作成
    if [ ! -d "ssl" ]; then
        echo "🔐 SSL証明書ディレクトリを作成中..."
        mkdir -p ssl
        
        # 自己署名証明書の作成（開発用）
        if [ "$1" = "dev" ]; then
            echo "📜 開発用SSL証明書を作成中..."
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout ssl/key.pem \
                -out ssl/cert.pem \
                -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Conea/CN=localhost"
        else
            echo "⚠️  本番環境では有効なSSL証明書を ssl/ ディレクトリに配置してください"
            echo "   - ssl/cert.pem"
            echo "   - ssl/key.pem"
        fi
    fi
}

# Docker イメージのビルド
build_images() {
    echo "🔨 Docker イメージをビルド中..."
    docker-compose build --no-cache
}

# サービスの起動
start_services() {
    echo "🚀 サービスを起動中..."
    
    # データベースとRedisを先に起動
    docker-compose up -d postgres redis
    
    echo "⏳ データベースの起動を待機中..."
    sleep 10
    
    # メインアプリケーションを起動
    docker-compose up -d conea-multillm
    
    echo "⏳ アプリケーションの起動を待機中..."
    sleep 15
    
    # Nginx、Prometheus、Grafanaを起動
    docker-compose up -d nginx prometheus grafana
    
    echo "⏳ 全サービスの起動を待機中..."
    sleep 20
}

# ヘルスチェック
health_check() {
    echo "🩺 ヘルスチェック実行中..."
    
    # アプリケーションのヘルスチェック
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ アプリケーション: 正常"
    else
        echo "❌ アプリケーション: 異常"
        return 1
    fi
    
    # データベースのチェック
    if docker-compose exec -T postgres pg_isready -U conea -d conea > /dev/null 2>&1; then
        echo "✅ データベース: 正常"
    else
        echo "❌ データベース: 異常"
        return 1
    fi
    
    # Redisのチェック
    if docker-compose exec -T redis redis-cli ping | grep -q PONG; then
        echo "✅ Redis: 正常"
    else
        echo "❌ Redis: 異常"
        return 1
    fi
}

# 使用方法の表示
show_usage() {
    echo ""
    echo "📖 使用方法:"
    echo "  ./deploy.sh [dev|prod|stop|restart|logs|status]"
    echo ""
    echo "コマンド:"
    echo "  dev      - 開発環境でデプロイ"
    echo "  prod     - 本番環境でデプロイ"
    echo "  stop     - 全サービス停止"
    echo "  restart  - 全サービス再起動"
    echo "  logs     - ログ表示"
    echo "  status   - サービス状態確認"
    echo ""
}

# サービス停止
stop_services() {
    echo "🛑 サービスを停止中..."
    docker-compose down
}

# サービス再起動
restart_services() {
    echo "🔄 サービスを再起動中..."
    docker-compose restart
}

# ログ表示
show_logs() {
    echo "📋 ログを表示中..."
    docker-compose logs -f
}

# ステータス確認
show_status() {
    echo "📊 サービス状態:"
    docker-compose ps
    echo ""
    echo "🌐 アクセスURL:"
    echo "  - API: https://localhost/api/status"
    echo "  - Health: https://localhost/health"
    echo "  - Grafana: http://localhost:3001 (admin/admin123)"
    echo "  - Prometheus: http://localhost:9090"
}

# メイン処理
main() {
    case "${1:-}" in
        "dev")
            check_requirements
            setup_environment dev
            build_images
            start_services
            if health_check; then
                echo ""
                echo "🎉 開発環境のデプロイが完了しました！"
                show_status
            else
                echo "❌ デプロイに失敗しました"
                exit 1
            fi
            ;;
        "prod")
            check_requirements
            setup_environment prod
            build_images
            start_services
            if health_check; then
                echo ""
                echo "🎉 本番環境のデプロイが完了しました！"
                show_status
            else
                echo "❌ デプロイに失敗しました"
                exit 1
            fi
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "logs")
            show_logs
            ;;
        "status")
            show_status
            ;;
        *)
            show_usage
            ;;
    esac
}

main "$@"