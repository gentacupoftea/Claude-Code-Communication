# Phase 4: 機械学習モデル仕様書

## 1. 推薦システムモデル

### 1.1 協調フィルタリングモデル

#### アルゴリズム
- **Matrix Factorization (SVD)**
  - ユーザー × アイテム行列の次元削減
  - 潜在因子数: 50-100
  - 正則化パラメータ: λ = 0.01

#### 入力データ
```typescript
interface UserItemInteraction {
  userId: string;
  itemId: string;
  rating: number; // 暗黙的フィードバック: 購入回数、閲覧時間等
  timestamp: Date;
}
```

#### 出力
```typescript
interface Recommendation {
  itemId: string;
  score: number; // 0-1の推薦スコア
  confidence: number; // 予測の信頼度
}
```

### 1.2 コンテンツベースフィルタリングモデル

#### 特徴量
- カテゴリ（one-hot encoding）
- 価格帯（正規化）
- ブランド（embedding）
- タグ（TF-IDF）
- 商品説明（Word2Vec/BERT埋め込み）

#### 類似度計算
- コサイン類似度
- ユークリッド距離
- ジャカード係数（カテゴリ用）

### 1.3 ハイブリッドディープラーニングモデル

#### アーキテクチャ
```python
Input Layer (User Features + Item Features + Context)
    ↓
Dense(128, activation='relu', regularizer=L2(0.01))
    ↓
Dropout(0.3)
    ↓
Dense(64, activation='relu', regularizer=L2(0.01))
    ↓
Dropout(0.2)
    ↓
Dense(32, activation='relu')
    ↓
Output Layer (1, activation='sigmoid')
```

#### ハイパーパラメータ
- 学習率: 0.001 (Adam optimizer)
- バッチサイズ: 32
- エポック数: 50
- Early stopping: patience=5

## 2. 売上予測モデル

### 2.1 LSTMモデル

#### アーキテクチャ
```python
Input Shape: (sequence_length=30, features=10)
    ↓
LSTM(64, return_sequences=True)
    ↓
Dropout(0.2)
    ↓
LSTM(32, return_sequences=False)
    ↓
Dense(16, activation='relu')
    ↓
Output(1) # 売上額
```

#### 特徴量エンジニアリング
- **時間的特徴**:
  - 曜日（sin/cos encoding）
  - 月（sin/cos encoding）
  - 祝日フラグ
  - イベント/セール期間

- **ラグ特徴**:
  - 過去7日、14日、30日の移動平均
  - 前年同期比
  - トレンド成分

- **外部要因**:
  - 天候データ（オプション）
  - 競合価格
  - マーケティング支出

### 2.2 Prophet モデル

#### コンポーネント
- **トレンド**: 区分線形成長モデル
- **季節性**:
  - 年次季節性（フーリエ級数: 10項）
  - 週次季節性（フーリエ級数: 3項）
- **祝日効果**: 国・地域別の祝日カレンダー

#### パラメータ
```python
prophet_params = {
    'changepoint_prior_scale': 0.05,
    'seasonality_prior_scale': 10,
    'holidays_prior_scale': 10,
    'seasonality_mode': 'multiplicative',
    'yearly_seasonality': True,
    'weekly_seasonality': True,
    'daily_seasonality': False
}
```

## 3. 在庫最適化モデル

### 3.1 需要予測モデル

#### XGBoostモデル
```python
xgb_params = {
    'objective': 'reg:squarederror',
    'max_depth': 6,
    'learning_rate': 0.1,
    'n_estimators': 100,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'reg_alpha': 0.1,
    'reg_lambda': 1
}
```

#### 特徴量
- 商品属性（カテゴリ、価格、etc）
- 販売履歴統計
- プロモーション情報
- 在庫レベル
- リードタイム

### 3.2 安全在庫計算

#### 統計的手法
```typescript
safetyStock = z_score * σ_demand * √lead_time

where:
- z_score: サービスレベルに基づく値（95% → 1.65）
- σ_demand: 需要の標準偏差
- lead_time: リードタイム（日数）
```

## 4. 価格最適化モデル

### 4.1 価格弾力性推定

#### 回帰モデル
```python
log(demand) = β0 + β1*log(price) + β2*features + ε

価格弾力性 = β1
```

### 4.2 収益最大化

#### 最適化アルゴリズム
- **手法**: ベイズ最適化（Optuna）
- **目的関数**: 期待収益 = 価格 × 予測需要
- **制約条件**:
  - 最低利益率
  - 競合価格範囲
  - ブランドポジショニング

## 5. 顧客セグメンテーション

### 5.1 K-meansクラスタリング

#### 特徴量（RFM分析拡張版）
- Recency: 最終購入からの日数
- Frequency: 購入頻度
- Monetary: 総購入額
- Variety: 購入商品の多様性
- Trend: 購入傾向の変化

#### 最適クラスタ数決定
- エルボー法
- シルエットスコア
- ビジネス解釈可能性

### 5.2 顧客生涯価値（CLV）予測

#### BGモデル + ガンマガンマモデル
```python
# 購入頻度予測
bg_model = BetaGeoFitter()
bg_model.fit(frequency, recency, T, penalizer_coef=0.01)

# 購入額予測
gg_model = GammaGammaFitter()
gg_model.fit(frequency, monetary_value)

# CLV計算
clv = gg_model.customer_lifetime_value(
    bg_model, frequency, recency, T, monetary_value,
    time=12, discount_rate=0.01
)
```

## 6. 異常検知モデル

### 6.1 Isolation Forest

#### パラメータ
```python
iso_forest_params = {
    'n_estimators': 100,
    'contamination': 0.01,  # 異常の予想割合
    'max_features': 1.0,
    'bootstrap': False
}
```

### 6.2 統計的手法

#### 移動平均＋標準偏差
- ウィンドウサイズ: 30日
- 異常閾値: μ ± 3σ
- 季節調整: STL分解

## 7. モデル評価メトリクス

### 推薦システム
- **Precision@K**: Top-K推薦の精度
- **Recall@K**: Top-K推薦の再現率
- **NDCG**: 正規化割引累積利得
- **Coverage**: カタログカバレッジ
- **Diversity**: 推薦の多様性

### 予測モデル
- **RMSE**: 二乗平均平方根誤差
- **MAE**: 平均絶対誤差
- **MAPE**: 平均絶対パーセント誤差
- **R²**: 決定係数

### ビジネスメトリクス
- **収益向上率**
- **在庫回転率改善**
- **顧客満足度スコア**
- **コンバージョン率**

## 8. モデル更新戦略

### オンライン学習
- ミニバッチ学習（日次）
- インクリメンタル更新
- A/Bテストによる検証

### バッチ再学習
- 週次: 推薦モデル
- 月次: 予測モデル
- 四半期: セグメンテーション

### モデルバージョニング
- MLflow Model Registry
- モデルメタデータ管理
- ロールバック機能

## 9. 実装上の考慮事項

### スケーラビリティ
- 分散学習（TensorFlow Distributed）
- モデル圧縮（量子化、プルーニング）
- 推論の最適化（TensorFlow Lite）

### 説明可能性
- SHAP値による特徴量重要度
- LIME による個別予測の説明
- 推薦理由の自然言語生成

### プライバシー保護
- 差分プライバシー
- フェデレーテッドラーニング（将来）
- データ匿名化

## 10. 継続的改善

### モニタリング
- モデルドリフト検出
- パフォーマンス劣化アラート
- ビジネスKPIとの相関分析

### 実験管理
- A/Bテストフレームワーク
- 多腕バンディット最適化
- 因果推論による効果測定