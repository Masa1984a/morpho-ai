# Crypto Insight Ingestor

自動収集・要約生成システム for WLD, USDC, WBTC, WETH

## 概要

このプロジェクトは、4つの暗号資産（WLD, USDC, WBTC, WETH）について、OpenAI GPT-4を活用してweb検索を行い、最新の市況情報を自動的に収集・要約してPostgreSQLデータベースに保存します。

### 主要機能

- **定期バッチ収集**
  - 毎時00分：直近24時間の市況更新
  - 毎日06:05 UTC：直近30日の総合要約更新
- **REST API**
  - 資産一覧取得
  - 最新サマリ取得
  - 価格系列取得
  - 実行メタ情報取得

## 技術スタック

- **Frontend/Backend**: Next.js 15 (App Router)
- **Database**: PostgreSQL (Vercel Postgres)
- **ORM**: Prisma
- **AI Model**: OpenAI GPT-4 Turbo
- **Deploy**: Vercel
- **Language**: TypeScript

## プロジェクト構造

```
morpho-ai/
├── prisma/
│   ├── schema.prisma       # データベーススキーマ
│   └── seed.ts             # 初期データ投入
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── ingest/
│   │       │   ├── hourly/route.ts   # 毎時バッチ
│   │       │   └── daily/route.ts    # 毎日バッチ
│   │       ├── assets/
│   │       │   ├── route.ts          # 資産一覧API
│   │       │   └── [symbol]/
│   │       │       ├── summary/route.ts  # サマリAPI
│   │       │       └── prices/route.ts   # 価格API
│   │       └── runs/
│   │           └── [id]/route.ts     # 実行メタAPI
│   ├── lib/
│   │   ├── prisma.ts       # Prismaクライアント
│   │   ├── openai.ts       # OpenAI統合
│   │   ├── auth.ts         # 認証ミドルウェア
│   │   └── utils.ts        # ユーティリティ関数
│   └── types/
│       └── index.ts        # 型定義
├── package.json
├── tsconfig.json
├── next.config.js
├── vercel.json             # Vercel設定（Cron含む）
└── README.md
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、以下の変数を設定：

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
OPENAI_API_KEY="sk-..."
API_BEARER_TOKENS="token1,token2,token3"
CRON_SECRET="your-random-secret-here"
```

### 3. データベースのセットアップ

```bash
# Prismaクライアント生成
npm run prisma:generate

# マイグレーション実行
npx prisma migrate dev --name init

# 初期データ投入
npm run prisma:seed
```

### 4. 開発サーバー起動

```bash
npm run dev
```

## デプロイ (Vercel)

### 1. Vercelプロジェクト作成

```bash
vercel
```

### 2. Postgres データベース接続

1. Vercel Dashboard → Storage → Create Database
2. Postgres を選択
3. 接続設定を環境変数に自動追加

### 3. 環境変数の設定

Vercel Dashboard → Settings → Environment Variables で以下を設定：

- `OPENAI_API_KEY`
- `API_BEARER_TOKENS`
- `CRON_SECRET`
- `DATABASE_URL` (Postgres接続時に自動設定)

### 4. デプロイ

```bash
vercel --prod
```

### 5. Cronジョブの有効化

`vercel.json` の設定により、デプロイ時に自動的にCronジョブが設定されます：

- **Hourly**: 毎時00分に `/api/ingest/hourly` を実行
- **Daily**: 毎日06:05 UTCに `/api/ingest/daily` を実行

## API仕様

### 認証

全てのAPIエンドポイントは Bearer token 認証が必要です：

```bash
Authorization: Bearer <token>
```

Cronジョブは `x-cron-secret` ヘッダーまたは Bearer token で認証されます。

### エンドポイント

#### 1. 資産一覧取得

```http
GET /api/assets
```

**レスポンス:**
```json
{
  "assets": [
    {
      "id": "uuid",
      "symbol": "WLD",
      "name": "Worldcoin",
      "category": "coin",
      "lastUpdate": "2025-10-07T12:00:00Z"
    }
  ]
}
```

#### 2. 最新サマリ取得

```http
GET /api/assets/{symbol}/summary
```

**パラメータ:**
- `symbol`: WLD | USDC | WBTC | WETH

**レスポンス:**
```json
{
  "asset": {
    "symbol": "WLD",
    "name": "Worldcoin"
  },
  "overview_md": "...",
  "market_1d_md": "...",
  "market_30d_md": "...",
  "outlook_md": "...",
  "confidence": 0.85,
  "sources": [
    {
      "id": "uuid",
      "url": "https://...",
      "title": "...",
      "relevance_score": 0.9
    }
  ],
  "created_at": "2025-10-07T12:00:00Z"
}
```

#### 3. 価格系列取得

```http
GET /api/assets/{symbol}/prices?range=1d&interval=hour
```

**パラメータ:**
- `symbol`: WLD | USDC | WBTC | WETH
- `range`: 1d | 30d (デフォルト: 1d)
- `interval`: hour | day (デフォルト: hour)

**レスポンス:**
```json
{
  "asset": {
    "symbol": "WLD",
    "name": "Worldcoin"
  },
  "range": "1d",
  "count": 24,
  "prices": [
    {
      "ts": "2025-10-07T00:00:00Z",
      "priceUsd": "2.45",
      "marketCapUsd": "1000000000.00",
      "volume24hUsd": "50000000.00"
    }
  ]
}
```

#### 4. 実行メタ情報取得

```http
GET /api/runs/{id}
```

**レスポンス:**
```json
{
  "id": "uuid",
  "kind": "daily",
  "status": "success",
  "model": "gpt-4-turbo-preview",
  "started_at": "2025-10-07T06:05:00Z",
  "finished_at": "2025-10-07T06:10:00Z",
  "token_in": 5000,
  "token_out": 3000,
  "cost_usd": "0.1500",
  "summaries": {
    "count": 4
  },
  "sources": {
    "count": 15,
    "unique_domains": 8
  }
}
```

## 手動実行

Cronジョブを手動で実行する場合：

```bash
# Hourly バッチ
curl -X POST https://your-domain.vercel.app/api/ingest/hourly \
  -H "x-cron-secret: your-secret"

# Daily バッチ
curl -X POST https://your-domain.vercel.app/api/ingest/daily \
  -H "x-cron-secret: your-secret"
```

## 監視・運用

### Vercel Logs

- Vercel Dashboard → Logs でCronジョブの実行ログを確認
- エラー発生時の詳細を確認可能

### コスト管理

- 環境変数 `MAX_COST_PER_DAY_USD` でコスト上限を設定可能
- 各実行の token使用量と cost は `runs` テーブルに記録

### データベース管理

```bash
# Prisma Studio起動
npm run prisma:studio
```

ブラウザでデータベースの内容を確認・編集できます。

## トラブルシューティング

### Cronジョブが実行されない

1. Vercel Dashboard → Crons で実行履歴を確認
2. `CRON_SECRET` が正しく設定されているか確認
3. プロダクション環境でデプロイされているか確認

### OpenAI API エラー

1. `OPENAI_API_KEY` が有効か確認
2. API quota が残っているか確認
3. Vercel Logs でエラー詳細を確認

### データベース接続エラー

1. `DATABASE_URL` が正しく設定されているか確認
2. Vercel Postgres の接続制限に達していないか確認
3. SSL接続が有効になっているか確認 (`?sslmode=require`)

## ライセンス

Private Project
