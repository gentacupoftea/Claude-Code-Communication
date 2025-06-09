# Vertex AI Claude 3.5 Sonnet モデル有効化ガイド

このガイドは、GitHub Actionsで発生している `Publisher Model ... not found` エラーを解決するための手順を説明します。

## 根本原因

このエラーは、IAM権限は正しく設定されているものの、Google CloudプロジェクトでAnthropicのClaude 3.5 Sonnetモデルを利用するためのAPIが有効化されていないために発生している可能性が非常に高いです。

サードパーティのモデルを利用する場合、多くは事前にコンソール上で利用規約への同意とAPIの有効化（サブスクライブ）操作が必要になります。

## 解決手順

以下の手順に従って、Google CloudコンソールからClaude 3.5 Sonnetモデルを有効化してください。

### 1. Vertex AIのモデルガーデンに移動

1.  [Google Cloud Console](https://console.cloud.google.com/) にログインします。
2.  正しいプロジェクト (`claude-code-action-462114`) が選択されていることを確認してください。
3.  左上のナビゲーションメニュー（ハンバーガーメニュー）から、`その他のプロダクト` -> `人工知能` -> `Vertex AI` を選択します。
    -   ![Vertex AI Menu](https://storage.googleapis.com/gcp-claude-images/step1.png)

### 2. Claude 3.5 Sonnet を検索して選択

1.  Vertex AIのダッシュボードに入ったら、左側のメニューから `モデルガーデン` を見つけてクリックします。
2.  モデルガーデンの検索バーで `Claude 3.5 Sonnet` と入力して検索します。
3.  検索結果に表示された `Claude 3.5 Sonnet` のカードをクリックします。
    -   ![Model Garden](https://storage.googleapis.com/gcp-claude-images/step2.png)

### 3. モデルAPIを有効化する

1.  モデルの詳細ページが表示されます。
2.  このページに **`有効にする`** 、 **`ENABLE`** 、 **`利用を開始する`** またはそれに類するボタンがあるはずです。このボタンをクリックしてください。
    -   *(注: すでに有効化されている場合、このボタンは表示されないか、`デプロイ` や `開く` といった表示になっている可能性があります)*
3.  クリックすると、利用規約への同意を求められる場合があります。内容を確認し、同意して次に進んでください。
4.  「APIが正常に有効になりました」といったメッセージが表示されれば、操作は完了です。
    -   ![Enable API](https://storage.googleapis.com/gcp-claude-images/step3.png)

### 4. GitHub Actionsを再実行

モデルの有効化が完了したら、再度、失敗したGitHub Actionsのジョブを**再実行**してください。

今度こそ、APIがモデルを見つけ、正常に処理が実行されるはずです！

---

もし上記手順でうまくいかない場合や、ボタンの表示が異なる場合は、お手数ですがその画面のスクリーンショットを共有いただけますと幸いです。 