# TypeScript Undefined修正パターン

## パターン1: Optional Chaining

### 問題コード
```typescript
src/utils/resourceMonitor.ts(331,45): error TS18048: 'n1' is possibly 'undefined'.
```

### 解決策
```typescript
// Before
const value = n1.someProperty;

// After
const value = n1?.someProperty;
```

## パターン2: Nullish Coalescing

### 問題コード
```typescript
src/utils/resourceMonitor.ts(373,7): error TS2322: Type 'MemoryUsageReport | undefined' is not assignable to type 'MemoryUsageReport'.
```

### 解決策
```typescript
// Before
const report: MemoryUsageReport = getReport();

// After
const report: MemoryUsageReport = getReport() ?? {
  totalMemory: 0,
  usedMemory: 0,
  freeMemory: 0,
  timestamp: Date.now()
};
```

## パターン3: Type Guard

### 解決策
```typescript
function isMemoryUsageReport(obj: any): obj is MemoryUsageReport {
  return obj && 
    typeof obj.totalMemory === 'number' &&
    typeof obj.usedMemory === 'number' &&
    typeof obj.freeMemory === 'number' &&
    typeof obj.timestamp === 'number';
}

// 使用例
const maybeReport = getReport();
if (isMemoryUsageReport(maybeReport)) {
  // maybeReportは確実にMemoryUsageReport型
  const report: MemoryUsageReport = maybeReport;
}
```

## 自動修正スクリプト

```typescript
import { Project } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: './tsconfig.json'
});

// resourceMonitor.tsの修正
const sourceFile = project.getSourceFileOrThrow('src/utils/resourceMonitor.ts');

// すべてのプロパティアクセスをOptional Chainingに変換
sourceFile.forEachDescendant(node => {
  if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
    const expr = node.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    const type = expr.getExpression().getType();
    
    if (type.isNullable()) {
      const newText = `${expr.getExpression().getText()}?.${expr.getName()}`;
      node.replaceWithText(newText);
    }
  }
});

await sourceFile.save();
```

このパターンにより、TypeScriptのundefinedエラーを効率的に解決できます。