// 高度な質問パターンの定義

export interface AdvancedQuestion {
  id: string;
  category: string;
  difficulty: 'basic' | 'intermediate' | 'advanced' | 'expert';
  question: string;
  context?: any;
  expectedElements: string[];
  evaluationCriteria: {
    mustInclude: string[];
    shouldInclude: string[];
    bonusPoints: string[];
  };
}

export const advancedQuestions: AdvancedQuestion[] = [
  // 売上予測カテゴリ
  {
    id: 'sales_001',
    category: '売上予測',
    difficulty: 'advanced',
    question: '過去3年間の季節性を考慮して、来月の売上を予測してください。特に、前年の異常値（コロナ特需）を除外した上で、信頼区間も含めて提示してください。',
    context: {
      historicalData: '3年分の月次売上データ',
      anomalies: '2020年4-6月にコロナ特需',
      currentTrends: '直近3ヶ月は前年比105%成長'
    },
    expectedElements: [
      '時系列分析手法の選択理由',
      '異常値の処理方法',
      '季節性の定量化',
      '予測値と信頼区間',
      'リスク要因の列挙'
    ],
    evaluationCriteria: {
      mustInclude: ['予測値', '信頼区間', '季節性考慮'],
      shouldInclude: ['異常値処理', 'モデル選択理由', '前提条件'],
      bonusPoints: ['複数モデルの比較', '感度分析', '外部要因の考慮']
    }
  },
  {
    id: 'sales_002',
    category: '売上予測',
    difficulty: 'expert',
    question: '競合他社の価格変更が自社売上に与える影響を分析してください。価格弾力性を考慮し、最適な価格対応戦略を提案してください。',
    context: {
      competitorPriceChange: '主要競合が10%値下げ',
      currentPricePosition: '市場平均より5%高い',
      priceElasticity: '過去データから推定可能'
    },
    expectedElements: [
      '価格弾力性の計算',
      '市場シェアへの影響予測',
      '収益最大化の観点',
      '段階的対応シナリオ',
      '長期的影響の考察'
    ],
    evaluationCriteria: {
      mustInclude: ['価格弾力性', '影響度の定量化', '対応戦略'],
      shouldInclude: ['シナリオ分析', 'リスク評価', 'タイミング戦略'],
      bonusPoints: ['ゲーム理論の応用', '動的価格モデル', 'A/Bテスト提案']
    }
  },
  {
    id: 'sales_003',
    category: '売上予測',
    difficulty: 'expert',
    question: '新商品投入による既存商品のカニバリゼーション率を計算し、全体の売上最適化戦略を立案してください。',
    context: {
      newProduct: 'プレミアム版の投入予定',
      existingProducts: '標準版3SKU',
      targetSegment: '既存顧客の30%が対象'
    },
    expectedElements: [
      'カニバリゼーション率の推定方法',
      '顧客セグメント別の影響',
      '価格戦略の最適化',
      '商品ポートフォリオ管理',
      'ROI予測'
    ],
    evaluationCriteria: {
      mustInclude: ['カニバリ率計算', '全体売上への影響', '最適化戦略'],
      shouldInclude: ['セグメント分析', '価格差別化', 'プロモーション計画'],
      bonusPoints: ['LTV考慮', 'クロスセル機会', '段階的展開計画']
    }
  },

  // 在庫最適化カテゴリ
  {
    id: 'inventory_001',
    category: '在庫最適化',
    difficulty: 'advanced',
    question: 'マルチチャネル（店舗、EC、卸売）の在庫を最適配分する戦略を提案してください。各チャネルの需要特性と収益性を考慮してください。',
    context: {
      channels: ['実店舗10店', 'ECサイト', '卸売3社'],
      constraints: '総在庫スペース制限あり',
      serviceLevel: '各チャネル95%以上維持'
    },
    expectedElements: [
      'チャネル別需要予測',
      '収益性分析',
      '在庫配分アルゴリズム',
      '転送戦略',
      'KPI設定'
    ],
    evaluationCriteria: {
      mustInclude: ['配分ロジック', '収益最大化', 'サービスレベル維持'],
      shouldInclude: ['需要変動対応', '在庫共有化', 'リスク分散'],
      bonusPoints: ['動的再配分', 'オムニチャネル統合', 'AIアルゴリズム提案']
    }
  },
  {
    id: 'inventory_002',
    category: '在庫最適化',
    difficulty: 'expert',
    question: 'サプライチェーンリスク（自然災害、地政学的リスク、為替変動）を考慮した安全在庫レベルを算出し、BCPを含めた在庫戦略を立案してください。',
    context: {
      suppliers: '海外3社、国内2社',
      leadTime: '海外60日、国内14日',
      riskFactors: '台風シーズン、貿易摩擦'
    },
    expectedElements: [
      'リスク評価マトリックス',
      '確率的在庫モデル',
      'サプライヤー分散戦略',
      'コスト・リスクトレードオフ',
      'BCP詳細計画'
    ],
    evaluationCriteria: {
      mustInclude: ['リスク定量化', '安全在庫計算', 'BCP策定'],
      shouldInclude: ['シナリオ分析', 'コスト影響', '代替調達先'],
      bonusPoints: ['モンテカルロシミュレーション', 'リアルタイムモニタリング', '保険活用']
    }
  },
  {
    id: 'inventory_003',
    category: '在庫最適化',
    difficulty: 'advanced',
    question: '季節商品の段階的値下げ戦略を立案してください。在庫処分と利益最大化のバランスを考慮し、動的な価格調整モデルを提示してください。',
    context: {
      seasonalItem: '冬物アパレル',
      seasonEnd: '3ヶ月後',
      currentStock: '5000点',
      holdingCost: '月2%'
    },
    expectedElements: [
      '需要予測モデル',
      '価格最適化アルゴリズム',
      'マークダウン時期と幅',
      '在庫処分目標',
      '収益シミュレーション'
    ],
    evaluationCriteria: {
      mustInclude: ['段階的値下げ計画', '需要予測', '収益最大化'],
      shouldInclude: ['在庫コスト考慮', '競合動向', '顧客心理'],
      bonusPoints: ['動的価格モデル', 'A/Bテスト計画', '次シーズン影響']
    }
  },

  // 顧客行動分析カテゴリ
  {
    id: 'customer_001',
    category: '顧客行動分析',
    difficulty: 'intermediate',
    question: 'RFM分析を用いて顧客をセグメント化し、各セグメントに対する最適なマーケティング施策を提案してください。',
    context: {
      customerBase: '10万人',
      averageLTV: '5万円',
      churnRate: '年間20%'
    },
    expectedElements: [
      'RFMスコアリング方法',
      'セグメント定義',
      '各セグメントの特徴',
      '施策の具体案',
      'ROI予測'
    ],
    evaluationCriteria: {
      mustInclude: ['RFM計算', 'セグメント分類', '施策提案'],
      shouldInclude: ['セグメントサイズ', '収益貢献度', '実施優先順位'],
      bonusPoints: ['機械学習活用', 'パーソナライズ度', 'オートメーション']
    }
  },
  {
    id: 'customer_002',
    category: '顧客行動分析',
    difficulty: 'advanced',
    question: 'カスタマージャーニーの各タッチポイントにおける離脱要因を分析し、コンバージョン率を20%向上させる施策を立案してください。',
    context: {
      currentCVR: '2.5%',
      mainTouchpoints: ['広告', '商品ページ', 'カート', '決済'],
      dropoffRates: {'商品ページ': '60%', 'カート': '70%', '決済': '20%'}
    },
    expectedElements: [
      'ファネル分析',
      '離脱要因の特定',
      '改善施策の優先順位',
      'A/Bテスト計画',
      '実装ロードマップ'
    ],
    evaluationCriteria: {
      mustInclude: ['離脱分析', '具体的施策', '効果測定方法'],
      shouldInclude: ['ユーザビリティ改善', '心理的障壁', 'テクニカル改善'],
      bonusPoints: ['行動心理学応用', 'マイクロコンバージョン', 'プログレッシブ改善']
    }
  },
  {
    id: 'customer_003',
    category: '顧客行動分析',
    difficulty: 'expert',
    question: '顧客の潜在ニーズを予測し、プロアクティブなクロスセル・アップセル戦略を設計してください。機械学習モデルの活用も含めて提案してください。',
    context: {
      productCategories: 15,
      averageBasketSize: 3.2,
      repeatPurchaseRate: '35%'
    },
    expectedElements: [
      '協調フィルタリング',
      'アソシエーション分析',
      '予測モデル設計',
      'レコメンドロジック',
      'パフォーマンス指標'
    ],
    evaluationCriteria: {
      mustInclude: ['予測手法', 'クロスセル戦略', '実装方法'],
      shouldInclude: ['データ要件', 'モデル精度', 'リアルタイム性'],
      bonusPoints: ['深層学習活用', 'コンテキスト考慮', 'エシカル配慮']
    }
  },

  // マーケティング戦略カテゴリ
  {
    id: 'marketing_001',
    category: 'マーケティング戦略',
    difficulty: 'intermediate',
    question: '限られた予算（月100万円）で最大のROASを実現するマルチチャネルマーケティング戦略を立案してください。',
    context: {
      currentChannels: ['Google Ads', 'Facebook', 'Instagram'],
      targetAudience: '25-40歳女性',
      productType: 'コスメ・美容商品'
    },
    expectedElements: [
      'チャネル配分戦略',
      'ターゲティング方法',
      'クリエイティブ戦略',
      'パフォーマンス予測',
      '最適化サイクル'
    ],
    evaluationCriteria: {
      mustInclude: ['予算配分', 'ROAS目標', 'チャネル選定理由'],
      shouldInclude: ['オーディエンス戦略', 'シーズナリティ', 'テスト計画'],
      bonusPoints: ['アトリビューション', 'LTV考慮', 'オーガニック統合']
    }
  },
  {
    id: 'marketing_002',
    category: 'マーケティング戦略',
    difficulty: 'advanced',
    question: 'インフルエンサーマーケティングとUGCを組み合わせた、バイラル性の高いキャンペーンを設計してください。',
    context: {
      brand: 'D2Cファッションブランド',
      target: 'Z世代',
      budget: '500万円',
      timeline: '3ヶ月'
    },
    expectedElements: [
      'インフルエンサー選定基準',
      'UGC促進メカニズム',
      'バイラル要素の設計',
      'コンテンツ戦略',
      '効果測定フレームワーク'
    ],
    evaluationCriteria: {
      mustInclude: ['キャンペーン設計', 'KPI設定', 'タイムライン'],
      shouldInclude: ['プラットフォーム戦略', 'リスク管理', 'エンゲージメント施策'],
      bonusPoints: ['心理的トリガー', 'コミュニティ形成', '長期的価値']
    }
  },
  {
    id: 'marketing_003',
    category: 'マーケティング戦略',
    difficulty: 'expert',
    question: 'ファーストパーティデータを活用した、プライバシーファーストな時代のパーソナライゼーション戦略を構築してください。',
    context: {
      dataPoints: ['購買履歴', 'サイト行動', 'メール開封'],
      privacyRegulations: ['GDPR', '個人情報保護法'],
      techStack: 'CDP導入済み'
    },
    expectedElements: [
      'データ収集戦略',
      'セグメンテーション方法',
      'パーソナライゼーションレベル',
      'プライバシー対策',
      '技術実装計画'
    ],
    evaluationCriteria: {
      mustInclude: ['データ活用方法', 'プライバシー配慮', 'パーソナライゼーション施策'],
      shouldInclude: ['同意管理', 'データ統合', 'ROI測定'],
      bonusPoints: ['ゼロパーティデータ', 'AI活用', 'エッジコンピューティング']
    }
  },

  // オペレーション最適化カテゴリ
  {
    id: 'operations_001',
    category: 'オペレーション最適化',
    difficulty: 'intermediate',
    question: 'ピーク時（セール期間）の注文処理能力を50%向上させる、オペレーション改善計画を立案してください。',
    context: {
      currentCapacity: '1日5000注文',
      peakDemand: '1日8000注文',
      bottlenecks: ['梱包工程', 'システム処理']
    },
    expectedElements: [
      'ボトルネック分析',
      'プロセス改善案',
      '人員配置最適化',
      'システム拡張計画',
      'コスト影響分析'
    ],
    evaluationCriteria: {
      mustInclude: ['能力向上施策', '実装計画', 'コスト試算'],
      shouldInclude: ['自動化提案', '品質維持', 'スケーラビリティ'],
      bonusPoints: ['AI/ロボティクス', '柔軟な労働力', 'リアルタイム最適化']
    }
  },
  {
    id: 'operations_002',
    category: 'オペレーション最適化',
    difficulty: 'advanced',
    question: '返品率を現在の12%から8%に削減しつつ、顧客満足度を維持向上させる戦略を提案してください。',
    context: {
      mainReturnReasons: ['サイズ違い40%', '品質期待違い30%', 'その他30%'],
      currentPolicy: '30日間返品無料',
      competitorPolicy: '同様の条件'
    },
    expectedElements: [
      '返品要因の深掘り分析',
      '予防的施策',
      'ポリシー最適化',
      '顧客体験向上策',
      'インパクト予測'
    ],
    evaluationCriteria: {
      mustInclude: ['要因別対策', '削減目標達成方法', '顧客満足度施策'],
      shouldInclude: ['商品説明改善', 'バーチャル試着', 'カスタマーレビュー活用'],
      bonusPoints: ['AI size推奨', '品質保証強化', 'ロイヤルティプログラム']
    }
  },
  {
    id: 'operations_003',
    category: 'オペレーション最適化',
    difficulty: 'expert',
    question: 'サステナビリティを考慮した、カーボンニュートラルな配送ネットワークを設計してください。コストと環境影響のバランスを定量的に示してください。',
    context: {
      currentEmissions: '年間1000トンCO2',
      deliveryVolume: '月間10万件',
      costConstraint: '現状比+10%まで'
    },
    expectedElements: [
      '現状の排出量分析',
      '削減施策の優先順位',
      '代替配送手段',
      'オフセット戦略',
      'ROIとインパクト'
    ],
    evaluationCriteria: {
      mustInclude: ['排出削減計画', 'コスト分析', '実現可能性'],
      shouldInclude: ['電動車両導入', '配送ルート最適化', 'パッケージング改善'],
      bonusPoints: ['循環型物流', 'ブロックチェーン追跡', 'ステークホルダー協業']
    }
  }
];

// 質問カテゴリごとの分類
export function getQuestionsByCategory(category: string): AdvancedQuestion[] {
  return advancedQuestions.filter(q => q.category === category);
}

// 難易度別の分類
export function getQuestionsByDifficulty(difficulty: string): AdvancedQuestion[] {
  return advancedQuestions.filter(q => q.difficulty === difficulty);
}

// ランダムな質問セットの生成
export function generateQuestionSet(
  count: number,
  options?: {
    categories?: string[];
    difficulties?: string[];
  }
): AdvancedQuestion[] {
  let filtered = [...advancedQuestions];
  
  if (options?.categories) {
    filtered = filtered.filter(q => options.categories!.includes(q.category));
  }
  
  if (options?.difficulties) {
    filtered = filtered.filter(q => options.difficulties!.includes(q.difficulty));
  }
  
  // Fisher-Yatesシャッフル
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }
  
  return filtered.slice(0, count);
}

// 質問の統計情報
export function getQuestionStats() {
  const stats = {
    total: advancedQuestions.length,
    byCategory: {} as Record<string, number>,
    byDifficulty: {} as Record<string, number>
  };
  
  advancedQuestions.forEach(q => {
    stats.byCategory[q.category] = (stats.byCategory[q.category] || 0) + 1;
    stats.byDifficulty[q.difficulty] = (stats.byDifficulty[q.difficulty] || 0) + 1;
  });
  
  return stats;
}