#!/bin/bash
cd /Users/mourigenta/projects/conea-integration

echo "=== 現在の状態確認 ==="
echo "frontend-v2の存在確認:"
ls -la | grep frontend-v2

echo -e "\n=== frontend-v2-broken-backupから復元 ==="
if [ -d "frontend-v2-broken-backup" ] && [ ! -d "frontend-v2" ]; then
    echo "frontend-v2-broken-backupをfrontend-v2にコピーします..."
    cp -r frontend-v2-broken-backup frontend-v2
    echo "コピー完了"
    
    # 確認
    if [ -d "frontend-v2" ]; then
        echo "frontend-v2が正常に作成されました"
        
        # package.jsonの確認と修正
        if [ -f "frontend-v2/package.json" ]; then
            echo -e "\n=== package.jsonの確認 ==="
            cat frontend-v2/package.json | grep '"name"'
            
            # 名前を"conea"に変更
            echo -e "\n名前を'conea'に変更します..."
            sed -i.bak 's/"name": ".*"/"name": "conea"/' frontend-v2/package.json
            
            echo "変更後の名前:"
            cat frontend-v2/package.json | grep '"name"'
        fi
        
        echo -e "\n=== frontend-v2の内容 ==="
        ls -la frontend-v2/
        
        echo -e "\n=== srcディレクトリの構造 ==="
        tree -L 3 frontend-v2/src/ 2>/dev/null || find frontend-v2/src -type d | head -20
        
        echo -e "\n=== 復元完了 ==="
        echo "次のステップ:"
        echo "1. cd frontend-v2"
        echo "2. npm install"
        echo "3. npm run dev"
    else
        echo "ERROR: frontend-v2の作成に失敗しました"
    fi
else
    if [ -d "frontend-v2" ]; then
        echo "frontend-v2は既に存在します"
        ls -la frontend-v2/
    else
        echo "ERROR: frontend-v2-broken-backupが見つかりません"
    fi
fi

echo -e "\n=== 最終確認 ==="
ls -la | grep frontend-v2