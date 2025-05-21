import unittest
import os
import re
from pathlib import Path

class TestDocumentationLinks(unittest.TestCase):
    """ドキュメント内リンクの検証テスト"""
    
    def setUp(self):
        """テスト前のセットアップ"""
        # プロジェクトのルートディレクトリを取得
        self.project_root = Path(__file__).parent.parent.absolute()
        # docsディレクトリのパス
        self.docs_dir = self.project_root / "docs"
        
        # テスト対象のマークダウンファイルパターン
        self.markdown_patterns = ["*.md", "**/*.md"]
        
        # リンクを抽出する正規表現パターン
        self.link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
        self.heading_pattern = re.compile(r'^#+\s+(.+)$', re.MULTILINE)
    
    def test_internal_links_exist(self):
        """内部リンクが有効であることをテスト"""
        broken_links = []
        
        # すべてのマークダウンファイルを検索
        for pattern in self.markdown_patterns:
            for file_path in self.project_root.glob(pattern):
                relative_path = file_path.relative_to(self.project_root)
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # リンクを抽出
                    links = self.link_pattern.findall(content)
                    
                    for link_text, link_target in links:
                        # 内部リンクのみチェック
                        if link_target.startswith(('http://', 'https://', 'mailto:', '#')):
                            continue
                        
                        # 相対パスのリンク
                        if link_target.startswith('./') or link_target.startswith('../'):
                            # リンク先のパスを構築
                            target_path = (file_path.parent / link_target).resolve()
                            if not target_path.exists():
                                broken_links.append((str(relative_path), link_text, link_target))
                        # 絶対パス
                        elif link_target.startswith('/'):
                            target_path = self.project_root / link_target.lstrip('/')
                            if not target_path.exists():
                                broken_links.append((str(relative_path), link_text, link_target))
                        # ファイル名のみ
                        else:
                            target_path = file_path.parent / link_target
                            if not target_path.exists():
                                broken_links.append((str(relative_path), link_text, link_target))
                
                except Exception as e:
                    self.fail(f"ファイル {relative_path} の処理中にエラーが発生しました: {str(e)}")
        
        # 結果の検証
        if broken_links:
            error_message = "以下の内部リンクが無効です:\n"
            for source, text, target in broken_links:
                error_message += f"  {source} -> [{text}]({target})\n"
            self.fail(error_message)
    
    def test_anchor_links(self):
        """アンカーリンク（#セクション）が有効であることをテスト"""
        invalid_anchors = []
        
        # すべてのマークダウンファイルを検索
        for pattern in self.markdown_patterns:
            for file_path in self.project_root.glob(pattern):
                relative_path = file_path.relative_to(self.project_root)
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # 見出しを抽出
                    headings = self.heading_pattern.findall(content)
                    heading_ids = [self._to_anchor_id(heading) for heading in headings]
                    
                    # リンクを抽出
                    links = self.link_pattern.findall(content)
                    
                    for link_text, link_target in links:
                        # 同ファイル内のアンカーリンクのみチェック
                        if link_target.startswith('#'):
                            anchor = link_target[1:]  # '#' を削除
                            if anchor not in heading_ids:
                                invalid_anchors.append((str(relative_path), link_text, link_target))
                
                except Exception as e:
                    self.fail(f"ファイル {relative_path} の処理中にエラーが発生しました: {str(e)}")
        
        # 結果の検証
        if invalid_anchors:
            error_message = "以下のアンカーリンクが無効です:\n"
            for source, text, target in invalid_anchors:
                error_message += f"  {source} -> [{text}]({target})\n"
            self.fail(error_message)
    
    def test_project_name_consistency(self):
        """プロジェクト名の一貫性をテスト"""
        inconsistent_files = []
        
        # すべてのマークダウンファイルを検索
        for pattern in self.markdown_patterns:
            for file_path in self.project_root.glob(pattern):
                relative_path = file_path.relative_to(self.project_root)
                
                # 特定の変更除外ファイル（RENAME_MIGRATION.mdなど）は対象外
                if "RENAME_MIGRATION.md" in str(file_path):
                    continue
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # 旧プロジェクト名が単独で使用されている場合をチェック
                    # ただし「旧Shopify MCP Server」などの説明は許可
                    standalone_old_name = re.search(r'(?<!\(旧)Shopify MCP Server(?![\s\S]*旧)', content)
                    
                    if standalone_old_name:
                        inconsistent_files.append(str(relative_path))
                
                except Exception as e:
                    self.fail(f"ファイル {relative_path} の処理中にエラーが発生しました: {str(e)}")
        
        # 結果の検証
        if inconsistent_files:
            error_message = "以下のファイルでプロジェクト名が一貫していません（旧プロジェクト名が単独で使用されています）:\n"
            for file_path in inconsistent_files:
                error_message += f"  {file_path}\n"
            self.fail(error_message)
    
    def _to_anchor_id(self, heading):
        """見出しテキストからアンカーIDを生成（GitHubの変換ルールに近似）"""
        # 小文字に変換
        anchor = heading.lower()
        # 空白をハイフンに変換
        anchor = anchor.replace(' ', '-')
        # 英数字、ハイフン、アンダースコア以外の文字を削除
        anchor = re.sub(r'[^\w\-]', '', anchor)
        return anchor


if __name__ == "__main__":
    unittest.main()