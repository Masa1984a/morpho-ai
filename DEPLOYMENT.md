# デプロイガイド

## Vercelへのデプロイ手順

### 前提条件

- Vercelアカウント
- GitHubリポジトリ（推奨）
- OpenAI APIキー

### ステップ1: Vercelプロジェクト作成

#### オプションA: GitHub連携（推奨）

1. GitHubにリポジトリを作成してコードをプッシュ
2. [Vercel Dashboard](https://vercel.com/dashboard)にアクセス
3. "Add New..." → "Project" をクリック
4. GitHubリポジトリを選択してインポート

#### オプションB: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
```

### ステップ2: Postgres データベース作成

1. Vercel Dashboard → プロジェクトを選択
2. "Storage" タブをクリック
3. "Create Database" → "Postgres" を選択
4. データベース名を入力（例: `crypto-insight-db`）
5. リージョンを選択（推奨: us-east-1）
6. "Create" をクリック

データベースが作成されると、`DATABASE_URL` が自動的に環境変数に追加されます。

### ステップ3: 環境変数の設定

Vercel Dashboard → Settings → Environment Variables で以下を追加：

#### 必須の環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | PostgreSQL接続URL | 自動設定済み |
| `OPENAI_API_KEY` | OpenAI APIキー | `sk-proj-...` |
| `CRON_SECRET` | Cron認証用シークレット | ランダムな文字列（32文字以上推奨） |
| `API_BEARER_TOKENS` | API認証用トークン（カンマ区切り） | `token1,token2,token3` |

#### 推奨の環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|------------|
| `MAX_TOKENS_PER_JOB` | ジョブあたりの最大トークン数 | 10000 |
| `MAX_COST_PER_DAY_USD` | 1日あたりの最大コスト（USD） | 50.00 |

### ステップ4: データベースのマイグレーション

デプロイ時に自動的に実行されますが、手動で実行する場合：

```bash
# ローカルで DATABASE_URL を設定
export DATABASE_URL="postgresql://..."

# マイグレーション実行
npx prisma migrate deploy

# 初期データ投入
npm run prisma:seed
```

### ステップ5: デプロイ

#### GitHubから自動デプロイ

mainブランチにプッシュすると自動的にデプロイされます。

#### CLIから手動デプロイ

```bash
vercel --prod
```

### ステップ6: Cronジョブの確認

1. Vercel Dashboard → プロジェクトを選択
2. "Cron Jobs" タブをクリック
3. 以下の2つのジョブが表示されることを確認：
   - `/api/ingest/hourly` - 毎時00分
   - `/api/ingest/daily` - 毎日06:05 UTC

**注意**: Cronジョブはプロダクション環境でのみ実行されます。

### ステップ7: 初回実行テスト

Cronの自動実行を待たずに、手動でジョブを実行してテスト：

```bash
# デプロイしたURLを使用
export DEPLOY_URL="https://your-project.vercel.app"
export CRON_SECRET="your-cron-secret"

# Hourly バッチを手動実行
curl -X POST "$DEPLOY_URL/api/ingest/hourly" \
  -H "x-cron-secret: $CRON_SECRET"

# Daily バッチを手動実行
curl -X POST "$DEPLOY_URL/api/ingest/daily" \
  -H "x-cron-secret: $CRON_SECRET"
```

### ステップ8: API動作確認

```bash
export DEPLOY_URL="https://your-project.vercel.app"
export BEARER_TOKEN="your-bearer-token"

# 資産一覧取得
curl "$DEPLOY_URL/api/assets" \
  -H "Authorization: Bearer $BEARER_TOKEN"

# WLDのサマリ取得
curl "$DEPLOY_URL/api/assets/WLD/summary" \
  -H "Authorization: Bearer $BEARER_TOKEN"
```

## トラブルシューティング

### ビルドエラー

```
Error: Cannot find module '@prisma/client'
```

**解決方法**: `package.json` の build スクリプトを確認：

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

### データベース接続エラー

```
Error: P1001 - Can't reach database server
```

**解決方法**:
1. `DATABASE_URL` が正しく設定されているか確認
2. Vercel Postgres の接続制限に達していないか確認
3. SSL接続が有効か確認（`?sslmode=require`）

### Cronジョブが実行されない

**確認ポイント**:
1. プロダクション環境にデプロイされているか
2. `CRON_SECRET` が設定されているか
3. Vercel Dashboard → Cron Jobs でステータス確認

### OpenAI APIエラー

```
Error: 429 - Rate limit exceeded
```

**解決方法**:
1. OpenAI ダッシュボードでレート制限を確認
2. `reasoning_effort` を "low" に設定してトークン数を削減
3. 一時的にCronの実行頻度を下げる

## コスト最適化

### 推奨設定

1. **Hourly バッチ**:
   - `reasoning_effort: "low"`
   - `verbosity: "low"`
   - 実行頻度: 毎時（変更可能）

2. **Daily バッチ**:
   - `reasoning_effort: "medium"`
   - `verbosity: "medium"`
   - 実行頻度: 毎日1回

### モニタリング

```bash
# 最近の実行コストを確認
curl "$DEPLOY_URL/api/runs/{latest_run_id}" \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  | jq '.cost_usd'
```

## スケーリング

### Vercel プラン

- **Hobby**: 個人プロジェクト向け（制限あり）
- **Pro**: 本番運用推奨（Cron 20ジョブまで）
- **Enterprise**: 大規模運用向け

### データベース

- Vercel Postgres は接続数に制限あり
- 大量のリクエストが予想される場合は Connection Pooling を検討

## セキュリティチェックリスト

- [ ] `CRON_SECRET` が強力なランダム文字列
- [ ] `API_BEARER_TOKENS` がユニークで推測困難
- [ ] `OPENAI_API_KEY` が環境変数として安全に保存
- [ ] CORS設定が適切に制限されている
- [ ] 本番環境でのログレベルが適切

## 次のステップ

1. **監視設定**: Vercel Logs + 外部監視ツール（DataDog, Sentryなど）
2. **アラート設定**: エラー発生時のSlack/Email通知
3. **バックアップ**: データベースの定期バックアップ設定
4. **ドキュメント**: API仕様の公開（OpenAPI）
