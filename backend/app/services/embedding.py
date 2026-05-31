from openai import AsyncOpenAI

from app.core.config import settings

_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


# --------------------------------------------------------------------------- #
# Embedding テキスト組み立て                                                   #
# --------------------------------------------------------------------------- #

def build_researcher_text(
    research_summary: str | None,
    keywords: list[str],
) -> str:
    """研究概要 + キーワードを結合した Embedding 入力テキストを生成する。"""
    parts = [
        (research_summary or "").strip(),
        " ".join(k.strip() for k in keywords if k.strip()),
    ]
    return "\n".join(p for p in parts if p)


def build_company_text(
    tech_needs: str | None,
    desired_fields: list[str],
) -> str:
    """技術ニーズ + 求める研究分野を結合した Embedding 入力テキストを生成する。"""
    parts = [
        (tech_needs or "").strip(),
        " ".join(f.strip() for f in desired_fields if f.strip()),
    ]
    return "\n".join(p for p in parts if p)


# --------------------------------------------------------------------------- #
# Embedding 生成                                                               #
# --------------------------------------------------------------------------- #

async def generate_embedding(text: str) -> list[float] | None:
    """
    テキストを OpenAI text-embedding-3-small でベクトル化して返す。

    - テキストが空の場合は None を返す（DB には NULL が保存される）。
    - OpenAI API エラーはそのまま raise し、呼び出し側でハンドリングする。
    - プロフィール保存時のみ呼び出すこと（コスト制御のため）。
    """
    stripped = text.strip()
    if not stripped:
        return None

    response = await _client.embeddings.create(input=stripped, model=EMBEDDING_MODEL)
    return response.data[0].embedding
