# ResearchBridge

産学連携マッチングプラットフォーム — 研究者と企業をAI意味的マッチングで繋ぐ。

## プロジェクト構成

```
research-bridge/
├── frontend/          # Next.js 14 App Router + TypeScript + Tailwind CSS
├── backend/           # FastAPI (Python) + pgvector
├── docker-compose.yml
├── .env.example
└── .gitignore
```

## 起動方法

```bash
# 環境変数ファイルを準備
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env

# 必要な値を編集（OPENAI_API_KEY など）
vim .env

# Docker で全サービスを起動
docker-compose up -d
```

| サービス | URL |
|---|---|
| フロントエンド | http://localhost:3000 |
| バックエンド API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 14 (App Router) / TypeScript / Tailwind CSS |
| 認証 | NextAuth.js |
| バックエンド | FastAPI / Python 3.12 |
| データベース | PostgreSQL 16 + pgvector |
| Embedding | OpenAI text-embedding-3-small |
| デプロイ | Vercel (frontend) / Railway (backend) |

## 開発ドキュメント

- [フロントエンド詳細](./frontend/README.md)
- [バックエンド詳細](./backend/README.md)
- [要件定義書](./SPEC.md)

## 付録：障壁
最大の技術的苦労は、研究者と企業の間に存在する語彙の非対称性であった。当初はキーワード検索で実装したが、研究者は学術用語で、企業は事業用語で同じ技術を表現するため、語句の一致率が低く実用的なマッチング精度を得られなかった。この課題に対し、①手動カテゴリ分類、②キーワード検索の改良、③自然言語の意味的ベクトル検索の3案を比較検討した。①はスケーラビリティに欠け、②は語彙の壁を本質的に解決できないと判断し、異なる語彙で記述された同一概念を意味空間上で結びつけられる③を採用した。具体的にはOpenAI Embeddings APIでテキストを1536次元のベクトルに変換し、pgvectorでコサイン類似度検索を行う構成とした。さらに、研究概要の記述量が少ない場合にベクトルの情報量が不足する問題に対しては、入力テキストにキーワードを補強する前処理を加えることで精度を改善した。本開発においてAIは、人手では橋渡しできない語彙の壁を技術的に突破する中核手段として機能した。
