# ResearchBridge — Backend

FastAPI (Python 3.12) + PostgreSQL + pgvector

## ディレクトリ構成

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── auth.py         # AUTH-01〜04: 認証
│   │       │   ├── users.py        # ユーザー情報
│   │       │   ├── profiles.py     # PRF-R / PRF-C: プロフィール CRUD
│   │       │   ├── matching.py     # MATCH-01〜05: AIマッチング
│   │       │   ├── interests.py    # INT-01〜04: インタレスト
│   │       │   └── messages.py     # MSG-01〜03: メッセージ
│   │       └── router.py
│   ├── core/
│   │   ├── config.py               # 環境変数設定 (pydantic-settings)
│   │   ├── database.py             # SQLAlchemy エンジン・セッション
│   │   └── security.py            # JWT・bcrypt
│   ├── models/                     # SQLAlchemy ORM モデル
│   │   ├── user.py
│   │   ├── researcher_profile.py
│   │   ├── company_profile.py
│   │   ├── interest.py
│   │   ├── match.py
│   │   └── message.py
│   ├── schemas/                    # Pydantic スキーマ
│   │   ├── user.py
│   │   ├── profile.py
│   │   ├── matching.py
│   │   └── message.py
│   ├── services/
│   │   ├── embedding.py            # OpenAI Embedding 生成
│   │   ├── matching.py             # コサイン類似度・レコメンド算出
│   │   └── notification.py        # メール通知（Phase 2）
│   └── main.py                     # FastAPI アプリケーションエントリポイント
├── alembic/
│   └── versions/                   # マイグレーションファイル
├── tests/
├── .env.example
├── alembic.ini
├── Dockerfile
├── pyproject.toml
└── requirements.txt
```

## セットアップ

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# .env を編集（DATABASE_URL, OPENAI_API_KEY など）

# DBマイグレーション
alembic upgrade head

uvicorn app.main:app --reload
```

## 環境変数

| 変数名 | 説明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 接続 URL |
| `SECRET_KEY` | JWT 署名キー |
| `OPENAI_API_KEY` | OpenAI API キー |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT 有効期限（分）|

## API ドキュメント

起動後に http://localhost:8000/docs (Swagger UI) で確認できます。
