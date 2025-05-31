#!/bin/bash
set -e

cd /Users/mourigenta/projects/conea-integration

echo "=== 簡潔な一致確認 ==="

echo "1. stagingapp.conea.aiの現在の状態を確認:"
curl -s https://stagingapp.conea.ai/ | grep -E "(title|assets)" | head -5

echo ""
echo "2. ローカルfrontendの状態:"
cat frontend/dist/index.html | grep -E "(title|assets)" | head -5

echo ""
echo "3. 結論:"
# タイトルとアセットファイル名が完全に一致するか確認
STAGING_HTML=$(curl -s https://stagingapp.conea.ai/)
LOCAL_HTML=$(cat frontend/dist/index.html 2>/dev/null || echo "")

# タイトルの比較
STAGING_TITLE=$(echo "$STAGING_HTML" | grep -o "<title>[^<]*</title>")
LOCAL_TITLE=$(echo "$LOCAL_HTML" | grep -o "<title>[^<]*</title>")

echo "Stagingタイトル: $STAGING_TITLE"
echo "Localタイトル: $LOCAL_TITLE"

if [ "$STAGING_TITLE" = "$LOCAL_TITLE" ]; then
    echo "✅ タイトルが一致"
else
    echo "❌ タイトルが不一致"
fi

# JSファイル名の比較
STAGING_JS=$(echo "$STAGING_HTML" | grep -o 'src="/assets/[^"]*\.js"' | head -1)
LOCAL_JS=$(echo "$LOCAL_HTML" | grep -o 'src="/assets/[^"]*\.js"' | head -1)

echo ""
echo "Staging JS: $STAGING_JS"
echo "Local JS: $LOCAL_JS"

if [ "$STAGING_JS" = "$LOCAL_JS" ]; then
    echo "✅ JSファイル参照が一致"
else
    echo "❌ JSファイル参照が不一致"
fi

# CSSファイル名の比較
STAGING_CSS=$(echo "$STAGING_HTML" | grep -o 'href="/assets/[^"]*\.css"' | head -1)
LOCAL_CSS=$(echo "$LOCAL_HTML" | grep -o 'href="/assets/[^"]*\.css"' | head -1)

echo ""
echo "Staging CSS: $STAGING_CSS"
echo "Local CSS: $LOCAL_CSS"

if [ "$STAGING_CSS" = "$LOCAL_CSS" ]; then
    echo "✅ CSSファイル参照が一致"
else
    echo "❌ CSSファイル参照が不一致"
fi