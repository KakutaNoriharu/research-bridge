"""Initial schema: all tables + pgvector indexes

Revision ID: 20260531_001
Revises:
Create Date: 2026-05-31

テーブル構成:
  users / researcher_profiles / company_profiles /
  interests / matches / messages

ベクトル検索:
  pgvector 拡張 + IVFFlat インデックス (cosine similarity)
  ※ IVFFlat は rows/1000 程度の lists 値が最適。
    データ投入後に以下で再作成することを推奨:
      DROP INDEX idx_rp_embedding_ivfflat;
      CREATE INDEX idx_rp_embedding_ivfflat
        ON researcher_profiles
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = <行数 / 1000>);
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "20260531_001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# =========================================================================== #
# UPGRADE                                                                      #
# =========================================================================== #
def upgrade() -> None:

    # ----------------------------------------------------------------------- #
    # 1. Extensions                                                            #
    # ----------------------------------------------------------------------- #
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ----------------------------------------------------------------------- #
    # 2. Enum types                                                            #
    # ----------------------------------------------------------------------- #
    op.execute("CREATE TYPE user_role AS ENUM ('researcher', 'company')")
    op.execute(
        "CREATE TYPE interest_status AS ENUM ('pending', 'matched', 'withdrawn')"
    )

    # ----------------------------------------------------------------------- #
    # 3. users                                                                 #
    # ----------------------------------------------------------------------- #
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column(
            "role",
            sa.Enum("researcher", "company", name="user_role", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("idx_users_email", "users", ["email"], unique=True)

    # ----------------------------------------------------------------------- #
    # 4. researcher_profiles                                                   #
    # ----------------------------------------------------------------------- #
    op.create_table(
        "researcher_profiles",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("university", sa.String(200), nullable=False),
        sa.Column("lab", sa.String(200), nullable=True),
        sa.Column("position", sa.String(100), nullable=True),
        # Embedding 生成に使用するテキスト (最大 1000 文字)
        sa.Column("research_summary", sa.Text(), nullable=True),
        # タグ形式 (最大 10 件)
        sa.Column("keywords", sa.ARRAY(sa.String()), nullable=True),
        sa.Column("tech_stack", sa.ARRAY(sa.String()), nullable=True),
        # DOI / URL (最大 5 件)
        sa.Column("publication_links", sa.ARRAY(sa.String()), nullable=True),
        # joint_research / commissioned_research / consulting / poc
        sa.Column("collaboration_types", sa.ARRAY(sa.String()), nullable=True),
        sa.Column(
            "is_public",
            sa.Boolean(),
            server_default=sa.text("TRUE"),
            nullable=False,
        ),
        # OpenAI text-embedding-3-small = 1536 次元
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_rp_user_id", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_rp_user_id"),
    )

    # ----------------------------------------------------------------------- #
    # 5. company_profiles                                                      #
    # ----------------------------------------------------------------------- #
    op.create_table(
        "company_profiles",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("company_name", sa.String(200), nullable=False),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("employee_count", sa.Integer(), nullable=True),
        sa.Column("contact_name", sa.String(100), nullable=False),
        # Embedding 生成に使用するテキスト (最大 1000 文字)
        sa.Column("tech_needs", sa.Text(), nullable=True),
        # タグ形式 (最大 10 件)
        sa.Column("desired_fields", sa.ARRAY(sa.String()), nullable=True),
        sa.Column("collaboration_types", sa.ARRAY(sa.String()), nullable=True),
        # PRF-C-05: 任意の予算規模レンジ
        sa.Column("budget_range", sa.String(50), nullable=True),
        # OpenAI text-embedding-3-small = 1536 次元
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_cp_user_id", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_cp_user_id"),
    )

    # ----------------------------------------------------------------------- #
    # 6. interests                                                             #
    # ----------------------------------------------------------------------- #
    op.create_table(
        "interests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("sender_id", sa.String(), nullable=False),
        sa.Column("receiver_id", sa.String(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending", "matched", "withdrawn",
                name="interest_status",
                create_type=False,
            ),
            server_default=sa.text("'pending'::interest_status"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"], ["users.id"], name="fk_interests_sender"
        ),
        sa.ForeignKeyConstraint(
            ["receiver_id"], ["users.id"], name="fk_interests_receiver"
        ),
        sa.PrimaryKeyConstraint("id"),
        # 同一ペアへの重複インタレスト防止
        sa.UniqueConstraint(
            "sender_id", "receiver_id", name="uq_interests_sender_receiver"
        ),
    )

    # ----------------------------------------------------------------------- #
    # 7. matches                                                               #
    # ----------------------------------------------------------------------- #
    op.create_table(
        "matches",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("researcher_id", sa.String(), nullable=False),
        sa.Column("company_id", sa.String(), nullable=False),
        sa.Column(
            "matched_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["researcher_id"], ["users.id"], name="fk_matches_researcher"
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["users.id"], name="fk_matches_company"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("researcher_id", "company_id", name="uq_matches_pair"),
    )

    # ----------------------------------------------------------------------- #
    # 8. messages                                                              #
    # ----------------------------------------------------------------------- #
    op.create_table(
        "messages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("match_id", sa.String(), nullable=False),
        sa.Column("sender_id", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "is_read",
            sa.Boolean(),
            server_default=sa.text("FALSE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["match_id"], ["matches.id"], name="fk_messages_match", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"], ["users.id"], name="fk_messages_sender"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ----------------------------------------------------------------------- #
    # 9. 通常インデックス                                                      #
    # ----------------------------------------------------------------------- #

    # researcher_profiles
    op.create_index("idx_rp_is_public",   "researcher_profiles", ["is_public"])
    op.create_index("idx_rp_university",  "researcher_profiles", ["university"])

    # company_profiles
    op.create_index("idx_cp_is_public",   "company_profiles", ["is_public"])
    op.create_index("idx_cp_industry",    "company_profiles", ["industry"])

    # interests
    op.create_index("idx_interests_sender_id",   "interests", ["sender_id"])
    op.create_index("idx_interests_receiver_id", "interests", ["receiver_id"])
    op.create_index("idx_interests_status",      "interests", ["status"])

    # matches
    op.create_index("idx_matches_researcher_id", "matches", ["researcher_id"])
    op.create_index("idx_matches_company_id",    "matches", ["company_id"])
    op.create_index("idx_matches_matched_at",    "matches", ["matched_at"])

    # messages
    op.create_index("idx_messages_match_id",   "messages", ["match_id"])
    op.create_index("idx_messages_sender_id",  "messages", ["sender_id"])
    op.create_index("idx_messages_is_read",    "messages", ["is_read"])
    op.create_index("idx_messages_created_at", "messages", ["created_at"])

    # ----------------------------------------------------------------------- #
    # 10. updated_at 自動更新トリガー                                          #
    # ----------------------------------------------------------------------- #
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    op.execute("""
        CREATE TRIGGER trg_researcher_profiles_updated_at
            BEFORE UPDATE ON researcher_profiles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    """)

    op.execute("""
        CREATE TRIGGER trg_company_profiles_updated_at
            BEFORE UPDATE ON company_profiles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    """)

    # ----------------------------------------------------------------------- #
    # 11. IVFFlat ベクトルインデックス (コサイン類似度)                        #
    # ----------------------------------------------------------------------- #
    # operator class:
    #   vector_cosine_ops  → <=> 演算子 (コサイン距離)
    #   vector_l2_ops      → <-> 演算子 (L2距離)
    #   vector_ip_ops      → <#> 演算子 (内積)
    #
    # lists パラメータ目安:
    #   〜 100K 行: lists = rows / 1000 (最小 1)
    #   〜 1M  行: lists = sqrt(rows)
    #
    # ★ IVFFlat はデータ投入後の再作成が推奨:
    #   REINDEX INDEX CONCURRENTLY idx_rp_embedding_ivfflat;
    #   または DROP → CREATE WITH (lists = <適切な値>)
    op.execute("""
        CREATE INDEX idx_rp_embedding_ivfflat
            ON researcher_profiles
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
    """)

    op.execute("""
        CREATE INDEX idx_cp_embedding_ivfflat
            ON company_profiles
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
    """)


# =========================================================================== #
# DOWNGRADE                                                                    #
# =========================================================================== #
def downgrade() -> None:
    # テーブルは外部キーの依存順で削除
    op.drop_table("messages")
    op.drop_table("matches")
    op.drop_table("interests")
    op.drop_table("company_profiles")
    op.drop_table("researcher_profiles")
    op.drop_table("users")

    # トリガー関数
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE")

    # Enum 型
    op.execute("DROP TYPE IF EXISTS interest_status")
    op.execute("DROP TYPE IF EXISTS user_role")

    # 拡張
    op.execute("DROP EXTENSION IF EXISTS vector")
