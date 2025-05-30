#!/bin/bash
set -e

echo "=== Firebase Deployment 復元スクリプト ==="
echo "現在のstagingapp.conea.aiからファイルをダウンロードして復元します..."

# 復元用ディレクトリの作成
RESTORE_DIR="restored-firebase-deployment"
rm -rf $RESTORE_DIR
mkdir -p $RESTORE_DIR
cd $RESTORE_DIR

# 基本URL
BASE_URL="https://stagingapp.conea.ai"

echo "1. index.htmlをダウンロード..."
curl -s "$BASE_URL/" -o index.html

echo "2. index.htmlからアセットURLを抽出..."
# JavaScriptファイルとCSSファイルのパスを抽出
JS_FILES=$(grep -o 'src="/[^"]*\.js"' index.html | sed 's/src="\/\(.*\)"/\1/' || true)
CSS_FILES=$(grep -o 'href="/[^"]*\.css"' index.html | sed 's/href="\/\(.*\)"/\1/' || true)
FAVICON=$(grep -o 'href="/[^"]*\.svg"' index.html | sed 's/href="\/\(.*\)"/\1/' || true)

# アセットディレクトリの作成
mkdir -p assets

echo "3. JavaScriptファイルをダウンロード..."
for js in $JS_FILES; do
    echo "   - $js"
    mkdir -p "$(dirname "$js")"
    curl -s "$BASE_URL/$js" -o "$js"
done

echo "4. CSSファイルをダウンロード..."
for css in $CSS_FILES; do
    echo "   - $css"
    mkdir -p "$(dirname "$css")"
    curl -s "$BASE_URL/$css" -o "$css"
done

echo "5. faviconをダウンロード..."
if [ ! -z "$FAVICON" ]; then
    echo "   - $FAVICON"
    curl -s "$BASE_URL/$FAVICON" -o "$FAVICON" || echo "   faviconのダウンロードに失敗しました"
fi

echo "6. robots.txtとmanifest.jsonを試行..."
curl -s "$BASE_URL/robots.txt" -o robots.txt || echo "   robots.txtが見つかりませんでした"
curl -s "$BASE_URL/manifest.json" -o manifest.json || echo "   manifest.jsonが見つかりませんでした"

echo "7. CSSファイルから参照される追加アセットを確認..."
# フォントファイルなどの追加アセットを確認
for css in $CSS_FILES; do
    # フォントファイルのURLを抽出
    FONT_URLS=$(grep -o 'url([^)]*\.\(woff2\|woff\|ttf\|eot\))' "$css" 2>/dev/null | sed 's/url(\(.*\))/\1/' || true)
    if [ ! -z "$FONT_URLS" ]; then
        echo "   CSSファイルから参照されるフォントを発見"
        for font_url in $FONT_URLS; do
            # 相対パスを処理
            font_path=${font_url#/}
            font_dir=$(dirname "$font_path")
            mkdir -p "$font_dir"
            echo "   - $font_path"
            curl -s "$BASE_URL/$font_path" -o "$font_path" || echo "     ダウンロード失敗: $font_path"
        done
    fi
done

echo ""
echo "8. ダウンロードしたファイルの一覧:"
find . -type f -name "*" | sort

echo ""
echo "9. ファイルサイズの確認:"
du -sh *

echo ""
echo "=== ダウンロード完了 ==="
echo "復元先: $(pwd)"