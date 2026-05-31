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
