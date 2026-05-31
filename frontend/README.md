# ResearchBridge — Frontend

Next.js 14 App Router + TypeScript + Tailwind CSS

## ディレクトリ構成

```
frontend/
├── src/
│   ├── app/                        # App Router ページ
│   │   ├── (auth)/                 # 認証不要ルートグループ
│   │   │   ├── login/              # SCR-03 ログイン
│   │   │   └── register/           # SCR-02 新規登録
│   │   ├── (dashboard)/            # 認証必須ルートグループ
│   │   │   ├── dashboard/          # SCR-04 ダッシュボード
│   │   │   ├── profile/            # SCR-05 プロフィール編集
│   │   │   ├── search/             # SCR-07 検索・一覧
│   │   │   ├── matches/            # SCR-08 マッチング一覧
│   │   │   ├── messages/           # SCR-09 メッセージ
│   │   │   ├── interests/          # SCR-10 インタレスト管理
│   │   │   └── notifications/      # SCR-11 通知
│   │   ├── users/[id]/             # SCR-06 ユーザー詳細
│   │   ├── layout.tsx              # ルートレイアウト
│   │   └── page.tsx                # SCR-01 ランディングページ
│   ├── components/
│   │   ├── auth/                   # 認証関連コンポーネント
│   │   ├── profile/                # プロフィール関連
│   │   ├── matching/               # マッチング・レコメンド関連
│   │   ├── messages/               # メッセージ関連
│   │   └── ui/                     # 共通 UI コンポーネント
│   ├── lib/
│   │   ├── api.ts                  # バックエンド API クライアント
│   │   └── auth.ts                 # NextAuth 設定
│   └── types/
│       └── index.ts                # 共通型定義
├── public/
├── .env.local.example
├── Dockerfile
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## セットアップ

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## 環境変数

| 変数名 | 説明 |
|---|---|
| `NEXT_PUBLIC_API_URL` | バックエンド API のベース URL |
| `NEXTAUTH_URL` | NextAuth のコールバック URL |
| `NEXTAUTH_SECRET` | NextAuth のシークレットキー |
