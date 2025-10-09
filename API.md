# Crypto Insight Ingestor API 仕様書

暗号資産（WLD, USDC, WBTC, WETH）の最新情報を取得するためのREST API

## 基本情報

| 項目 | 値 |
|------|-----|
| **Base URL** | `https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app` |
| **プロトコル** | HTTPS |
| **データ形式** | JSON |
| **文字エンコーディング** | UTF-8 |
| **タイムゾーン** | UTC |
| **対応言語** | English (en), 日本語 (ja), 简体中文 (zh-CN), 繁體中文 (zh-TW), 한국어 (ko), ไทย (th), Português (pt), Español (es) |

## 認証

全てのエンドポイントは Bearer Token 認証が必要です。

### リクエストヘッダー

```
Authorization: Bearer CTS_TOKENS_20251008
```

### 認証エラー

認証に失敗した場合、`401 Unauthorized` が返されます。

```json
{
  "error": "Unauthorized"
}
```

---

## エンドポイント一覧

### 1. 資産一覧取得

登録されている全ての暗号資産の情報を取得します。

#### エンドポイント

```
GET /api/assets
```

#### リクエスト例

```bash
curl -X GET "https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app/api/assets" \
  -H "Authorization: Bearer CTS_TOKENS_20251008"
```

#### レスポンス

**Status Code**: `200 OK`

```json
{
  "assets": [
    {
      "id": "1e0e4fc2-671b-4c96-8c41-5e2b934007f5",
      "symbol": "WLD",
      "name": "Worldcoin",
      "category": "coin",
      "chains": {
        "networks": ["Ethereum", "Optimism"]
      },
      "officialUrls": {
        "website": "https://worldcoin.org",
        "blog": "https://blog.worldcoin.org",
        "docs": "https://docs.worldcoin.org"
      },
      "createdAt": "2025-10-08T13:20:05.859Z",
      "lastUpdate": "2025-10-08T13:29:53.787Z"
    },
    {
      "id": "ea86debe-a4bb-494a-9e3d-53bdb2619005",
      "symbol": "USDC",
      "name": "USD Coin",
      "category": "stable",
      "chains": {
        "networks": ["Ethereum", "Polygon", "Avalanche", "Solana"]
      },
      "officialUrls": {
        "website": "https://www.circle.com/en/usdc",
        "docs": "https://developers.circle.com"
      },
      "createdAt": "2025-10-08T13:20:05.869Z",
      "lastUpdate": "2025-10-08T13:30:15.303Z"
    }
  ]
}
```

#### レスポンスフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `assets` | Array | 資産の配列 |
| `assets[].id` | String (UUID) | 資産の一意識別子 |
| `assets[].symbol` | String | ティッカーシンボル（WLD, USDC, WBTC, WETH） |
| `assets[].name` | String | 資産の正式名称 |
| `assets[].category` | String | カテゴリ（`coin`, `stable`, `wrapped`） |
| `assets[].chains` | Object | 対応ブロックチェーンの情報 |
| `assets[].officialUrls` | Object | 公式URLのリスト |
| `assets[].createdAt` | String (ISO 8601) | 登録日時 |
| `assets[].lastUpdate` | String (ISO 8601) | 最終更新日時（null の場合あり） |

---

### 2. 資産サマリ取得

特定の資産の最新サマリ（概要、市況、展望）を取得します。

#### エンドポイント

```
GET /api/assets/{symbol}/summary
```

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `symbol` | String | ✅ | 資産シンボル（`WLD`, `USDC`, `WBTC`, `WETH`） |

#### クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `lang` | String | ❌ | `en` | 言語コード（`en`, `ja`, `zh-CN`, `zh-TW`, `ko`, `th`, `pt`, `es`） |

#### リクエスト例

```bash
# 英語でサマリ取得（デフォルト）
curl -X GET "https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app/api/assets/WLD/summary" \
  -H "Authorization: Bearer CTS_TOKENS_20251008"

# 日本語でサマリ取得
curl -X GET "https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app/api/assets/WLD/summary?lang=ja" \
  -H "Authorization: Bearer CTS_TOKENS_20251008"

# 簡体字中国語でサマリ取得
curl -X GET "https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app/api/assets/WLD/summary?lang=zh-CN" \
  -H "Authorization: Bearer CTS_TOKENS_20251008"
```

#### レスポンス

**Status Code**: `200 OK`

```json
{
  "asset": {
    "id": "1e0e4fc2-671b-4c96-8c41-5e2b934007f5",
    "symbol": "WLD",
    "name": "Worldcoin",
    "category": "coin"
  },
  "overview_md": "- 基本情報：Worldcoin（ティッカー：WLD）は、OpenAI CEOサム・アルトマン氏が共同設立...",
  "market_1d_md": "- 価格推移：2025年10月8日時点でWLDは1.18USD。24時間で-10.19%の下落...",
  "market_30d_md": "- トレンド：2025年9月8日～10月8日の30日間で、最安値0.91USD...",
  "outlook_md": "- ファンダメンタル分析：World IDによるデジタルID認証需要の増加...",
  "confidence": 0.7,
  "citations": [
    "defdf2bf-55f9-4f35-ba58-c017c12db597",
    "ea054d56-640b-4b52-acbc-8a557586a055"
  ],
  "sources": [
    {
      "id": "defdf2bf-55f9-4f35-ba58-c017c12db597",
      "url": "https://www.kraken.com/prices/worldcoin",
      "title": null,
      "domain": "www.kraken.com",
      "publishedAt": null,
      "relevanceScore": 0.5
    }
  ],
  "run_meta": {
    "id": "265b5be0-7dee-4742-b687-e73a01114c80",
    "kind": "hourly",
    "model": "gpt-4-turbo-preview",
    "started_at": "2025-10-08T13:29:23.690Z",
    "finished_at": "2025-10-08T13:31:17.354Z",
    "token_in": 38344,
    "token_out": 6271,
    "cost_usd": "0.5716"
  },
  "created_at": "2025-10-08T13:29:53.787Z"
}
```

#### レスポンスフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `asset` | Object | 資産の基本情報 |
| `language` | String | コンテンツの言語コード（`en`, `ja`, `zh-CN`, `zh-TW`, `ko`, `th`, `pt`, `es`） |
| `overview_md` | String | 概要（Markdown形式、指定言語） |
| `market_1d_md` | String | 直近24時間の市況（Markdown形式、指定言語） |
| `market_30d_md` | String | 直近30日の市況（Markdown形式、指定言語） |
| `outlook_md` | String | 今後の展望（Markdown形式、指定言語） |
| `confidence` | Number (0-1) | 信頼度スコア |
| `citations` | Array | 引用元ソースIDの配列 |
| `sources` | Array | 出典URLの詳細 |
| `run_meta` | Object | 実行メタデータ |
| `created_at` | String (ISO 8601) | サマリ生成日時 |

#### エラーレスポンス

**Status Code**: `404 Not Found`

```json
{
  "error": "Asset not found"
}
```

または

```json
{
  "error": "No summary available for this asset"
}
```

---

### 3. 価格系列取得

特定の資産の価格履歴を取得します。

#### エンドポイント

```
GET /api/assets/{symbol}/prices
```

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `symbol` | String | ✅ | 資産シンボル（`WLD`, `USDC`, `WBTC`, `WETH`） |

#### クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `range` | String | ❌ | `1d` | 期間（`1d`: 1日、`30d`: 30日） |
| `interval` | String | ❌ | `hour` | 間隔（`hour`: 時間ごと、`day`: 日ごと） |

#### リクエスト例

```bash
# 直近24時間の価格（1時間ごと）
curl -X GET "https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app/api/assets/WLD/prices?range=1d&interval=hour" \
  -H "Authorization: Bearer CTS_TOKENS_20251008"

# 直近30日の価格（1日ごと）
curl -X GET "https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app/api/assets/USDC/prices?range=30d&interval=day" \
  -H "Authorization: Bearer CTS_TOKENS_20251008"
```

#### レスポンス

**Status Code**: `200 OK`

```json
{
  "asset": {
    "symbol": "WLD",
    "name": "Worldcoin"
  },
  "range": "1d",
  "interval": "hour",
  "count": 24,
  "prices": [
    {
      "id": "c3d5e789-1234-5678-90ab-cdef12345678",
      "ts": "2025-10-07T14:00:00.000Z",
      "priceUsd": "1.25000000",
      "marketCapUsd": "1500000000.00",
      "volume24hUsd": "50000000.00"
    },
    {
      "id": "d4e6f890-2345-6789-01bc-def123456789",
      "ts": "2025-10-07T15:00:00.000Z",
      "priceUsd": "1.23000000",
      "marketCapUsd": "1480000000.00",
      "volume24hUsd": "48000000.00"
    }
  ]
}
```

#### レスポンスフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `asset` | Object | 資産の基本情報 |
| `range` | String | 取得期間 |
| `interval` | String | データ間隔 |
| `count` | Number | 取得したデータポイント数 |
| `prices` | Array | 価格データの配列 |
| `prices[].id` | String (UUID) | データポイントID |
| `prices[].ts` | String (ISO 8601) | タイムスタンプ |
| `prices[].priceUsd` | String (Decimal) | USD建て価格 |
| `prices[].marketCapUsd` | String (Decimal) | 時価総額（null の場合あり） |
| `prices[].volume24hUsd` | String (Decimal) | 24時間取引高（null の場合あり） |

**注意**: 現在、価格データは外部APIから取得していないため、データが存在しない場合があります。

---

### 4. 実行メタ情報取得

バッチ実行の詳細情報を取得します。

#### エンドポイント

```
GET /api/runs/{id}
```

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | String (UUID) | ✅ | 実行ID（サマリレスポンスの `run_meta.id` から取得） |

#### リクエスト例

```bash
curl -X GET "https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app/api/runs/265b5be0-7dee-4742-b687-e73a01114c80" \
  -H "Authorization: Bearer CTS_TOKENS_20251008"
```

#### レスポンス

**Status Code**: `200 OK`

```json
{
  "id": "265b5be0-7dee-4742-b687-e73a01114c80",
  "kind": "hourly",
  "status": "success",
  "model": "gpt-4-turbo-preview",
  "reasoning_effort": "low",
  "verbosity": "low",
  "started_at": "2025-10-08T13:29:23.690Z",
  "finished_at": "2025-10-08T13:31:17.354Z",
  "token_in": 38344,
  "token_out": 6271,
  "cost_usd": "0.5716",
  "error": null,
  "summaries": {
    "count": 4,
    "items": [
      {
        "id": "abc123...",
        "assetId": "1e0e4fc2-...",
        "confidence": 0.7,
        "createdAt": "2025-10-08T13:29:53.787Z"
      }
    ]
  },
  "sources": {
    "count": 25,
    "unique_domains": 8,
    "domains": ["www.kraken.com", "www.ft.com", "blockchain.news"],
    "avg_relevance": 0.5
  }
}
```

#### レスポンスフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | String (UUID) | 実行ID |
| `kind` | String | 実行種別（`hourly`, `daily`） |
| `status` | String | ステータス（`success`, `fail`, `pending`） |
| `model` | String | 使用したAIモデル |
| `started_at` | String (ISO 8601) | 開始日時 |
| `finished_at` | String (ISO 8601) | 終了日時 |
| `token_in` | Number | 入力トークン数 |
| `token_out` | Number | 出力トークン数 |
| `cost_usd` | String (Decimal) | 実行コスト（USD） |
| `error` | String | エラーメッセージ（エラーがない場合はnull） |
| `summaries` | Object | 生成されたサマリの統計 |
| `sources` | Object | 取得した出典の統計 |

---

## 使用例

### JavaScript (fetch API)

```javascript
const BASE_URL = 'https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app';
const BEARER_TOKEN = 'CTS_TOKENS_20251008';

// 資産一覧取得
async function getAssets() {
  const response = await fetch(`${BASE_URL}/api/assets`, {
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`
    }
  });
  const data = await response.json();
  return data.assets;
}

// WLDのサマリ取得（英語）
async function getWLDSummary() {
  const response = await fetch(`${BASE_URL}/api/assets/WLD/summary`, {
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`
    }
  });
  return await response.json();
}

// WLDのサマリ取得（日本語）
async function getWLDSummaryJa() {
  const response = await fetch(`${BASE_URL}/api/assets/WLD/summary?lang=ja`, {
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`
    }
  });
  return await response.json();
}

// 使用例
getAssets().then(assets => {
  console.log('登録資産:', assets.map(a => a.symbol));
});

getWLDSummary().then(summary => {
  console.log('WLD概要 (English):', summary.overview_md);
});

getWLDSummaryJa().then(summary => {
  console.log('WLD概要 (日本語):', summary.overview_md);
});
```

### Python (requests)

```python
import requests

BASE_URL = 'https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app'
BEARER_TOKEN = 'CTS_TOKENS_20251008'

headers = {
    'Authorization': f'Bearer {BEARER_TOKEN}'
}

# 資産一覧取得
def get_assets():
    response = requests.get(f'{BASE_URL}/api/assets', headers=headers)
    response.raise_for_status()
    return response.json()['assets']

# USDCのサマリ取得（英語）
def get_usdc_summary(lang='en'):
    response = requests.get(f'{BASE_URL}/api/assets/USDC/summary?lang={lang}', headers=headers)
    response.raise_for_status()
    return response.json()

# 使用例
assets = get_assets()
print('登録資産:', [a['symbol'] for a in assets])

# 英語でサマリ取得
usdc_en = get_usdc_summary('en')
print('USDC 直近24時間 (English):', usdc_en['market_1d_md'])

# 日本語でサマリ取得
usdc_ja = get_usdc_summary('ja')
print('USDC 直近24時間 (日本語):', usdc_ja['market_1d_md'])
```

### PowerShell

```powershell
$BaseUrl = 'https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app'
$Headers = @{
    'Authorization' = 'Bearer CTS_TOKENS_20251008'
}

# 資産一覧取得
$assets = Invoke-RestMethod -Uri "$BaseUrl/api/assets" -Headers $Headers
$assets.assets | Format-Table symbol, name, lastUpdate

# WBTCのサマリ取得
$wbtc = Invoke-RestMethod -Uri "$BaseUrl/api/assets/WBTC/summary" -Headers $Headers
Write-Host $wbtc.overview_md
```

### cURL

```bash
# 環境変数設定
export API_URL="https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app"
export TOKEN="CTS_TOKENS_20251008"

# 資産一覧
curl -X GET "$API_URL/api/assets" \
  -H "Authorization: Bearer $TOKEN"

# WETHサマリ
curl -X GET "$API_URL/api/assets/WETH/summary" \
  -H "Authorization: Bearer $TOKEN"

# WLDの30日間価格
curl -X GET "$API_URL/api/assets/WLD/prices?range=30d&interval=day" \
  -H "Authorization: Bearer $TOKEN"
```

---

## データ更新頻度

| データ | 更新頻度 | 説明 |
|--------|---------|------|
| サマリ（全言語） | 4時間ごと（00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC） | 最新の市況分析を8言語で更新 |
| 価格データ | 未実装 | 現在は外部APIからの取得なし |

---

## エラーコード

| HTTPステータス | 説明 |
|---------------|------|
| `200 OK` | 成功 |
| `400 Bad Request` | リクエストパラメータが不正 |
| `401 Unauthorized` | 認証失敗（トークンが無効または未指定） |
| `404 Not Found` | リソースが見つからない |
| `500 Internal Server Error` | サーバーエラー |

---

## レート制限

現在、レート制限は設定されていませんが、過度なリクエストは控えてください。

---

## サポートされている資産

| シンボル | 名称 | カテゴリ |
|---------|------|----------|
| `WLD` | Worldcoin | coin |
| `USDC` | USD Coin | stable |
| `WBTC` | Wrapped Bitcoin | wrapped |
| `WETH` | Wrapped Ether | wrapped |

---

## 多言語サポート

### 対応言語

このAPIは8つの言語に対応しています：

| 言語コード | 言語名 | 説明 |
|-----------|--------|------|
| `en` | English | 英語（デフォルト） |
| `ja` | 日本語 | Japanese |
| `zh-CN` | 简体中文 | Simplified Chinese |
| `zh-TW` | 繁體中文 | Traditional Chinese |
| `ko` | 한국어 | Korean |
| `th` | ไทย | Thai |
| `pt` | Português | Portuguese |
| `es` | Español | Spanish |

### 翻訳の仕組み

1. **英語での情報収集**: まず英語で最新の暗号資産情報をウェブ検索により収集します
2. **AI翻訳**: 収集した英語コンテンツを各言語にAIで翻訳します
3. **言語ごとに個別のLLM呼び出し**: 各翻訳言語ごとに独立したLLM APIコールを実行します
4. **同一データソース**: 全ての言語版は同じ英語ソースから翻訳されるため、内容の一貫性が保証されます

### 使用方法

サマリ取得エンドポイントに `?lang={言語コード}` クエリパラメータを追加してください：

```bash
# 日本語
GET /api/assets/WLD/summary?lang=ja

# 簡体字中国語
GET /api/assets/WLD/summary?lang=zh-CN

# 韓国語
GET /api/assets/WLD/summary?lang=ko
```

### 注意事項

- 言語を指定しない場合、デフォルトで英語 (`en`) が返されます
- 無効な言語コードを指定した場合、`400 Bad Request` エラーが返されます
- 全ての言語版は同じタイミングで生成されます（4時間ごと：00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC）
- 翻訳の品質はAIモデルに依存しますが、専門用語の正確性を重視しています

---

## 注意事項

1. **タイムゾーン**: 全ての日時はUTCです
2. **Markdown形式**: サマリの各セクション（`overview_md`, `market_1d_md` 等）はMarkdown形式で返されます
3. **Decimal型**: 価格データは文字列型のDecimalで返されます（精度保持のため）
4. **null値**: 一部のフィールドはnullになる場合があります
5. **データの鮮度**: サマリは最大1時間前のデータの可能性があります
6. **多言語対応**: サマリは8言語で提供されます（`lang`パラメータで指定）

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-10-09 | 1.2.0 | データ更新を4時間ごとに変更、Dailyジョブを廃止 |
| 2025-10-09 | 1.1.0 | 多言語サポート追加（8言語対応：en, ja, zh-CN, zh-TW, ko, th, pt, es） |
| 2025-10-08 | 1.0.0 | 初版リリース |

---

## サポート

API に関する質問や問題がある場合は、プロジェクトのGitHubリポジトリでIssueを作成してください。

---

**Base URL**: https://morpho-jaidkqvl0-masanori-yoshidas-projects.vercel.app

**認証**: `Authorization: Bearer CTS_TOKENS_20251008`
