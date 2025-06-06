# GitHub Copilot & Claude Code Action 開発憲法

このファイルは、GitHub CopilotおよびClaude Code Actionに対する開発ガイドラインです。

## 📜 開発憲法の参照

**必須**: 以下のファイルの内容を厳密に遵守してください：
- `docs/prompts/project_guidelines/comprehensive_development_guidelines.md`

## 🎯 コード生成の基本原則

### 1. 型安全性の絶対遵守
```typescript
// ❌ 絶対に生成してはいけないコード
function processData(data: any): any {
  // @ts-ignore
  return data.someProperty;
}

// ✅ 必ず生成すべきコード
interface ProcessedData {
  id: string;
  result: number;
}

function processData(data: InputData): ProcessedData {
  return {
    id: data.id,
    result: calculateResult(data)
  };
}
```

### 2. エラーハンドリングの徹底
```typescript
// ✅ 適切なエラーハンドリング
try {
  const result = await apiCall();
  return result;
} catch (error) {
  if (error instanceof ApiError) {
    logger.error('API Error:', error.message);
    throw new CustomError('API call failed', error);
  }
  throw error;
}
```

### 3. テスト可能なコード設計
- 依存性注入を活用
- モックしやすい構造
- 単一責任の原則を遵守

## 🚫 コード生成時の禁止事項

1. **型の曖昧化**
   - `any`型の使用
   - `@ts-ignore`の使用
   - 型アサーション（`as`）の濫用

2. **不適切なブランチ操作**
   - mainブランチへの直接変更提案
   - CI未通過コードの生成

3. **セキュリティリスク**
   - ハードコードされた認証情報
   - SQLインジェクション脆弱性
   - XSS脆弱性

## ✅ 推奨パターン

### コンポーネント設計
```typescript
// 機能別に分離された、テスタブルなコンポーネント
export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const handleSubmit = useCallback(async (data: UserData) => {
    try {
      await onUpdate(data);
      setIsEditing(false);
    } catch (error) {
      handleError(error);
    }
  }, [onUpdate]);

  return (
    // JSX実装
  );
};
```

### API通信
```typescript
// 型安全で再利用可能なAPI関数
export async function fetchUserData(userId: string): Promise<User> {
  const response = await apiClient.get<User>(`/users/${userId}`);
  
  if (!response.ok) {
    throw new ApiError('Failed to fetch user data', response.status);
  }
  
  return response.data;
}
```

## 🔧 統合開発環境設定

### VS Code / Cursor設定
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.strict": true,
  "eslint.enable": true,
  "eslint.autoFixOnSave": true
}
```

## 📊 品質メトリクス

生成されたコードは以下を満たす必要があります：
- TypeScriptコンパイルエラー: 0
- ESLintエラー: 0
- テストカバレッジ: 80%以上
- 循環的複雑度: 10以下

このガイドラインに従うことで、Claude Code Actionは常に高品質で保守性の高いコードを生成します。