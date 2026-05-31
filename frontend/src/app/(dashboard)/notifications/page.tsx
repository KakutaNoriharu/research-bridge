"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { notificationApi, profileApi } from "@/lib/api";
import type { AppNotification } from "@/types";

// ─── relative time ───────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "たった今";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}週間前`;
  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
}

// ─── icons ───────────────────────────────────────────────────────────────────

function InterestIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  );
}

function MatchIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}

const TYPE_CONFIG = {
  interest: {
    icon: InterestIcon,
    iconBg: "bg-pink-100 text-pink-600",
    text: (name: string) => `${name}さんから興味ありが届きました`,
    href: (_: string | null) => "/interests",
  },
  match: {
    icon: MatchIcon,
    iconBg: "bg-green-100 text-green-600",
    text: (name: string) => `${name}さんとマッチングしました 🎉`,
    href: (_: string | null) => "/matches",
  },
  message: {
    icon: MessageIcon,
    iconBg: "bg-blue-100 text-blue-600",
    text: (name: string) => `${name}さんからメッセージが届きました`,
    href: (relatedId: string | null) =>
      relatedId ? `/messages/${relatedId}` : "/messages",
  },
} as const;

// ─── page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken ?? "";
  const myRole = session?.user?.role ?? "";

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !myRole) return;
    setLoading(true);
    try {
      const data = await notificationApi.list(token);
      setNotifications(data);

      // Resolve actor names in parallel (actors are always opposite role)
      const uniqueActors = [...new Set(data.map((n) => n.actor_user_id))];
      const names = new Map<string, string>();
      await Promise.allSettled(
        uniqueActors.map(async (actorId) => {
          try {
            if (myRole === "researcher") {
              const p = await profileApi.getCompany(actorId, token);
              names.set(actorId, p.company_name);
            } else {
              const p = await profileApi.getResearcher(actorId, token);
              names.set(actorId, p.name);
            }
          } catch {
            names.set(actorId, actorId.slice(0, 8));
          }
        }),
      );
      setActorNames(new Map(names));

      // Mark all as read (fire-and-forget)
      notificationApi.readAll(token).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [token, myRole]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">通知</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-gray-500">通知はありません</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
          {notifications.map((notif) => {
            const config = TYPE_CONFIG[notif.type];
            const Icon = config.icon;
            const actorName = actorNames.get(notif.actor_user_id) ?? "…";
            const href = config.href(notif.related_id);

            return (
              <li key={notif.id}>
                <Link
                  href={href}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-gray-50 ${
                    !notif.is_read ? "bg-primary-50" : ""
                  }`}
                >
                  {/* Type icon */}
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.iconBg}`}
                  >
                    <Icon />
                  </span>

                  {/* Text + timestamp */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!notif.is_read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {config.text(actorName)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">{timeAgo(notif.created_at)}</p>
                  </div>

                  {/* Unread dot */}
                  {!notif.is_read && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
