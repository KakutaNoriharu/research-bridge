"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { interestApi, matchingApi, profileApi } from "@/lib/api";
import type { Interest, Match } from "@/types";

// ─── types ───────────────────────────────────────────────────────────────────

type Tab = "received" | "sent";

interface PartnerInfo {
  name: string;
  affiliation: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const BADGES: Record<string, { label: string; cls: string }> = {
  pending: {
    label: "返答待ち",
    cls: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  },
  matched: {
    label: "マッチング成立",
    cls: "bg-green-50 text-green-700 border border-green-200",
  },
};

// ─── sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const badge = BADGES[status];
  if (!badge) return null;
  return (
    <span className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-medium ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
      <p className="text-gray-500">まだインタレストはありません</p>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function InterestsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken ?? "";
  const myId = session?.user?.id ?? "";
  const myRole = session?.user?.role ?? "";

  const [tab, setTab] = useState<Tab>("received");
  const [received, setReceived] = useState<Interest[]>([]);
  const [sent, setSent] = useState<Interest[]>([]);
  const [partnerInfo, setPartnerInfo] = useState<Map<string, PartnerInfo>>(new Map());
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [inProgress, setInProgress] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token || !myRole) return;
    setLoading(true);
    try {
      const [interestsRes, matchesRes] = await Promise.allSettled([
        interestApi.list(token),
        matchingApi.listMatches(token),
      ]);

      const interests =
        interestsRes.status === "fulfilled"
          ? interestsRes.value
          : { sent: [], received: [] };
      const matchesList =
        matchesRes.status === "fulfilled" ? matchesRes.value : [];

      setReceived(interests.received);
      setSent(interests.sent);
      setMatches(matchesList);

      // Collect unique partner IDs across both lists
      const partnerIds = new Set<string>([
        ...interests.received.map((i) => i.sender_id),
        ...interests.sent.map((i) => i.receiver_id),
      ]);

      // Fetch profiles in parallel; partners are always the opposite role
      const info = new Map<string, PartnerInfo>();
      await Promise.allSettled(
        [...partnerIds].map(async (pid) => {
          try {
            if (myRole === "researcher") {
              const p = await profileApi.getCompany(pid, token);
              info.set(pid, { name: p.company_name, affiliation: p.industry ?? "" });
            } else {
              const p = await profileApi.getResearcher(pid, token);
              info.set(pid, { name: p.name, affiliation: p.university });
            }
          } catch {
            info.set(pid, { name: pid.slice(0, 8), affiliation: "" });
          }
        }),
      );
      setPartnerInfo(new Map(info));
    } finally {
      setLoading(false);
    }
  }, [token, myRole]);

  useEffect(() => {
    load();
  }, [load]);

  // Find match_id for a given partner user ID
  function findMatchId(partnerUserId: string): string | null {
    const m = matches.find((match) =>
      myRole === "researcher"
        ? match.researcher_id === myId && match.company_id === partnerUserId
        : match.company_id === myId && match.researcher_id === partnerUserId,
    );
    return m?.id ?? null;
  }

  // Has the current user already sent an active interest back to this person?
  function hasSentBack(toUserId: string): boolean {
    return sent.some(
      (i) => i.receiver_id === toUserId && i.status !== "withdrawn",
    );
  }

  function startProgress(key: string) {
    setInProgress((prev) => new Set([...prev, key]));
  }
  function endProgress(key: string) {
    setInProgress((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function handleSendBack(receiverId: string) {
    startProgress(receiverId);
    try {
      await interestApi.send(receiverId, token);
    } catch {
      // 409 = already sent; load() will reflect reality
    } finally {
      await load();
      endProgress(receiverId);
    }
  }

  async function handleWithdraw(interestId: string) {
    if (!window.confirm("本当に取り消しますか？")) return;
    startProgress(interestId);
    try {
      await interestApi.withdraw(interestId, token);
    } catch {
      // ignore
    } finally {
      await load();
      endProgress(interestId);
    }
  }

  // Filter out withdrawn entries for display
  const visibleReceived = received.filter((i) => i.status !== "withdrawn");
  const visibleSent = sent.filter((i) => i.status !== "withdrawn");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "received", label: "もらった興味あり", count: visibleReceived.length },
    { key: "sent", label: "送った興味あり", count: visibleSent.length },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">インタレスト</h1>

      {/* Tab bar */}
      <div className="mb-6 flex border-b border-gray-200">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              tab === key
                ? "-mb-px border-b-2 border-primary-500 text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-bold ${
                  tab === key
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : tab === "received" ? (
        visibleReceived.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleReceived.map((interest) => {
              const partner = partnerInfo.get(interest.sender_id);
              const matchId =
                interest.status === "matched"
                  ? findMatchId(interest.sender_id)
                  : null;
              const alreadySent = hasSentBack(interest.sender_id);
              const busy = inProgress.has(interest.sender_id);

              return (
                <li
                  key={interest.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/users/${interest.sender_id}`}
                      className="font-medium text-gray-900 hover:text-primary-700 hover:underline"
                    >
                      {partner?.name ?? "…"}
                    </Link>
                    {partner?.affiliation && (
                      <p className="text-sm text-gray-500">{partner.affiliation}</p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatDate(interest.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={interest.status} />

                    {interest.status === "pending" && !alreadySent && (
                      <button
                        onClick={() => handleSendBack(interest.sender_id)}
                        disabled={busy}
                        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? "送信中…" : "興味ありを返す ♡"}
                      </button>
                    )}

                    {interest.status === "matched" && matchId && (
                      <Link
                        href={`/messages/${matchId}`}
                        className="rounded-lg border border-primary-300 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50"
                      >
                        メッセージを送る
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : visibleSent.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleSent.map((interest) => {
            const partner = partnerInfo.get(interest.receiver_id);
            const busy = inProgress.has(interest.id);

            return (
              <li
                key={interest.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/users/${interest.receiver_id}`}
                    className="font-medium text-gray-900 hover:text-primary-700 hover:underline"
                  >
                    {partner?.name ?? "…"}
                  </Link>
                  {partner?.affiliation && (
                    <p className="text-sm text-gray-500">{partner.affiliation}</p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatDate(interest.created_at)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={interest.status} />

                  {interest.status === "pending" && (
                    <button
                      onClick={() => handleWithdraw(interest.id)}
                      disabled={busy}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "取り消し中…" : "取り消す"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
