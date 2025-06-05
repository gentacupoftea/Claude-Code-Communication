# useSidebar.ts 型修正実装計画

## 修正対象箇所と具体的な変更内容

### 1. Import文の修正
```typescript
// 変更前
// import { SidebarState, SidebarActions, SidebarProject, SidebarFolder } from '@/src/types/sidebar';
import { ProjectFolder, SidebarItem, SidebarSection } from '@/src/types/sidebar';

// 変更後
import { ProjectFolder, SidebarItem, SidebarSection } from '@/src/types/sidebar';
import { 
  SidebarState, 
  SidebarActions, 
  SidebarFolder, 
  SidebarSectionState,
  UseSidebarReturn 
} from '@/src/types/sidebar-hook';
```

### 2. initialStateの型付け
```typescript
// 変更前
const initialState: any = {

// 変更後
const initialState: SidebarState = {
```

### 3. sampleProjectsの型付け
```typescript
// 変更前
const sampleProjects: any[] = [

// 変更後
const sampleProjects: ProjectFolder[] = [
```

### 4. useSidebarフックの戻り値型
```typescript
// 変更前
export function useSidebar(): any {

// 変更後
export function useSidebar(): UseSidebarReturn {
```

### 5. useStateの型付け
```typescript
// 変更前
const [state, setState] = useState<any>(() => {

// 変更後
const [state, setState] = useState<SidebarState>(() => {
```

### 6. コールバック関数内のパラメータ型付け

#### toggleSidebar
```typescript
// 変更前
setState((prev: any) => ({ ...prev, isCollapsed: !prev.isCollapsed }));

// 変更後
setState((prev: SidebarState) => ({ ...prev, isCollapsed: !prev.isCollapsed }));
```

#### toggleSection
```typescript
// 変更前
setState((prev: any) => ({
  ...prev,
  sections: prev.sections.map((section: any) =>

// 変更後
setState((prev: SidebarState) => ({
  ...prev,
  sections: prev.sections.map((section: SidebarSectionState) =>
```

#### toggleFolder
```typescript
// 変更前
folders: section.folders.map((folder: any) =>

// 変更後
folders: section.folders.map((folder: SidebarFolder) =>
```

#### その他のコールバック
同様のパターンで、以下の型を適用：
- `prev`: `SidebarState`
- `section`: `SidebarSectionState`
- `folder`: `SidebarFolder`
- `p` (project): `ProjectFolder`
- `s` (section略): `SidebarSectionState`
- `f` (folder略): `SidebarFolder`

### 7. createFolderの修正
```typescript
// 変更前
const newFolder: any = {

// 変更後
const newFolder: SidebarFolder = {
```

## 段階的実装計画

### Phase 1: 型定義ファイルの作成とレビュー（完了）
- [x] `src/types/sidebar-hook.ts`の作成
- [ ] 型定義のレビューと調整

### Phase 2: 基本的な型の適用
- [ ] import文の修正
- [ ] initialStateとsampleProjectsの型付け
- [ ] useSidebarフックの戻り値型の設定

### Phase 3: コールバック関数の型付け
- [ ] setState関数のパラメータ型付け
- [ ] map関数内のパラメータ型付け
- [ ] その他のヘルパー関数の型付け

### Phase 4: テストと調整
- [ ] TypeScriptコンパイルエラーの確認
- [ ] 関連コンポーネントへの影響確認
- [ ] 必要に応じて型定義の調整

## 影響を受ける可能性のあるファイル

1. **サイドバーを使用するコンポーネント**
   - `src/components/sidebar/ClaudeSidebar.tsx`
   - その他サイドバーを使用するコンポーネント

2. **テストファイル**
   - `src/hooks/__tests__/useSidebar.test.ts`（存在する場合）

## 注意事項

1. **後方互換性**: 既存のコンポーネントが動作することを確認
2. **型の厳密性**: 過度に厳密な型定義は避け、実用的なレベルに留める
3. **段階的実装**: 一度にすべてを変更せず、段階的に進める
4. **テストの実行**: 各段階でTypeScriptコンパイルとテストを実行

## 推奨される実装順序

1. まず`src/types/sidebar-hook.ts`をレビューし、必要に応じて調整
2. `useSidebar.ts`の基本的な型付けから開始
3. 各コールバック関数を順次型付け
4. 最後に全体的な動作確認とテスト