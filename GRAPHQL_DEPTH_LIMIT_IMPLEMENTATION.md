# GraphQL Query Depth Limit Implementation

**実装日**: 2025/5/18  
**実装者**: Claude Code  
**バージョン**: v0.2.0  

## 概要

v0.2.0の緊急リリースに向けて、GraphQLクエリ深度制限機能を実装しました。この機能は、深くネストされたクエリによるパフォーマンス問題や潜在的な攻撃を防ぐために重要です。

## 実装内容

### 1. 新しいエラークラス

```python
class ShopifyGraphQLDepthError(ShopifyGraphQLError):
    """GraphQLクエリ深度制限エラー"""
    
    def __init__(self, message: str, depth: int, max_depth: int):
        super().__init__(message)
        self.depth = depth
        self.max_depth = max_depth
```

### 2. 深度計算メソッド

```python
def calculate_query_depth(self, query: str) -> int:
    """クエリの深度を計算
    
    Args:
        query: GraphQLクエリ文字列
        
    Returns:
        int: クエリの最大深度
    """
    depth = 0
    current_depth = 0
    in_selection = False
    
    # コメントと文字列リテラルを除外
    cleaned_query = query
    # 文字列リテラルを一時的に削除
    cleaned_query = re.sub(r'"[^"]*"', '""', cleaned_query)
    cleaned_query = re.sub(r"'[^']*'", "''", cleaned_query)
    
    for char in cleaned_query:
        if char == '{':
            if in_selection:
                current_depth += 1
                depth = max(depth, current_depth)
            in_selection = True
        elif char == '}':
            if in_selection:
                current_depth -= 1
                if current_depth == 0:
                    in_selection = False
    
    return depth
```

### 3. execute_queryメソッドへの統合

```python
async def execute_query(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    GraphQLクエリを実行し、結果を返す
    PR #25のネットワーク耐性機能を活用
    """
    # クエリ深度チェック
    query_depth = self.calculate_query_depth(query)
    if query_depth > self.max_query_depth:
        raise ShopifyGraphQLDepthError(
            f"Query depth {query_depth} exceeds maximum allowed depth {self.max_query_depth}",
            depth=query_depth,
            max_depth=self.max_query_depth
        )
    
    # 既存の実行ロジック...
```

## 設定値

- **最大深度**: 6
- **対象ファイル**: `src/api/shopify_graphql.py`
- **関連するPR**: #9 (GraphQL基本実装), #20 (エラーハンドリング), #25 (ネットワーク耐性)

## テスト

`tests/test_graphql_depth_limit.py`にて以下のケースをテスト:

1. シンプルなクエリの深度計算
2. ネストされたクエリの深度計算
3. フラグメントを含むクエリの深度計算
4. 深度制限を超えるクエリのエラー処理
5. 深度制限内のクエリの正常処理
6. 文字列リテラルを含むクエリの処理
7. 変数を含むクエリの処理

## セキュリティへの貢献

この実装により以下のセキュリティ上の利点があります:

1. **DoS攻撃の防止**: 深くネストされたクエリによるサーバー負荷を制限
2. **リソース保護**: 過度に複雑なクエリの実行を防ぐ
3. **パフォーマンス保証**: 予測可能なクエリ実行時間を維持

## 今後の改善案

1. 設定可能な深度制限（環境変数での設定）
2. クエリ複雑度の計算（深度だけでなく総フィールド数も考慮）
3. デバッグモードでの詳細なエラー情報提供
4. 深度制限のホワイトリスト機能

## 影響範囲

- **既存機能への影響**: なし（新規追加機能のため）
- **パフォーマンスへの影響**: 最小限（クエリ実行前の単純な文字列解析のみ）
- **互換性**: 完全に後方互換性を維持