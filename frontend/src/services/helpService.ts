/**
 * ヘルプサービス
 * アプリケーションのヘルプとドキュメント管理機能を提供
 */
import { v4 as uuidv4 } from 'uuid';

export type HelpCategoryId = 
  | 'getting-started' 
  | 'dashboard' 
  | 'connections' 
  | 'api-settings' 
  | 'analytics' 
  | 'reports' 
  | 'offline' 
  | 'settings'
  | 'troubleshooting';

export interface HelpCategory {
  id: HelpCategoryId;
  name: string;
  description: string;
  icon?: string;
  order: number;
}

export interface HelpArticle {
  id: string;
  categoryId: HelpCategoryId;
  title: string;
  content: string;
  lastUpdated: string;
  tags: string[];
  relatedArticleIds?: string[];
  videoUrl?: string;
  order: number;
}

export interface HelpSearchResult {
  articleId: string;
  title: string;
  categoryId: HelpCategoryId;
  categoryName: string;
  snippet: string;
  relevance: number; // 0-100
}

export interface TourStep {
  id: string;
  targetElement: string; // CSS selector
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  order: number;
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
  isEnabled: boolean;
}

class HelpService {
  private categories: HelpCategory[] = [];
  private articles: HelpArticle[] = [];
  private tours: Tour[] = [];
  private isInitialized: boolean = false;
  private onCategoriesChangeListeners: ((categories: HelpCategory[]) => void)[] = [];
  private onArticlesChangeListeners: ((articles: HelpArticle[]) => void)[] = [];

  /**
   * ヘルプシステムの初期化
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 本番環境では外部のAPIやCMSからデータを取得するなどの実装に置き換える
      await this.loadSampleData();
      this.isInitialized = true;
      
      // リスナーに通知
      this.notifyCategoriesChange();
      this.notifyArticlesChange();
    } catch (error) {
      console.error('Failed to initialize help service:', error);
      throw error;
    }
  }

  /**
   * カテゴリー一覧を取得
   */
  public getCategories(): HelpCategory[] {
    return [...this.categories].sort((a, b) => a.order - b.order);
  }

  /**
   * 特定のカテゴリーを取得
   */
  public getCategory(categoryId: HelpCategoryId): HelpCategory | undefined {
    return this.categories.find(category => category.id === categoryId);
  }

  /**
   * 特定のカテゴリーに属する記事一覧を取得
   */
  public getArticlesByCategory(categoryId: HelpCategoryId): HelpArticle[] {
    return this.articles
      .filter(article => article.categoryId === categoryId)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * 特定の記事を取得
   */
  public getArticle(articleId: string): HelpArticle | undefined {
    return this.articles.find(article => article.id === articleId);
  }

  /**
   * 関連記事を取得
   */
  public getRelatedArticles(articleId: string): HelpArticle[] {
    const article = this.getArticle(articleId);
    if (!article || !article.relatedArticleIds || article.relatedArticleIds.length === 0) {
      return [];
    }
    
    return this.articles.filter(a => article.relatedArticleIds?.includes(a.id));
  }

  /**
   * 記事を検索
   */
  public searchArticles(query: string): HelpSearchResult[] {
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    const normalizedQuery = query.toLowerCase().trim();
    const results: HelpSearchResult[] = [];
    
    for (const article of this.articles) {
      // タイトルと内容で検索
      const titleMatch = article.title.toLowerCase().includes(normalizedQuery);
      const contentMatch = article.content.toLowerCase().includes(normalizedQuery);
      const tagMatch = article.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));
      
      if (titleMatch || contentMatch || tagMatch) {
        // カテゴリー名を取得
        const category = this.getCategory(article.categoryId);
        const categoryName = category ? category.name : 'Unknown';
        
        // スニペットを作成
        let snippet = '';
        if (contentMatch) {
          const index = article.content.toLowerCase().indexOf(normalizedQuery);
          const start = Math.max(0, index - 50);
          const end = Math.min(article.content.length, index + normalizedQuery.length + 50);
          snippet = (start > 0 ? '...' : '') + 
                    article.content.substring(start, end) + 
                    (end < article.content.length ? '...' : '');
        } else {
          // 内容の最初の100文字をスニペットとして使用
          snippet = article.content.substring(0, 100) + 
                   (article.content.length > 100 ? '...' : '');
        }
        
        // 関連度を計算（単純な実装）
        let relevance = 0;
        if (titleMatch) relevance += 50; // タイトル一致は重み付け大
        if (contentMatch) relevance += 30; // 内容一致
        if (tagMatch) relevance += 20; // タグ一致
        
        results.push({
          articleId: article.id,
          title: article.title,
          categoryId: article.categoryId,
          categoryName,
          snippet,
          relevance
        });
      }
    }
    
    // 関連度でソート
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * 新しいカテゴリーを追加
   */
  public addCategory(category: Omit<HelpCategory, 'id'>): HelpCategory {
    const newCategory: HelpCategory = {
      ...category,
      id: `custom-${uuidv4().substring(0, 8)}` as HelpCategoryId
    };
    
    this.categories.push(newCategory);
    this.notifyCategoriesChange();
    
    return newCategory;
  }

  /**
   * カテゴリーを更新
   */
  public updateCategory(categoryId: HelpCategoryId, updates: Partial<Omit<HelpCategory, 'id'>>): HelpCategory | null {
    const index = this.categories.findIndex(c => c.id === categoryId);
    if (index === -1) return null;
    
    this.categories[index] = {
      ...this.categories[index],
      ...updates
    };
    
    this.notifyCategoriesChange();
    return this.categories[index];
  }

  /**
   * カテゴリーを削除
   */
  public removeCategory(categoryId: HelpCategoryId): boolean {
    const initialLength = this.categories.length;
    this.categories = this.categories.filter(c => c.id !== categoryId);
    
    if (initialLength !== this.categories.length) {
      // 関連する記事も削除
      this.articles = this.articles.filter(a => a.categoryId !== categoryId);
      
      this.notifyCategoriesChange();
      this.notifyArticlesChange();
      return true;
    }
    
    return false;
  }

  /**
   * 新しい記事を追加
   */
  public addArticle(article: Omit<HelpArticle, 'id'>): HelpArticle | null {
    // カテゴリーが存在するか確認
    if (!this.getCategory(article.categoryId)) {
      return null;
    }
    
    const newArticle: HelpArticle = {
      ...article,
      id: uuidv4(),
      lastUpdated: new Date().toISOString()
    };
    
    this.articles.push(newArticle);
    this.notifyArticlesChange();
    
    return newArticle;
  }

  /**
   * 記事を更新
   */
  public updateArticle(articleId: string, updates: Partial<Omit<HelpArticle, 'id' | 'lastUpdated'>>): HelpArticle | null {
    const index = this.articles.findIndex(a => a.id === articleId);
    if (index === -1) return null;
    
    this.articles[index] = {
      ...this.articles[index],
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    this.notifyArticlesChange();
    return this.articles[index];
  }

  /**
   * 記事を削除
   */
  public removeArticle(articleId: string): boolean {
    const initialLength = this.articles.length;
    this.articles = this.articles.filter(a => a.id !== articleId);
    
    if (initialLength !== this.articles.length) {
      // 関連記事からの参照も削除
      this.articles = this.articles.map(article => {
        if (article.relatedArticleIds?.includes(articleId)) {
          return {
            ...article,
            relatedArticleIds: article.relatedArticleIds.filter(id => id !== articleId)
          };
        }
        return article;
      });
      
      this.notifyArticlesChange();
      return true;
    }
    
    return false;
  }

  /**
   * ツアーの一覧を取得
   */
  public getTours(): Tour[] {
    return [...this.tours];
  }

  /**
   * 特定のツアーを取得
   */
  public getTour(tourId: string): Tour | undefined {
    return this.tours.find(tour => tour.id === tourId);
  }

  /**
   * カテゴリー変更時のリスナーを登録
   */
  public subscribeToCategoriesChange(listener: (categories: HelpCategory[]) => void): () => void {
    this.onCategoriesChangeListeners.push(listener);
    return () => {
      this.onCategoriesChangeListeners = this.onCategoriesChangeListeners.filter(l => l !== listener);
    };
  }

  /**
   * 記事変更時のリスナーを登録
   */
  public subscribeToArticlesChange(listener: (articles: HelpArticle[]) => void): () => void {
    this.onArticlesChangeListeners.push(listener);
    return () => {
      this.onArticlesChangeListeners = this.onArticlesChangeListeners.filter(l => l !== listener);
    };
  }

  /**
   * カテゴリー変更をリスナーに通知
   */
  private notifyCategoriesChange(): void {
    for (const listener of this.onCategoriesChangeListeners) {
      listener([...this.categories]);
    }
  }

  /**
   * 記事変更をリスナーに通知
   */
  private notifyArticlesChange(): void {
    for (const listener of this.onArticlesChangeListeners) {
      listener([...this.articles]);
    }
  }

  /**
   * サンプルデータの読み込み（開発用）
   */
  private async loadSampleData(): Promise<void> {
    this.categories = [
      {
        id: 'getting-started',
        name: 'はじめに',
        description: 'Coneaの基本的な使い方と概要',
        order: 1
      },
      {
        id: 'dashboard',
        name: 'ダッシュボード',
        description: 'ダッシュボードの使い方と設定',
        order: 2
      },
      {
        id: 'connections',
        name: '接続設定',
        description: 'サーバー接続と認証の設定',
        order: 3
      },
      {
        id: 'api-settings',
        name: 'API設定',
        description: 'API連携の設定方法',
        order: 4
      },
      {
        id: 'analytics',
        name: '分析機能',
        description: 'データ分析とレポート機能の使い方',
        order: 5
      },
      {
        id: 'reports',
        name: 'レポート',
        description: 'レポート作成と共有の方法',
        order: 6
      },
      {
        id: 'offline',
        name: 'オフラインモード',
        description: 'オフライン機能の使用方法',
        order: 7
      },
      {
        id: 'settings',
        name: '設定',
        description: 'アプリケーション設定の管理',
        order: 8
      },
      {
        id: 'troubleshooting',
        name: 'トラブルシューティング',
        description: '一般的な問題の解決方法',
        order: 9
      }
    ];
    
    this.articles = [
      {
        id: 'getting-started-1',
        categoryId: 'getting-started',
        title: 'Coneaへようこそ',
        content: `# Coneaへようこそ

Coneaは、データ分析とレポート作成のための統合プラットフォームです。このガイドでは、Coneaの基本的な機能と使い方について説明します。

## Coneaでできること

- **リアルタイムデータ分析**: 接続されたデータソースからリアルタイムでデータを分析できます
- **カスタムダッシュボード**: ドラッグ＆ドロップでカスタムダッシュボードを作成できます
- **自動レポート生成**: スケジュールに基づいて自動的にレポートを生成し、共有できます
- **オフライン作業**: インターネット接続がなくても作業を続け、後で同期できます

## はじめての方へ

1. アカウントにログインする
2. ダッシュボードに移動する
3. 「接続設定」でデータソースを追加する
4. 「ダッシュボードエディタ」で最初のダッシュボードを作成する

詳細な手順については、各機能のヘルプドキュメントを参照してください。`,
        lastUpdated: '2023-05-15T10:00:00Z',
        tags: ['入門', 'ガイド', '概要'],
        order: 1
      },
      {
        id: 'getting-started-2',
        categoryId: 'getting-started',
        title: 'アカウント設定',
        content: `# アカウント設定

Coneaを最大限に活用するために、まずはアカウント設定を完了しましょう。

## プロファイル設定

1. 右上のプロファイルアイコンをクリックします
2. 「プロファイル編集」を選択します
3. 必要な情報を入力し、「保存」をクリックします

## 通知設定

1. 設定ページに移動します
2. 「通知設定」タブを選択します
3. 受け取りたい通知の種類とタイミングを設定します

## セキュリティ設定

セキュリティを強化するために、以下の設定を行うことをお勧めします：

- 強力なパスワードの設定
- 二要素認証の有効化
- 定期的なパスワード変更

これらの設定を完了すると、Coneaを安全かつ効率的に使用できるようになります。`,
        lastUpdated: '2023-05-16T14:30:00Z',
        tags: ['アカウント', 'セキュリティ', '設定'],
        relatedArticleIds: ['getting-started-1'],
        order: 2
      },
      {
        id: 'dashboard-1',
        categoryId: 'dashboard',
        title: 'ダッシュボードの基本',
        content: `# ダッシュボードの基本

ダッシュボードは、重要なデータや指標を一目で確認できるビジュアル表示です。

## ダッシュボードの構成要素

- **ウィジェット**: グラフ、チャート、テーブルなどの表示単位
- **フィルター**: 表示データの範囲や条件を絞り込む機能
- **タイムレンジセレクター**: データの期間を選択する機能

## ダッシュボードの操作方法

- **ズーム**: グラフ上でマウスホイールを使用するか、ピンチジェスチャーでズームイン/アウト
- **パン**: グラフ上でドラッグして表示範囲を移動
- **データポイントの詳細**: データポイントにホバーまたはクリックして詳細を表示

## ダッシュボードのカスタマイズ

- ウィジェットの追加/削除
- レイアウトの変更
- カラーテーマの設定
- 自動更新間隔の設定

ダッシュボードをカスタマイズして、最も重要な情報を効率的に監視できるようにしましょう。`,
        lastUpdated: '2023-05-20T09:15:00Z',
        tags: ['ダッシュボード', '基本操作', 'ウィジェット'],
        order: 1
      },
      {
        id: 'offline-1',
        categoryId: 'offline',
        title: 'オフラインモードの使い方',
        content: `# オフラインモードの使い方

Coneaのオフラインモード機能を使うと、インターネット接続がない環境でも作業を続けることができます。

## オフラインモードの有効化

1. 設定ページに移動します
2. 「オフラインモード」タブを選択します
3. 「オフラインモードを有効にする」スイッチをオンにします

## オフラインでの作業

インターネット接続が失われると、Coneaは自動的にオフラインモードに切り替わります。画面上部に「オフライン」インジケーターが表示されます。

オフラインモードでは以下の操作が可能です：

- キャッシュされたデータの閲覧
- 新しいダッシュボードの作成
- レポートの作成と編集
- データの追加、編集、削除

これらの変更は、デバイス上にローカルで保存されます。

## オンラインに戻ったときの同期

インターネット接続が復活すると、Coneaは自動的に変更をサーバーと同期します。同期の進行状況は画面上部のバーで確認できます。

手動で同期を開始するには、オフラインインジケーターをクリックして「今すぐ同期」を選択します。

## 注意点

- 大量のデータを扱う場合は、事前にキャッシュの設定を確認してください
- 同じデータを複数のデバイスでオフライン編集すると、競合が発生する可能性があります
- 同期中にエラーが発生した場合は、ログを確認して適切な対処を行ってください`,
        lastUpdated: '2023-06-10T15:45:00Z',
        tags: ['オフライン', '同期', 'キャッシュ'],
        order: 1
      },
      {
        id: 'troubleshooting-1',
        categoryId: 'troubleshooting',
        title: '接続の問題を解決する',
        content: `# 接続の問題を解決する

Coneaでの接続問題に対処するための一般的なトラブルシューティング手順を紹介します。

## 一般的な接続エラー

以下は一般的な接続エラーとその解決方法です：

### 「サーバーに接続できません」エラー

1. インターネット接続を確認する
2. VPNを使用している場合は、一時的に無効にしてみる
3. ファイアウォールの設定を確認する
4. サーバーステータスページで障害が報告されていないか確認する

### 認証エラー

1. ユーザー名とパスワードが正しいことを確認する
2. 「パスワードを忘れた」機能を使用して再設定する
3. アカウントがロックされていないか確認する
4. 会社のシングルサインオン設定を確認する

### 接続タイムアウト

1. インターネット速度をテストする
2. 大規模なデータ転送の場合は、タイムアウト設定を変更する
3. プロキシサーバーの設定を確認する

## 接続診断ツール

Coneaには組み込みの接続診断ツールがあります：

1. 設定 > サーバー接続ページに移動します
2. 「接続診断を実行」ボタンをクリックします
3. レポートを分析して問題を特定します

## サポートへの連絡

上記の手順で問題が解決しない場合は、以下の情報を含めてサポートチームにお問い合わせください：

- エラーメッセージの全文
- 発生時刻と頻度
- 使用しているデバイスとブラウザの情報
- 診断ツールのレポート

詳細な情報を提供することで、迅速な問題解決が可能になります。`,
        lastUpdated: '2023-06-25T11:30:00Z',
        tags: ['トラブルシューティング', '接続', 'エラー'],
        order: 1
      }
    ];
    
    this.tours = [
      {
        id: 'getting-started-tour',
        name: 'はじめてのツアー',
        description: 'Coneaの基本機能を紹介するガイドツアー',
        isEnabled: true,
        steps: [
          {
            id: 'welcome-step',
            targetElement: '#dashboard-welcome',
            title: 'Coneaへようこそ',
            content: 'このツアーでは、Coneaの主要機能を紹介します。',
            position: 'bottom',
            order: 1
          },
          {
            id: 'navigation-step',
            targetElement: '.sidebar-navigation',
            title: 'ナビゲーション',
            content: 'サイドバーからアプリケーションの異なるセクションにアクセスできます。',
            position: 'right',
            order: 2
          },
          {
            id: 'dashboard-step',
            targetElement: '#dashboard-overview',
            title: 'ダッシュボード',
            content: 'ここで重要な指標を一目で確認できます。',
            position: 'bottom',
            order: 3
          }
        ]
      }
    ];
  }
}

// シングルトンインスタンスをエクスポート
const helpService = new HelpService();
export default helpService;