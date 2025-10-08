# クイックデプロイガイド

## 1. Vercelにデプロイ

```bash
vercel
```

質問に答える：
- Set up and deploy? → **Y**
- Which scope? → あなたのアカウント
- Link to existing project? → **N**
- Project name? → **crypto-insight-ingestor**
- Code directory? → **.**
- Modify settings? → **N**

## 2. Postgres データベースを作成

### Vercel Dashboard から作成

1. https://vercel.com/dashboard にアクセス
2. プロジェクト `crypto-insight-ingestor` を選択
3. **Storage** タブ → **Create Database**
4. **Postgres** を選択
5. データベース名: `crypto-insight-db`
6. リージョン: **us-east-1**（または近いリージョン）
7. **Create** をクリック
8. **Connect** でプロジェクトに接続

これで `DATABASE_URL` が自動的に環境変数に追加されます。

## 3. 必須の環境変数を設定

Vercel Dashboard → Settings → Environment Variables で以下を追加：

### OPENAI_API_KEY
```
sk-proj-...
```
- 環境: Production, Preview, Development

### CRON_SECRET
```bash
# ランダムな文字列を生成（32文字以上推奨）
openssl rand -base64 32
```
- 環境: Production

### API_BEARER_TOKENS
```
token1,token2,token3
```
（任意のトークンをカンマ区切りで設定）
- 環境: Production, Preview, Development

## 4. プロダクションにデプロイ

```bash
vercel --prod
```

## 5. データベースをセットアップ

### オプションA: ローカルから実行

```bash
# Vercel の DATABASE_URL を取得
vercel env pull .env.local

# マイグレーション実行
npx prisma migrate deploy

# 初期データ投入
npm run prisma:seed
```

### オプションB: 一時的なAPIエンドポイントを作成

src/app/api/setup/route.ts を作成して、ブラウザからアクセスして実行

## 6. 動作確認

### Cronジョブを手動実行

```bash
export DEPLOY_URL="https://your-project.vercel.app"
export CRON_SECRET="your-cron-secret"

# Hourly バッチ実行
curl -X POST "$DEPLOY_URL/api/ingest/hourly" \
  -H "x-cron-secret: $CRON_SECRET"
```

### API確認

```bash
export BEARER_TOKEN="your-token"

# 資産一覧
curl "$DEPLOY_URL/api/assets" \
  -H "Authorization: Bearer $BEARER_TOKEN"
```

## トラブルシューティング

### ビルドエラー
- Vercel Dashboard → Deployments → 最新のデプロイ → Logs を確認

### データベース接続エラー
- DATABASE_URL が正しく設定されているか確認
- Vercel Dashboard → Storage で接続状態を確認

### Cronが実行されない
- プロダクション環境にデプロイされているか確認
- Vercel Dashboard → Crons でステータス確認

## 完了！

デプロイが完了すると：
- トップページ: https://your-project.vercel.app
- API: https://your-project.vercel.app/api/*
- Cron: 自動実行（hourly, daily）
