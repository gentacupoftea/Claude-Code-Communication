#!/bin/bash
set -e

cd /Users/mourigenta/projects/conea-integration

echo "=== stagingapp.conea.ai からの直接復元作業 ==="

# 復元用ディレクトリの準備
echo "1. 復元用ディレクトリを作成..."
mkdir -p restored-from-firebase-12ed7a
cd restored-from-firebase-12ed7a

# curl でサイトの基本情報を取得
echo "2. サイトの基本情報を確認..."
curl -s https://stagingapp.conea.ai > index.html

# index.html の内容を確認してビルドハッシュを探す
echo "3. index.html からビルドファイルの情報を抽出..."
echo "=== index.html の内容（最初の100行）==="
head -100 index.html

# JavaScript と CSS ファイルのURLを抽出
echo ""
echo "4. リンクされているアセットファイルを検索..."
grep -oE 'src="[^"]+\.js"' index.html | sed 's/src="//;s/"//' > js-files.txt || true
grep -oE 'href="[^"]+\.css"' index.html | sed 's/href="//;s/"//' > css-files.txt || true

echo "見つかったJSファイル:"
cat js-files.txt

echo ""
echo "見つかったCSSファイル:"
cat css-files.txt

# アセットファイルをダウンロード
echo ""
echo "5. アセットファイルのダウンロード..."
mkdir -p assets/js assets/css

# JSファイルのダウンロード
while IFS= read -r jsfile; do
    if [[ ! -z "$jsfile" ]]; then
        # 相対パスの処理
        if [[ "$jsfile" == /* ]]; then
            url="https://stagingapp.conea.ai$jsfile"
        else
            url="https://stagingapp.conea.ai/$jsfile"
        fi
        echo "ダウンロード中: $url"
        curl -s -o "assets/js/$(basename $jsfile)" "$url" || true
    fi
done < js-files.txt

# CSSファイルのダウンロード
while IFS= read -r cssfile; do
    if [[ ! -z "$cssfile" ]]; then
        # 相対パスの処理
        if [[ "$cssfile" == /* ]]; then
            url="https://stagingapp.conea.ai$cssfile"
        else
            url="https://stagingapp.conea.ai/$cssfile"
        fi
        echo "ダウンロード中: $url"
        curl -s -o "assets/css/$(basename $cssfile)" "$url" || true
    fi
done < css-files.txt

# ダウンロードしたファイルの確認
echo ""
echo "6. ダウンロードしたファイル一覧:"
find assets -type f -ls

# manifest.json があるか確認
echo ""
echo "7. manifest.json を取得..."
curl -s https://stagingapp.conea.ai/manifest.json -o manifest.json || echo "manifest.json not found"

# _app や他の Next.js 関連ファイルを探す
echo ""
echo "8. Next.js ビルドファイルを探索..."
# _next ディレクトリの存在を確認
curl -s -I https://stagingapp.conea.ai/_next/static/ || true

# package.json の情報があるか確認（通常は公開されない）
echo ""
echo "9. ビルド情報を探索..."
# ソースマップがあるか確認
find assets -name "*.map" -type f || echo "ソースマップは見つかりませんでした"

# ビルドタイムスタンプやバージョン情報を探す
echo ""
echo "10. ビルドメタデータを検索..."
grep -r "12ed7a" . || echo "ハッシュ 12ed7a は見つかりませんでした"

# 結果のサマリー
echo ""
echo "=== 復元作業サマリー ==="
echo "復元先: $(pwd)"
echo "ダウンロードしたファイル数:"
echo "- HTML: 1"
echo "- JS: $(find assets/js -name "*.js" 2>/dev/null | wc -l)"
echo "- CSS: $(find assets/css -name "*.css" 2>/dev/null | wc -l)"

# ビルドされたReactアプリの構造を解析
echo ""
echo "11. Reactアプリの構造を解析..."
if [ -f "assets/js/main.*.js" ] || [ -f "assets/js/index.*.js" ]; then
    echo "ビルドされたReactアプリを検出しました"
    # 主要なJSファイルの先頭を確認
    for jsfile in assets/js/*.js; do
        echo "=== $(basename $jsfile) の先頭 ==="
        head -5 "$jsfile" | sed 's/;/;\n/g' | head -10
        echo ""
    done
fi

echo ""
echo "復元作業の第一段階が完了しました。"
echo "次のステップ: ビルドされたファイルから元のソースコード構造を推測して再構築します。"