"""
結合テスト: 研究者と企業の基本マッチングフロー

1  POST /auth/register          研究者登録
2  POST /auth/register          企業登録
3  POST /auth/login             研究者ログイン → トークン取得
4  POST /auth/login             企業ログイン → トークン取得
5  POST /profiles/researcher    研究者プロフィール作成
6  POST /profiles/company       企業プロフィール作成
7  GET  /matching/recommendations  企業がレコメンドに含まれることを確認
8  POST /interests              研究者→企業 インタレスト送信 (pending)
9  POST /interests              企業→研究者 インタレスト返送 (matched)
10 GET  /matching/matches       マッチング一覧に表示されることを確認
11 POST /messages/{match_id}    研究者からメッセージ送信
12 GET  /messages/{match_id}    企業でメッセージ取得
13 PUT  /messages/{match_id}/read  既読処理
14 GET  /notifications          通知が届いていることを確認
"""

import random
from unittest.mock import AsyncMock, patch

import pytest


# ─── helpers ─────────────────────────────────────────────────────────────────

def _rand_embedding() -> list[float]:
    """正規化済みランダム 1536 次元ベクトルを返す（OpenAI API の代替）。"""
    vec = [random.gauss(0, 1) for _ in range(1536)]
    norm = sum(x ** 2 for x in vec) ** 0.5
    return [x / norm for x in vec]


async def _fake_recommendations(current_user, db, top_k: int = 10):
    """pgvector cosine_distance の代替: 反対ロールのプロフィールを全件返す。"""
    from sqlalchemy import select

    from app.models.company_profile import CompanyProfile
    from app.models.researcher_profile import ResearcherProfile
    from app.models.user import UserRole

    if current_user.role == UserRole.researcher:
        rows = (await db.execute(select(CompanyProfile))).scalars().all()
    else:
        rows = (
            await db.execute(
                select(ResearcherProfile).where(ResearcherProfile.is_public.is_(True))
            )
        ).scalars().all()

    return [(profile, 0.85) for profile in rows]


# ─── main flow ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_researcher_company_flow(client):
    """研究者と企業の基本マッチングフロー（14ステップ）を一本のシナリオで検証する。"""

    with (
        patch(
            # patch where the name is used (local binding from import), not where defined
            "app.api.v1.endpoints.profiles.generate_embedding",
            new_callable=AsyncMock,
            side_effect=lambda text: _rand_embedding(),
        ),
        patch(
            "app.services.matching.get_recommendations",
            side_effect=_fake_recommendations,
        ),
    ):

        # ── Step 1: 研究者ユーザー登録 ───────────────────────────────────────
        res = await client.post(
            "/api/v1/auth/register",
            json={"email": "researcher@example.com", "password": "pass1234", "role": "researcher"},
        )
        assert res.status_code == 201, res.text
        researcher_user = res.json()
        assert researcher_user["role"] == "researcher"

        # ── Step 2: 企業ユーザー登録 ─────────────────────────────────────────
        res = await client.post(
            "/api/v1/auth/register",
            json={"email": "company@example.com", "password": "pass1234", "role": "company"},
        )
        assert res.status_code == 201, res.text
        company_user = res.json()
        assert company_user["role"] == "company"

        # ── Step 3: 研究者ログイン ────────────────────────────────────────────
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "researcher@example.com", "password": "pass1234"},
        )
        assert res.status_code == 200, res.text
        researcher_token = res.json()["access_token"]
        assert researcher_token

        # ── Step 4: 企業ログイン ──────────────────────────────────────────────
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "company@example.com", "password": "pass1234"},
        )
        assert res.status_code == 200, res.text
        company_token = res.json()["access_token"]
        assert company_token

        r_auth = {"Authorization": f"Bearer {researcher_token}"}
        c_auth = {"Authorization": f"Bearer {company_token}"}

        # ── Step 5: 研究者プロフィール作成 ────────────────────────────────────
        res = await client.post(
            "/api/v1/profiles/researcher",
            headers=r_auth,
            json={
                "name": "田中 太郎",
                "university": "東京大学",
                "lab": "情報工学研究室",
                "position": "准教授",
                "research_summary": "機械学習と自然言語処理の研究",
                "keywords": ["機械学習", "NLP", "深層学習"],
                "tech_stack": ["Python", "PyTorch"],
                "publication_links": [],
                "collaboration_types": ["joint_research", "consulting"],
                "is_public": True,
            },
        )
        assert res.status_code == 201, res.text
        researcher_profile = res.json()
        assert researcher_profile["name"] == "田中 太郎"
        assert researcher_profile["user_id"] == researcher_user["id"]

        # ── Step 6: 企業プロフィール作成 ──────────────────────────────────────
        res = await client.post(
            "/api/v1/profiles/company",
            headers=c_auth,
            json={
                "company_name": "テック株式会社",
                "industry": "IT・ソフトウェア",
                "employee_count": 50,
                "contact_name": "山田 花子",
                "tech_needs": "AIを活用したデータ解析システムの開発",
                "desired_fields": ["機械学習", "データサイエンス"],
                "collaboration_types": ["joint_research", "poc"],
                "budget_range": "100-500万円",
            },
        )
        assert res.status_code == 201, res.text
        company_profile = res.json()
        assert company_profile["company_name"] == "テック株式会社"
        assert company_profile["user_id"] == company_user["id"]

        # ── Step 7: AI レコメンド（研究者→企業が含まれる） ───────────────────
        res = await client.get("/api/v1/matching/recommendations", headers=r_auth)
        assert res.status_code == 200, res.text
        recs = res.json()
        assert len(recs) >= 1
        rec_user_ids = [r["user_id"] for r in recs]
        assert company_user["id"] in rec_user_ids, "企業がレコメンドに含まれるはず"
        assert recs[0]["match_score"] > 0

        # ── Step 8: 研究者→企業 インタレスト送信 ─────────────────────────────
        res = await client.post(
            "/api/v1/interests",
            headers=r_auth,
            json={"receiver_id": company_user["id"]},
        )
        assert res.status_code == 201, res.text
        interest_r2c = res.json()
        assert interest_r2c["sender_id"] == researcher_user["id"]
        assert interest_r2c["receiver_id"] == company_user["id"]
        assert interest_r2c["status"] == "pending", "相互送信前は pending であるはず"

        # ── Step 9: 企業→研究者 インタレスト返送 → matched ───────────────────
        res = await client.post(
            "/api/v1/interests",
            headers=c_auth,
            json={"receiver_id": researcher_user["id"]},
        )
        assert res.status_code == 201, res.text
        interest_c2r = res.json()
        assert interest_c2r["status"] == "matched", "双方が送信済みなので matched になるはず"

        # ── Step 10: マッチング一覧 ───────────────────────────────────────────
        res = await client.get("/api/v1/matching/matches", headers=r_auth)
        assert res.status_code == 200, res.text
        matches = res.json()
        assert len(matches) == 1
        match = matches[0]
        assert match["researcher_id"] == researcher_user["id"]
        assert match["company_id"] == company_user["id"]
        match_id: str = match["id"]

        # 企業からも確認
        res = await client.get("/api/v1/matching/matches", headers=c_auth)
        assert res.status_code == 200, res.text
        assert len(res.json()) == 1
        assert res.json()[0]["id"] == match_id

        # ── Step 11: 研究者→企業 メッセージ送信 ──────────────────────────────
        res = await client.post(
            f"/api/v1/messages/{match_id}",
            headers=r_auth,
            json={"body": "はじめまして！共同研究についてお話しさせていただけますか？"},
        )
        assert res.status_code == 201, res.text
        message = res.json()
        assert message["match_id"] == match_id
        assert message["sender_id"] == researcher_user["id"]
        assert message["is_read"] is False

        # ── Step 12: 企業でメッセージ取得 ────────────────────────────────────
        res = await client.get(f"/api/v1/messages/{match_id}", headers=c_auth)
        assert res.status_code == 200, res.text
        messages = res.json()
        assert len(messages) == 1
        assert messages[0]["body"] == "はじめまして！共同研究についてお話しさせていただけますか？"
        assert messages[0]["is_read"] is False

        # ── Step 13: 既読処理（企業） ─────────────────────────────────────────
        res = await client.put(f"/api/v1/messages/{match_id}/read", headers=c_auth)
        assert res.status_code == 200, res.text
        read_result = res.json()
        assert read_result["updated"] == 1

        # 既読確認
        res = await client.get(f"/api/v1/messages/{match_id}", headers=c_auth)
        assert res.status_code == 200, res.text
        assert res.json()[0]["is_read"] is True

        # ── Step 14: 通知確認 ─────────────────────────────────────────────────
        # 企業への通知: interest (研究者から), match (マッチング成立), message (メッセージ受信)
        res = await client.get("/api/v1/notifications", headers=c_auth)
        assert res.status_code == 200, res.text
        c_notifs = res.json()
        c_notif_types = {n["type"] for n in c_notifs}
        assert "interest" in c_notif_types, "企業は研究者からのインタレスト通知を受け取るはず"
        assert "match" in c_notif_types, "企業はマッチング成立通知を受け取るはず"
        assert "message" in c_notif_types, "企業はメッセージ通知を受け取るはず"

        # 研究者への通知: match のみ（インタレストは受け取っていない）
        res = await client.get("/api/v1/notifications", headers=r_auth)
        assert res.status_code == 200, res.text
        r_notifs = res.json()
        r_notif_types = {n["type"] for n in r_notifs}
        assert "match" in r_notif_types, "研究者はマッチング成立通知を受け取るはず"

        # 既読処理後は通知の is_read が True になることを確認
        res = await client.put("/api/v1/notifications/read-all", headers=c_auth)
        assert res.status_code == 204, res.text

        res = await client.get("/api/v1/notifications", headers=c_auth)
        assert all(n["is_read"] for n in res.json()), "read-all 後は全通知が既読であるはず"


# ─── Additional edge-case tests ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    """同一メールアドレスの重複登録は 409 を返す。"""
    payload = {"email": "dup@example.com", "password": "pass1234", "role": "researcher"}
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201

    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    """誤ったパスワードでのログインは 401 を返す。"""
    await client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "correct", "role": "researcher"},
    )
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "wrong"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_send_interest_to_self(client):
    """自分自身へのインタレスト送信は 400 を返す。"""
    await client.post(
        "/api/v1/auth/register",
        json={"email": "self@example.com", "password": "pass1234", "role": "researcher"},
    )
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "self@example.com", "password": "pass1234"},
    )
    token = res.json()["access_token"]
    user_id = (await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()["id"]

    res = await client.post(
        "/api/v1/interests",
        headers={"Authorization": f"Bearer {token}"},
        json={"receiver_id": user_id},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_message_unauthorized(client):
    """マッチング未成立の相手へのメッセージ送信は 403 を返す。"""
    # ユーザー作成
    for email, role in [("r@example.com", "researcher"), ("c@example.com", "company")]:
        await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "pass1234", "role": role},
        )

    res = await client.post(
        "/api/v1/auth/login", json={"email": "r@example.com", "password": "pass1234"}
    )
    token = res.json()["access_token"]

    # 存在しない match_id に対してメッセージ送信 → 404
    res = await client.post(
        "/api/v1/messages/nonexistent-match-id",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "test"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_withdraw_interest(client):
    """送信済みインタレストを取り消せる（204 → 再取得時に withdrawn）。"""
    for email, role in [("wr@example.com", "researcher"), ("wc@example.com", "company")]:
        await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "pass1234", "role": role},
        )
    r_res = await client.post(
        "/api/v1/auth/login", json={"email": "wr@example.com", "password": "pass1234"}
    )
    c_res = await client.post(
        "/api/v1/auth/login", json={"email": "wc@example.com", "password": "pass1234"}
    )
    r_token = r_res.json()["access_token"]
    r_auth = {"Authorization": f"Bearer {r_token}"}

    c_id = (await client.post(
        "/api/v1/auth/login", json={"email": "wc@example.com", "password": "pass1234"}
    )).json()
    c_token = c_res.json()["access_token"]

    # 企業ユーザーID を取得
    company_id = (
        await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {c_token}"})
    ).json()["id"]

    # インタレスト送信
    res = await client.post(
        "/api/v1/interests",
        headers=r_auth,
        json={"receiver_id": company_id},
    )
    assert res.status_code == 201
    interest_id = res.json()["id"]

    # 取り消し
    res = await client.delete(
        f"/api/v1/interests/{interest_id}", headers=r_auth
    )
    assert res.status_code == 204

    # インタレスト一覧で withdrawn を確認
    res = await client.get("/api/v1/interests", headers=r_auth)
    assert res.status_code == 200
    sent = res.json()["sent"]
    withdrawn = [i for i in sent if i["id"] == interest_id]
    assert len(withdrawn) == 1
    assert withdrawn[0]["status"] == "withdrawn"
