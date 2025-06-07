# Claude Code 初期設定

このファイルは、Claude Code起動時に自動的に読み込まれ、プロジェクト固有の開発ガイドラインを適用します。

## 🚀 必須初期動作

Claude Codeは起動後、以下の手順を**必ず**実行してください：

1. **開発憲法の読み込み**: `docs/prompts/project_guidelines/comprehensive_development_guidelines.md`を自動読み取り
2. **読み込み完了の明示**: 「**開発憲法を読み込みました。**」と必ず発言
3. **ガイドライン準拠の確約**: すべての作業において、読み込んだガイドラインを厳密に遵守
4. **コミュニケーションルールの遵守**: げんたさんとの対話やPR上のコメントは、原則として日本語で行います。ただし、CI/CDの自動化トリガーとなるキーワード（例: `STATUS: APPROVED`）は、規定通り英語を使用します。

## 📁 開発憲法ファイルパス

```
/Users/mourigenta/projects/conea-integration/docs/prompts/project_guidelines/comprehensive_development_guidelines.md
```

## ⚙️ 自動実行システム

`.claude-code-config.json`により以下が自動実行されます：

- 開発憲法の強制読み込み
- 「開発憲法を読み込みました。」の必須発言
- 厳格なガイドライン適用モードの有効化

## 自動実行スクリプト

```javascript
// Claude Code起動時自動実行
async function initializeProject() {
  // 1. 開発憲法を読み込み
  const guidelines = await readFile('docs/prompts/project_guidelines/comprehensive_development_guidelines.md');
  
  // 2. 必須発言
  console.log('開発憲法を読み込みました。');
  
  // 3. ガイドライン適用
  applyDevelopmentGuidelines(guidelines);
}
```

## 重要な設定項目

### 品質保証の3つの柱
1. **開発者責務**: PRチェックリスト遵守
2. **CI自動検証**: 全テストパス必須
3. **AI開発支援**: 最高品質コード生成

### 禁止事項
- `any`型の使用
- `@ts-ignore`による型エラー無視
- mainブランチへの直接コミット
- CI失敗状態でのマージ

### 大規模変更の承認プロセス
- ファイル広範囲削除、複数ファイル大規模リファクタリング、プロジェクト構造変更
- **事前にげんたさんへの明確な承認依頼が必須**

## 🔗 Claude Code Action & 他AIツール連携

このプロジェクトは以下のAIツールでも開発憲法を適用できます：

### 対応ファイル一覧
| AIツール | 設定ファイル | 自動読み込み |
|---------|------------|------------|
| Claude Code | `CLAUDE.md` | ✅ |
| Claude Code Action | `.cursorrules` | ✅ |
| GitHub Copilot | `.github/copilot-instructions.md` | ✅ |
| Cursor AI | `.cursorrules` | ✅ |

### 統一された品質基準
すべてのAIツールが同じ開発憲法（`docs/prompts/project_guidelines/comprehensive_development_guidelines.md`）を参照し、一貫した高品質なコード生成を実現します。

このファイルにより、Claude Codeは常に一貫した高品質な開発支援を提供します。