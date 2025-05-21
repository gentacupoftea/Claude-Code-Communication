/**
 * ヘルプシステムのカスタムフック
 * ヘルプとドキュメントへのアクセスを提供
 */
import { useState, useEffect, useCallback } from 'react';
import helpService, {
  HelpCategory,
  HelpArticle,
  HelpSearchResult,
  HelpCategoryId,
  Tour
} from '../services/helpService';

interface UseHelpOptions {
  initialCategory?: HelpCategoryId;
  autoSearch?: boolean;
}

export const useHelp = (options: UseHelpOptions = {}) => {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<HelpCategoryId | null>(
    options.initialCategory || null
  );
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<HelpArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [tours, setTours] = useState<Tour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ヘルプサービスの初期化
  useEffect(() => {
    const initializeHelp = async () => {
      setIsLoading(true);
      try {
        await helpService.initialize();
        setCategories(helpService.getCategories());
        setTours(helpService.getTours());
        
        // 初期カテゴリーが指定されている場合、その記事を読み込む
        if (options.initialCategory) {
          setArticles(helpService.getArticlesByCategory(options.initialCategory));
        }
        
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize help system'));
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeHelp();
  }, [options.initialCategory]);

  // カテゴリーの変更を購読
  useEffect(() => {
    const unsubscribe = helpService.subscribeToCategoriesChange((updatedCategories) => {
      setCategories(updatedCategories);
    });
    
    return unsubscribe;
  }, []);

  // 記事の変更を購読
  useEffect(() => {
    const unsubscribe = helpService.subscribeToArticlesChange((updatedArticles) => {
      // 現在表示されているカテゴリーの記事だけを更新
      if (selectedCategory) {
        const filteredArticles = updatedArticles.filter(
          article => article.categoryId === selectedCategory
        );
        setArticles(filteredArticles);
      }
      
      // 選択中の記事がある場合、その記事も更新
      if (selectedArticle) {
        const updatedArticle = updatedArticles.find(
          article => article.id === selectedArticle.id
        );
        if (updatedArticle) {
          setSelectedArticle(updatedArticle);
          
          // 関連記事も更新
          if (updatedArticle.relatedArticleIds && updatedArticle.relatedArticleIds.length > 0) {
            const related = updatedArticles.filter(
              article => updatedArticle.relatedArticleIds?.includes(article.id)
            );
            setRelatedArticles(related);
          }
        }
      }
    });
    
    return unsubscribe;
  }, [selectedCategory, selectedArticle]);

  // カテゴリー選択
  const selectCategory = useCallback((categoryId: HelpCategoryId) => {
    setSelectedCategory(categoryId);
    setSelectedArticle(null);
    setRelatedArticles([]);
    setArticles(helpService.getArticlesByCategory(categoryId));
  }, []);

  // 記事選択
  const selectArticle = useCallback((articleId: string) => {
    const article = helpService.getArticle(articleId);
    if (article) {
      setSelectedArticle(article);
      setRelatedArticles(helpService.getRelatedArticles(articleId));
    }
  }, []);

  // 検索実行
  const search = useCallback((query: string) => {
    setIsSearching(true);
    try {
      const results = helpService.searchArticles(query);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 検索クエリ変更時の処理
  useEffect(() => {
    if (options.autoSearch && searchQuery.trim().length > 0) {
      const timeoutId = setTimeout(() => {
        search(searchQuery);
      }, 300); // 300msの遅延を設けて連続入力中の検索を防止
      
      return () => clearTimeout(timeoutId);
    } else if (searchQuery.trim().length === 0) {
      setSearchResults([]);
    }
  }, [searchQuery, search, options.autoSearch]);

  // 検索結果から記事を選択
  const selectSearchResult = useCallback((result: HelpSearchResult) => {
    selectCategory(result.categoryId);
    selectArticle(result.articleId);
  }, [selectCategory, selectArticle]);

  // ツアーの取得
  const getTour = useCallback((tourId: string) => {
    return helpService.getTour(tourId);
  }, []);

  return {
    // データ
    categories,
    articles,
    selectedCategory,
    selectedArticle,
    relatedArticles,
    searchQuery,
    searchResults,
    tours,
    isLoading,
    isSearching,
    error,
    
    // アクション
    selectCategory,
    selectArticle,
    setSearchQuery,
    search,
    selectSearchResult,
    getTour
  };
};