"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { profileApi, interestApi, matchingApi, ApiError } from "@/lib/api";
import type { ResearcherProfile, CompanyProfile, CollaborationType, Match } from "@/types";
import Button from "@/components/ui/Button";

// ── 定数 ─────────────────────────────────────────────────────────────────────

const COLLAB_LABELS: Record<CollaborationType, string> = {
  joint_research: "共同研究",
  commissioned_research: "受託研究",
  consulting: "技術相談",
  poc: "PoC",
};

const EMPLOYEE_LABELS: Record<string, string> = {
  "10": "1〜10人",
  "50": "11〜50人",
  "200": "51〜200人",
  "999": "201人以上",
};

function formatEmployeeCount(n: number | undefined): string | null {
  if (!n) return null;
  if (n <= 10) return EMPLOYEE_LABELS["10"];
  if (n <= 50) return EMPLOYEE_LABELS["50"];
  if (n <= 200) return EMPLOYEE_LABELS["200"];
  return EMPLOYEE_LABELS["999"];
}

// ── 型 ───────────────────────────────────────────────────────────────────────

type ProfileData =
  | { kind: "researcher"; data: ResearcherProfile }
  | { kind: "company"; data: CompanyProfile };

type ActionState =
  | "self"
  | "matched"
  | "interest_sent"
  | "none";

// ── 小コンポーネント ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
      {children}
    </h2>
  );
}

function TagList({ items, color = "primary" }: { items: string[]; color?: "primary" | "gray" }) {
  if (!items.length) return null;
  const cls =
    color === "primary"
      ? "bg-primary-50 text-primary-700"
      : "bg-gray-100 text-gray-600";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-24 shrink-0 text-gray-400">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className="mb-5 h-4 w-12 rounded bg-gray-200" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-5 rounded-xl bg-white p-6 shadow-sm">
          <div className="flex gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-5 w-40 rounded bg-gray-200" />
              <div className="h-4 w-28 rounded bg-gray-200" />
            </div>
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-gray-200" />
              <div className="h-4 w-full rounded bg-gray-200" />
              <div className="h-4 w-4/5 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="h-40 w-full rounded-xl bg-white shadow-sm lg:w-64" />
      </div>
    </div>
  );
}

// ── アクションカード ──────────────────────────────────────────────────────────

function ActionCard({
  state,
  matchId,
  onSendInterest,
  sending,
  error,
}: {
  state: ActionState;
  matchId: string | null;
  onSendInterest: () => void;
  sending: boolean;
  error: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:w-64 lg:self-start">
      {state === "self" && (
        <>
          <p className="text-sm text-gray-500">あなたのプロフィールです</p>
          <Link href="/profile/edit">
            <Button variant="secondary" className="w-full">
              プロフィールを編集
            </Button>
          </Link>
        </>
      )}

      {state === "matched" && matchId && (
        <>
          <div className="flex items-center gap-2 text-sm text-green-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            マッチング成立
          </div>
          <Link href={`/messages?match=${matchId}`}>
            <Button className="w-full">
              メッセージを送る
            </Button>
          </Link>
        </>
      )}

      {state === "interest_sent" && (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.218l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
            インタレスト送信済み
          </div>
          <Button disabled className="w-full" variant="secondary">
            送信済み
          </Button>
        </>
      )}

      {state === "none" && (
        <>
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          <Button
            onClick={onSendInterest}
            loading={sending}
            className="w-full"
          >
            興味あり ♡
          </Button>
          <p className="text-center text-xs text-gray-400">
            相手も興味ありを送ると<br />マッチング成立
          </p>
        </>
      )}
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const token = session?.accessToken ?? "";
  const myId = session?.user?.id ?? "";
  const myRole = session?.user?.role;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionState, setActionState] = useState<ActionState>("none");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !token || !id) return;

    const isSelf = id === myId;

    async function load() {
      setLoading(true);
      setNotFound(false);
      setLoadError(false);

      try {
        // プロフィール取得
        if (isSelf) {
          if (myRole === "researcher") {
            const p = await profileApi.getResearcher(id, token);
            setProfile({ kind: "researcher", data: p });
          } else {
            const p = await profileApi.getCompany(id, token);
            setProfile({ kind: "company", data: p });
          }
          setActionState("self");
        } else {
          if (myRole === "researcher") {
            const p = await profileApi.getCompany(id, token);
            setProfile({ kind: "company", data: p });
          } else {
            const p = await profileApi.getResearcher(id, token);
            setProfile({ kind: "researcher", data: p });
          }

          // インタレスト・マッチング状態を並列取得
          const [interestRes, matchRes] = await Promise.allSettled([
            interestApi.list(token),
            matchingApi.listMatches(token),
          ]);

          if (matchRes.status === "fulfilled") {
            const found = (matchRes.value as Match[]).find(
              (m) => m.researcher_id === id || m.company_id === id,
            );
            if (found) {
              setMatchId(found.id);
              setActionState("matched");
              return;
            }
          }

          if (interestRes.status === "fulfilled") {
            const sent = interestRes.value.sent;
            const existing = sent.find(
              (i) => i.receiver_id === id && i.status !== "withdrawn",
            );
            if (existing) {
              setActionState("interest_sent");
              return;
            }
          }

          setActionState("none");
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
          setNotFound(true);
        } else {
          setLoadError(true);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, token, status, myId, myRole]);

  async function handleSendInterest() {
    setSending(true);
    setSendError("");
    try {
      await interestApi.send(id, token);
      setActionState("interest_sent");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setActionState("interest_sent");
      } else {
        setSendError(e instanceof Error ? e.message : "送信に失敗しました");
      }
    } finally {
      setSending(false);
    }
  }

  // ── 状態別レンダリング ──
  if (status === "loading" || loading) return <ProfileSkeleton />;

  if (notFound || (!loading && !profile && !loadError)) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-gray-100 p-4 text-3xl">👤</div>
        <p className="font-medium text-gray-700">このユーザーは見つかりませんでした</p>
        <p className="text-sm text-gray-400">
          プロフィールが非公開か、存在しないユーザーです
        </p>
        <Button variant="secondary" onClick={() => router.back()}>
          戻る
        </Button>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <p className="text-gray-500">読み込みに失敗しました</p>
        <Button variant="secondary" onClick={() => router.back()}>戻る</Button>
      </div>
    );
  }

  // ── プロフィール表示 ──
  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-1 text-sm text-primary-600 hover:underline"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        戻る
      </button>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── プロフィール本体 ── */}
        <div className="flex-1 space-y-5">

          {profile.kind === "researcher" ? (
            <ResearcherDetail data={profile.data} />
          ) : (
            <CompanyDetail data={profile.data} />
          )}

        </div>

        {/* ── アクションカード ── */}
        <ActionCard
          state={actionState}
          matchId={matchId}
          onSendInterest={handleSendInterest}
          sending={sending}
          error={sendError}
        />
      </div>
    </div>
  );
}

// ── 研究者プロフィール ────────────────────────────────────────────────────────

function ResearcherDetail({ data }: { data: ResearcherProfile }) {
  return (
    <>
      {/* ヘッダー */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xl">
            🔬
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{data.name}</h1>
            <p className="text-sm text-gray-500">{data.university}</p>
            {(data.lab ?? data.position) && (
              <p className="text-sm text-gray-400">
                {[data.lab, data.position].filter(Boolean).join(" / ")}
              </p>
            )}
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
            研究者
          </span>
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <InfoRow label="所属大学" value={data.university} />
          <InfoRow label="研究室" value={data.lab ?? null} />
          <InfoRow label="役職" value={data.position ?? null} />
        </div>
      </div>

      {/* 研究概要 */}
      {data.research_summary && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <SectionTitle>研究概要</SectionTitle>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {data.research_summary}
          </p>
        </div>
      )}

      {/* キーワード・技術スタック */}
      {(data.keywords?.length > 0 || data.tech_stack?.length > 0) && (
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          {data.keywords?.length > 0 && (
            <div>
              <SectionTitle>研究キーワード</SectionTitle>
              <TagList items={data.keywords} color="primary" />
            </div>
          )}
          {data.tech_stack?.length > 0 && (
            <div>
              <SectionTitle>技術スタック</SectionTitle>
              <TagList items={data.tech_stack} color="gray" />
            </div>
          )}
        </div>
      )}

      {/* 論文・実績リンク */}
      {data.publication_links?.filter(Boolean).length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <SectionTitle>論文・実績リンク</SectionTitle>
          <ul className="space-y-2">
            {data.publication_links.filter(Boolean).map((link, i) => (
              <li key={i}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 truncate text-sm text-primary-600 hover:underline"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 連携形態 */}
      {data.collaboration_types?.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <SectionTitle>連携可能な形態</SectionTitle>
          <TagList items={data.collaboration_types.map((c) => COLLAB_LABELS[c])} color="gray" />
        </div>
      )}
    </>
  );
}

// ── 企業プロフィール ──────────────────────────────────────────────────────────

function CompanyDetail({ data }: { data: CompanyProfile }) {
  const empCount = formatEmployeeCount(data.employee_count);

  return (
    <>
      {/* ヘッダー */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-2xl">
            🏢
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{data.company_name}</h1>
            {data.industry && <p className="text-sm text-gray-500">{data.industry}</p>}
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            企業
          </span>
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <InfoRow label="業種" value={data.industry ?? null} />
          <InfoRow label="従業員数" value={empCount} />
          <InfoRow label="担当者名" value={data.contact_name ?? null} />
        </div>
      </div>

      {/* 技術ニーズ */}
      {data.tech_needs && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <SectionTitle>技術ニーズ・課題</SectionTitle>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {data.tech_needs}
          </p>
        </div>
      )}

      {/* 求める研究分野 */}
      {data.desired_fields?.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <SectionTitle>求める研究分野</SectionTitle>
          <TagList items={data.desired_fields} color="primary" />
        </div>
      )}

      {/* 連携形態 */}
      {data.collaboration_types?.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <SectionTitle>連携形態の希望</SectionTitle>
          <TagList items={data.collaboration_types.map((c) => COLLAB_LABELS[c])} color="gray" />
        </div>
      )}
    </>
  );
}
