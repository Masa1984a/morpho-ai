# システム要件定義書

**プロジェクト名**：Crypto Insight Ingestor（WLD / USDC / WBTC / WETH）
**デプロイ先**：Vercel（Next.js）
**DB**：Vercel 統合のPostgres（Marketplace 経由）
**モデル**：OpenAI GPT-5（Responses API / web_search ツール使用）

---

## 1. 目的・スコープ

* **目的**
  4資産（$WLD, $USDC, $WBTC, $WETH）について、

  1. コイン概要、2) 直近1日の市況、3) 直近30日の市況、4) 今後の展望
     を **OpenAI API（Responses API）** へ問い合わせ、**web 検索付きの自動調査**で要約生成し、**DB に保存**。保存内容を **公開/社内API** で検索参照可能にする。
* **スコープ**

  * 自動収集・要約生成（Cron）
  * データ永続化（Postgres）
  * 参照用 API（REST）
  * モデル／ツール設定、セキュリティ、監視、コスト・制限対策

> 備考：OpenAI **Responses API** は **web search** をツールとして呼び出せるため、この要件に適します（例コード・解説あり）。([openai.com][1])
> DB は Vercel で **Postgres をMarketplace統合**として接続するのが推奨（旧「Vercel Postgres」は2025/06にMarketplace統合へ移行）。([Vercel][2])
> スケジューリングは **Vercel Cron Jobs** を使用。([Vercel][3])

---

## 2. 成果物

* Next.js（App Router）アプリ（/api 以下にエンドポイント）
* Cron による **1日1回（30日集計）** と **1時間ごと（1日市況）** の収集ジョブ
* Postgres スキーマ（Prisma 併用）
* 参照APIの OpenAPI 3.1 定義
* 運用・監視（Vercel Logs、OpenAI トレース）

---

## 3. 非機能要件（NFR）

* **可用性**：API 稼働 99.9%（Vercel/DB のSLAに準拠）
* **性能**：参照 API P95 < 300ms（キャッシュヒット時、Edge Runtime 活用可）、コールド時 < 1.5s
* **保守性**：IaC（環境変数・Cron・DB 接続設定）、README と Runbook 整備
* **セキュリティ**：API Key/Bearer、CORS 制限、PII 非保持、最小権限（DB/環境変数）
* **監査性**：各収集ジョブの実行ログ・失敗時のリトライ履歴・出典（URL）を保存
* **コスト**：1日あたり モデル利用＋DB＋Vercel 実行の上限予算を環境変数で制御

---

## 4. アーキテクチャ概要

```
[ Vercel Cron ]  ---->  /api/ingest/hourly   ┐
                      -> /api/ingest/daily    ├--> [OpenAI Responses API (web_search tool)]
                                                 (モデル: gpt-5 系 / reasoning&verbosity制御)
                                                 ｜
                                                 ↓
                                         [ Normalize/Validate ]
                                                 ↓
                                        [ Vercel Postgres ]
                                                 ↑
[ Client / Internal tools ] --->  /api/assets, /api/summary, /api/prices ...
```

* **OpenAI**：Responses API で **web_search ツール**を有効化し、最新情報と**引用付き回答**を取得可能（プレビュー→本番化の流れあり）。GPT-5 は API で `gpt-5 / gpt-5-mini / gpt-5-nano` が公開。`reasoning.effort` と `verbosity` を調整可能。([openai.com][1])
* **Cron**：Vercel の Cron でスケジュール。1プロジェクト20ジョブ制限あり。([Vercel][4])
* **DB**：Vercel Marketplace統合の Postgres を接続（Neon等）。([Vercel][2])

---

## 5. データモデル（Postgres / Prisma）

### 5.1 主要テーブル

* `assets`：資産メタ

  * `id` (PK, uuid), `symbol` (unique, e.g. WLD), `name`, `category`(coin/stable/wrapped), `chains`(jsonb), `official_urls`(jsonb), `created_at`
* `runs`：収集実行

  * `id` (PK), `started_at`, `finished_at`, `kind`(hourly|daily), `status`(success|fail), `model`, `reasoning_effort`, `verbosity`, `token_in`, `token_out`, `cost_usd`, `error`
* `sources`：出典

  * `id`, `run_id`(FK), `asset_id`(FK), `url`, `title`, `domain`, `published_at`(nullable), `fetched_at`, `hash`, `relevance_score`(0-1)
* `summaries`：要約・展望

  * `id`, `run_id`(FK), `asset_id`(FK), `overview_md`, `market_1d_md`, `market_30d_md`, `outlook_md`, `confidence`(0-1), `citations`(text[] of `sources.id`)
* `prices`：価格・指標スナップショット（任意：別APIで補完可）

  * `id`, `asset_id`(FK), `ts`, `price_usd`, `market_cap_usd`(nullable), `volume_24h_usd`(nullable), `raw`(jsonb)
* `kvs`：軽量キャッシュ/フラグ

  * `key`(PK), `value`(jsonb), `updated_at`

> **メモ**：`sources` に出典URLを保存し、`summaries.citations` に紐付けて**引用可能な監査性**を確保（Responses API は web 検索結果にリンクを含められる）。([cookbook.openai.com][5])

### 5.2 Prisma スキーマ（抜粋）

```prisma
model Asset {
  id           String   @id @default(uuid())
  symbol       String   @unique
  name         String
  category     String
  chains       Json?
  officialUrls Json?
  createdAt    DateTime @default(now())
  summaries    Summary[]
  prices       Price[]
  sources      Source[]
}

model Run {
  id              String   @id @default(uuid())
  startedAt       DateTime @default(now())
  finishedAt      DateTime?
  kind            String   // 'hourly' | 'daily'
  status          String   // 'success' | 'fail'
  model           String
  reasoningEffort String?  // 'low' | 'medium' | 'high'
  verbosity       String?  // 'low' | 'medium' | 'high'
  tokenIn         Int?
  tokenOut        Int?
  costUsd         Decimal? @db.Decimal(10,4)
  error           String?
  summaries       Summary[]
  sources         Source[]
}

model Source {
  id         String   @id @default(uuid())
  runId      String
  assetId    String
  url        String
  title      String?
  domain     String?
  publishedAt DateTime?
  fetchedAt  DateTime @default(now())
  hash       String?
  relevanceScore Float?
  run        Run     @relation(fields: [runId], references: [id])
  asset      Asset   @relation(fields: [assetId], references: [id])
}

model Summary {
  id           String   @id @default(uuid())
  runId        String
  assetId      String
  overviewMd   String
  market1dMd   String
  market30dMd  String
  outlookMd    String
  confidence   Float?
  citations    String[] // array of Source.id
  run          Run     @relation(fields: [runId], references: [id])
  asset        Asset   @relation(fields: [assetId], references: [id])
}

model Price {
  id         String   @id @default(uuid())
  assetId    String
  ts         DateTime @index
  priceUsd   Decimal  @db.Decimal(18,8)
  marketCapUsd Decimal? @db.Decimal(18,2)
  volume24hUsd Decimal? @db.Decimal(18,2)
  raw        Json?
  asset      Asset   @relation(fields: [assetId], references: [id])
}

model Kv {
  key       String  @id
  value     Json?
  updatedAt DateTime @default(now())
}
```

---

## 6. 調査・生成ロジック（OpenAI Responses API）

### 6.1 モデル・ツール設定

* **モデル**：`gpt-5`（API向け reasoning モデル）、または `gpt-5-mini`（低コスト版）。`reasoning.effort`（`low|medium|high`）と `verbosity`（`low|medium|high`）を調整。([openai.com][6])
* **ツール**：`web_search`（Responses APIのビルトインツール）。**最新情報＋出典リンク**付きの回答が可能。必要に応じて **ドメイン許可リスト**（allowed_domains）や**ロケール**を付与。([openai.com][1])

  * 例：WLD → `worldcoin.org`, `blog.worldcoin.org`, 有力メディア（`coindesk.com` 等）、USDC → `circle.com` など
  * 注意：ツールの提供・対応モデルは段階的ロールアウトのため、実装時にドキュメントで確認のこと（`type: web_search`/`web_search_preview` など）。([openai.com][1])

### 6.2 プロンプト仕様（サマリ生成用）

* **system**：
  「あなたは仮想通貨のアナリスト。各資産について**(1)概要, (2)直近1日, (3)直近30日, (4)今後の展望**を日本語で厳密に要約。**確実に `web_search` を用いて**最新情報を収集し、**段落ごとに出典URLを明記**。価格や時価総額など定量は可能な範囲で数値・日付・UTCタイムスタンプを付与。推測は避け、曖昧な場合は「不明」と記載。」
* **input**：
  資産リスト、対象期間、出典の優先度（公式ドキュメント＞大手メディア＞ブログ）、**出力フォーマット（Markdown）** 仕様
* **tool_choice**：`auto`
* **include**：`["web_search_call.action.sources"]`（取得ソースの列挙が必要な場合）

> Responses API の web search は **引用リンクを含む**結果を返せます。([cookbook.openai.com][5])

---

## 7. スケジューリング（Vercel Cron）

* **hourly**：`/api/ingest/hourly`（毎時00分）— 直近1日市況の更新
* **daily**：`/api/ingest/daily`（毎日 06:05 UTC）— 直近30日の要約更新＋月次ロールアップ
* 設定方法：`vercel.json` の `crons` を使用（プロダクションのみ実行、ログ/再実行/並列制御の注意点あり）。([Vercel][7])
* **ジョブ制限**：プロジェクト20ジョブ／アカウントプラン上限に留意。([Vercel][4])

---

## 8. 参照 API（REST）

### 8.1 エンドポイント一覧

* `GET /api/assets`：登録資産（symbol, name, category, last_update）
* `GET /api/assets/:symbol/summary`：最新サマリ（overview, market_1d, market_30d, outlook, citations, run_meta）
* `GET /api/assets/:symbol/prices?range=1d|30d&interval=hour|day`：価格系列
* `GET /api/runs/:id`：実行メタ（tokens, cost, status, error, sources 概要）

### 8.2 OpenAPI 3.1（抜粋）

```yaml
openapi: 3.1.0
info:
  title: Crypto Insight Ingestor API
  version: 1.0.0
paths:
  /api/assets/{symbol}/summary:
    get:
      summary: Get latest summary for an asset
      parameters:
        - in: path
          name: symbol
          required: true
          schema: { type: string, enum: [WLD, USDC, WBTC, WETH] }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  asset: { type: object, properties: { symbol: {type: string}, name: {type: string} } }
                  overview_md: { type: string }
                  market_1d_md: { type: string }
                  market_30d_md: { type: string }
                  outlook_md: { type: string }
                  confidence: { type: number, minimum: 0, maximum: 1 }
                  citations: { type: array, items: { type: string, description: "Source ID" } }
                  sources:
                    type: array
                    items:
                      type: object
                      properties:
                        id: { type: string }
                        url: { type: string, format: uri }
                        title: { type: string }
                        domain: { type: string }
                        published_at: { type: string, format: date-time }
                        relevance_score: { type: number }
        "404": { description: Not Found }
```

### 8.3 CORS / 認可

* 既定は **社内利用**：`Authorization: Bearer <token>`
* 公開する場合は **特定オリジンのみ許可**（CORS）、**匿名アクセスは読み取り限定**でレート制限

---

## 9. 実装詳細（Next.js / Edge & Node Runtimes）

* `/api/ingest/hourly` & `/api/ingest/daily`：**Node.js runtime**（OpenAI SDK 利用、Postgres 書込み）
* `/api/assets/*`：**Edge runtime**（読み取り高速化、DB は HTTP connection pooling 経由 or serverless driver）
* OpenAI 呼び出しは **Responses API**（web_search ツール）。**モデル**は `gpt-5` を基本、コストに応じて `gpt-5-mini` 切替。([openai.com][6])
* 失敗時は指数バックオフ＋最大3回リトライ。**web_search** が失敗・制限時は **一時的に過去 run の再掲**で降格（DB の最新成功分）。

> 参考：Responses API により、**内蔵ツール（web search ほか）**を一括で扱えます。([openai.com][1])

---

## 10. 収集処理シーケンス

1. Cron → `/api/ingest/<kind>` 起動
2. `runs` に行を作成（status=pending）
3. OpenAI Responses API 呼び出し

   * `model: "gpt-5"`, `tools: [{type: "web_search", filters: {allowed_domains: [...]}}]`
   * `input` に資産ごとの指示（各セクションの出力要求、数値と日付の必須化、Markdown）
4. 応答から

   * **本文（Markdown）**：`summaries` へ
   * **引用リンク**：`sources` へ正規化保存（title, domain, published_at 推定）
5. 価格情報（任意）：同レスポンスの記載値を保存、または別途価格APIで補完し `prices` 更新
6. `runs` 更新（tokens, cost, status）
7. 参照 API キャッシュ無効化（再計算）

---

## 11. 出力フォーマット（Markdown → API）

* 段落構成（資産ごと）：

  * `## Overview`（固定情報＋主要仕様リンク）
  * `## Last 24h`（価格推移/出来事の要点・日付・数値）
  * `## Last 30d`（トレンド・ボラティリティ・主要イベント）
  * `## Outlook`（ファンダ/技術・リスク・不確実性・**推測は明示**）
  * 各節の末尾に `[source]` リスト（URL）
* API は Markdown を**そのまま返す**か、必要に応じてフロントで HTML へ

---

## 12. エラーハンドリング & 品質保証

* **OpenAI 側**：429/5xx → バックオフ再試行、`background=true` は使用しない（Cron実行時間管理のため）。([openai.com][8])
* **出典検証**：URL 正規化・重複排除・ドメイン健全性チェック（許可リスト優先）
* **完全性チェック**：4節が**全て埋まっている**こと、日付/数値の基本妥当性
* **落ち穂拾い**：どれかの節が欠落→その節のみ **再問い合わせ**（1回）
* **監査**：`runs` に token/cost、`sources` に relevance_score を格納

---

## 13. セキュリティ

* **環境変数**（Vercel Env）：`OPENAI_API_KEY`, `DATABASE_URL`, `API_BEARER_TOKENS`, `CRON_SECRET`
* **API 認可**：Bearer 方式、Cron 用に `x-cron-secret` ヘッダ検証
* **CORS**：本番オリジンのみ許可、`GET` のみ公開可
* **データ**：PII 非保持、出典の引用はリンク＋短い要旨のみ
* **OpenAI 側のデータ取り扱い**：**企業データを学習に使用しない**旨が明記。([openai.com][1])

---

## 14. 監視・運用

* **Vercel Logs**：Cron 実行ログ、関数のエラー・所要時間監視（Cron 管理の注意点に準拠）。([Vercel][9])
* **OpenAI トレース/評価**：Responses API の**統合オブザーバビリティ**で実行可視化。([openai.com][1])
* **アラート**：連続失敗（3回）・トークン急増・コスト閾値超えでSlack/Webhook通知（別関数）

---

## 15. コスト & 制限（目安）

* **モデル**：`gpt-5`（mini 併用）＋ `web_search` の課金（Tokens + tool利用）。最新の**価格ページ**を参照して変数化。([openai.com][1])
* **Cron**：プランと関数実行回数に従う（ジョブ数上限に留意）。([Vercel][4])
* **最適化**：

  * `reasoning.effort: "low"` と `verbosity: "low"` を**hourly**で使用、**daily**は `"medium"`
  * 許可ドメインで検索範囲を限定し**無駄なスクレイプを抑制**
  * 参照 API は Edge でキャッシュ（秒TTL）

---

## 16. デプロイ手順（要点）

1. Vercel でプロジェクト作成／GitHub 連携
2. Storage → **Postgres 接続**を作成（Marketplace 統合）し `DATABASE_URL` を設定。([Vercel][2])
3. `OPENAI_API_KEY` 等の環境変数を設定
4. Prisma `migrate deploy`（ビルド時）
5. `vercel.json` に Cron を定義して再デプロイ。([Vercel][7])

---

## 17. サンプル：OpenAI 呼び出し（概念コード）

```ts
const resp = await openai.responses.create({
  model: "gpt-5",
  reasoning: { effort: "low" },
  // 出典品質/地域性に応じて filters や user_location を付与
  tools: [{ type: "web_search", /* filters: { allowed_domains: [...] } */ }],
  tool_choice: "auto",
  include: ["web_search_call.action.sources"],
  input: `
Generate markdown with sections: Overview, Last 24h, Last 30d, Outlook
Asset: ${symbol}
Locale: ja-JP
Rules:
- Use web_search to fetch latest info and include citations at end of each section.
- Use UTC timestamps for dates; include numbers with units.
`
})
```

> **参考**：web_search ツールは Responses API の**ホストツール**として公式に案内。([cookbook.openai.com][5])

---

## 18. テスト計画

* **ユニット**：OpenAI 呼び出しのモック、Markdown→保存の正規化
* **結合**：Cron→OpenAI→DB→API まで e2e（Staging）
* **プロンプト回帰**：主要ニュースが無い日の挙動、引用未取得時のフォールバック
* **負荷**：参照 API の P95、DB インデックス（`prices.ts`, `summaries.asset_id`）

---

## 19. リスクと対応

* **ツール提供の変更**（`web_search` の仕様・対応モデル）

  * → 実装時に公式ドキュメントで再確認（`web_search` / `web_search_preview`）。([openai.com][1])
* **コスト急増**（長文出力・冗長検索）

  * → `verbosity`/`effort`/許可ドメインで制御、1ジョブ当たり上限トークンで打切り
* **情報の正確性**

  * → 複数ソースの合意、数値は日付付き、**確度スコア**と「不明」明示

---

## 20. 将来拡張

* **Vercel AI Gateway** 経由でベンダーフェイルオーバー・レート管理・可観測性強化。([Vercel][10])
* **Agents SDK / MCP** による外部ツール連携（取引所APIや社内データ等）。([openai.com][8])
* **可視化UI**（Next.js + Charts）と webhook 通知（変化検知）

---

### 参考リンク（仕様根拠）

* **Responses API & web search**：新ツール群発表／web検索の実例・出典付き回答（OpenAI 公式）([openai.com][1])
* **GPT-5（API向けモデル、パラメータ）**（OpenAI 公式）([openai.com][6])
* **Vercel Cron Jobs**（クイックスタート／管理／制限）([Vercel][7])
* **Vercel の Postgres 統合（Marketplace）**（ドキュメント／移行情報）([Vercel][2])

---

必要であれば、この要件定義から **Prisma スキーマの完全版**や **Next.js の API ルート雛形**、**OpenAPI 定義の実体** まで一気に書き起こします。

[1]: https://openai.com/index/new-tools-for-building-agents/ "New tools for building agents | OpenAI"
[2]: https://vercel.com/docs/postgres?utm_source=chatgpt.com "Postgres on Vercel"
[3]: https://vercel.com/docs/cron-jobs?utm_source=chatgpt.com "Cron Jobs - Vercel"
[4]: https://vercel.com/docs/cron-jobs/usage-and-pricing?utm_source=chatgpt.com "Usage & Pricing for Cron Jobs - Vercel"
[5]: https://cookbook.openai.com/examples/responses_api/responses_example "Web Search and States with Responses API"
[6]: https://openai.com/index/introducing-gpt-5-for-developers/?utm_source=chatgpt.com "Introducing GPT‑5 for developers - OpenAI"
[7]: https://vercel.com/docs/cron-jobs/quickstart?utm_source=chatgpt.com "Getting started with cron jobs - Vercel"
[8]: https://openai.com/index/new-tools-and-features-in-the-responses-api/ "New tools and features in the Responses API | OpenAI"
[9]: https://vercel.com/docs/cron-jobs/manage-cron-jobs?utm_source=chatgpt.com "Managing Cron Jobs - Vercel"
[10]: https://vercel.com/docs/ai-gateway?utm_source=chatgpt.com "AI Gateway"
