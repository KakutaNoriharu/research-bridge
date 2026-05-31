"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { matchingApi, interestApi, type RecommendationItem, ApiError } from "@/lib/api";
import type { ResearcherProfile, CompanyProfile } from "@/types";
import UserCard from "@/components/UserCard";

// ── スケルトンカード ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex animate-pulse flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-200" />
        </div>
        <div className="h-6 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-gray-200" />
        <div className="h-3 w-4/5 rounded bg-gray-200" />
        <div className="h-3 w-3/5 rounded bg-gray-200" />
      </div>
      <div className="h-8 w-28 rounded-lg bg-gray-200" />
    </div>
  );
}

// ── ヘルパー: レコメンドアイテム → UserCard の props に変換 ─────────────────

function toCardProps(item: RecommendationItem) {
  const profile = item.profile as ResearcherProfile & CompanyProfile;
  const isResearcher = "university" in profile;

  const rawSummary = isResearcher
    ? (profile.research_summary ?? "")
    : (profile.tech_needs ?? "");

  const summaryPreview =
    rawSummary.length > 100 ? `${rawSummary.slice(0, 100)}...` : rawSummary;

  return {
    userId: item.user_id,
    name: isResearcher ? profile.name : profile.company_name,
    affiliation: isResearcher ? profile.university : (profile.industry ?? ""),
    summaryPreview,
    score: item.match_score,
  };
}

// ── ページ本体 ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken ?? "";

  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // POST /interests 送信済みの userId セット（楽観的 UI 用）
  const [sentSet, setSentSet] = useState<Set<string>>(new Set());

  const fetchRecommendations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    try {
      const data = await matchingApi.getRecommendations(token);
      setItems(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (status === "authenticated") fetchRecommendations();
  }, [status, fetchRecommendations]);

  async function handleInterestSend(userId: string) {
    try {
      await interestApi.send(userId, token);
      setSentSet((prev) => new Set([...prev, userId]));
    } catch (err) {
      // 409 = 既に送信済み → 楽観的に送信済みにする
      if (err instanceof ApiError && err.status === 409) {
        setSentSet((prev) => new Set([...prev, userId]));
      }
    }
  }

  // ── ローディング ──
  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="h-7 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── エラー ──
  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">おすすめ</h1>
        <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 py-14 text-center">
          <p className="text-red-600">
            データの取得に失敗しました。再読み込みしてください。
          </p>
          <button
            onClick={fetchRecommendations}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  // ── 空状態 ──
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">おすすめ</h1>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-gray-500">おすすめの候補がまだありません</p>
          <p className="text-sm text-gray-400">
            プロフィールを登録するとAIマッチングが開始されます
          </p>
          <Link
            href="/profile/edit"
            className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            プロフィールを登録する
          </Link>
        </div>
      </div>
    );
  }

  // ── カード一覧 ──
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">おすすめ</h1>
        <p className="mt-1 text-sm text-gray-500">
          AIがあなたに最適な相手を選びました（上位 {items.length} 件）
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <UserCard
            key={item.user_id}
            {...toCardProps(item)}
            hasInterestSent={sentSet.has(item.user_id)}
            onInterestSend={handleInterestSend}
          />
        ))}
      </div>
    </div>
  );
}
