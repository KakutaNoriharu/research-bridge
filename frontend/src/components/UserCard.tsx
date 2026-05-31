"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

export interface UserCardProps {
  userId: string;
  name: string;
  affiliation: string;
  summaryPreview: string;
  score: number;
  hasInterestSent: boolean;
  onInterestSend: (userId: string) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "bg-green-50 text-green-700"
      : pct >= 60
        ? "bg-yellow-50 text-yellow-700"
        : "bg-gray-100 text-gray-600";

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>
      適合度 {pct}%
    </span>
  );
}

export default function UserCard({
  userId,
  name,
  affiliation,
  summaryPreview,
  score,
  hasInterestSent,
  onInterestSend,
}: UserCardProps) {
  return (
    <Link
      href={`/users/${userId}`}
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* 名前・所属・スコアバッジ */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{name}</p>
          <p className="truncate text-sm text-gray-500">{affiliation}</p>
        </div>
        <ScoreBadge score={score} />
      </div>

      {/* 概要プレビュー */}
      {summaryPreview && (
        <p className="text-sm leading-relaxed text-gray-600">{summaryPreview}</p>
      )}

      {/* 興味ありボタン */}
      <div className="mt-auto pt-1">
        <Button
          variant={hasInterestSent ? "secondary" : "primary"}
          size="sm"
          disabled={hasInterestSent}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!hasInterestSent) onInterestSend(userId);
          }}
        >
          {hasInterestSent ? "送信済み" : "興味あり ♡"}
        </Button>
      </div>
    </Link>
  );
}
