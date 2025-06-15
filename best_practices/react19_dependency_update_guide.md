# React 19 依存関係更新ガイド

## 1. はじめに
このドキュメントは、既存のプロジェクトをReact 19へアップデートする際の、依存関係の更新手順、注意点、および検証プロセスについてまとめたガイドです。

## 2. 背景
React 19では、Concurrent Featuresの正式導入や新しいAPIの追加など、多くの変更が含まれています。これに伴い、Reactに依存する多くのライブラリ（特にテスト関連ライブラリ）もアップデートが必要となります。
安全かつ効率的にアップデート作業を進めるために、本ガイドの手順に従うことを推奨します。

## 3. アップデート戦略
アップデート作業は、以下の3段階のフェーズで進めます。

### フェーズ1: 解析と計画
- **目的**: 現状の依存関係を把握し、React 19との互換性問題を特定する。
- **タスク**:
  - [ ] `package.json` に記載されている全依存関係をリストアップする。
  - [ ] 各ライブラリ（特に `@testing-library/*`, `jest`, `eslint-plugin-react`など）の公式ドキュメントやGitHubリポジトリで、React 19への対応状況を確認する。
  - [ ] `@types/react` と `@types/react-dom` を `^19.0.0` に更新する計画を立てる。
  - [ ] アップデートが必要なパッケージとそのターゲットバージョンをリスト化する。

### フェーズ2: 依存関係の更新と修正
- **目的**: 計画に基づき、`package.json`を更新し、関連するコードや設定ファイルを修正する。
- **タスク**:
  - [ ] **`package.json`の更新**:
    - [ ] `react`と`react-dom`を`^19.0.0`に更新する。
    - [ ] フェーズ1でリストアップした関連ライブラリを、React 19対応バージョンに更新する。
    - [ ] `react-test-renderer` を`^19.0.0`に更新または追加する。
    - [ ] 不要になったパッケージ（例: `react-test-renderer`に依存していた古いライブラリなど）を削除する。
  - [ ] **設定ファイルの修正**:
    - [ ] `jest.config.js` を更新し、`testEnvironment` や `transform` の設定がReact 19に対応していることを確認する。React 19の新しいJSXトランスフォームに対応させる必要がある場合があります。
  - [ ] **コードの修正**:
    - [ ] React 19の破壊的変更（例: `ref`の扱いなど）に影響されるコンポーネントを修正する。
    - [ ] テストコードで、`@testing-library/react`の新しいAPIに対応するための修正を行う。

### フェーズ3: 検証
- **目的**: アップデート後もアプリケーションが正常に動作することを保証する。
- **タスク**:
  - [ ] `npm install` (または `yarn install`) が正常に完了することを確認する。
  - [ ] `npm run build` (または `yarn build`) が成功することを確認する。
  - [ ] 全ての単体テスト、結合テスト、E2Eテストを実行し、パスすることを確認する。
  - [ ] 開発サーバーを起動し、主要な画面や機能が手動テストで問題なく動作することを確認する。

## 4. `package.json` 修正例
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.0", // React 19対応バージョン
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react-test-renderer": "^19.0.0"
  }
}
```
*注意: バージョン番号はあくまで一例です。必ず各ライブラリの最新の推奨バージョンを確認してください。*

## 5. `jest.config.js` 修正例
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // React 19のJSX Transformに対応するための設定例
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }]
  },
  // 必要に応じて追加する設定
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
};
```

## 6. 安全なアップデートのための推奨事項
- **作業ブランチの作成**: アップデート作業は必ず新しいブランチ（例: `feature/react-19-update`）を作成して行う。
- **段階的なコミット**: 「依存関係の更新」「設定ファイルの修正」「コードの修正」など、意味のある単位でコミットを分け、問題が発生した際に原因を特定しやすくする。
- **CIでの検証**: 修正をプッシュし、CIパイプラインが正常に完了することを確認する。
- **チームでのレビュー**: `package.json`や設定ファイルの変更は、チームメンバーにレビューを依頼し、潜在的な問題がないか確認する。