"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { messageApi, notificationApi } from "@/lib/api";
import Button from "@/components/ui/Button";

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Header() {
  const { data: session } = useSession();
  const token = session?.accessToken ?? "";

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // Message unread count — fetch once on mount
  useEffect(() => {
    if (!token) return;
    messageApi
      .listThreads(token)
      .then((threads) => {
        setUnreadMessages(threads.reduce((sum, t) => sum + t.unread_count, 0));
      })
      .catch(() => {});
  }, [token]);

  // Notification unread count — poll every 30 s
  useEffect(() => {
    if (!token) return;

    async function fetchNotifCount() {
      try {
        const data = await notificationApi.list(token);
        setUnreadNotifs(data.filter((n) => !n.is_read).length);
      } catch {
        // silent
      }
    }

    fetchNotifCount();
    const id = setInterval(fetchNotifCount, 30_000);
    return () => clearInterval(id);
  }, [token]);

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
      <Link href="/dashboard" className="text-lg font-bold text-primary-700">
        ResearchBridge
      </Link>

      <div className="flex items-center gap-2">
        {session?.user && (
          <>
            {/* 通知ベルアイコン */}
            <Link
              href="/notifications"
              className="relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              aria-label="通知"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
              <Badge count={unreadNotifs} />
            </Link>

            {/* メッセージアイコン */}
            <Link
              href="/messages"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              aria-label="メッセージ"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                />
              </svg>
              <Badge count={unreadMessages} />
            </Link>

            {/* ユーザー情報 */}
            <span className="hidden text-sm text-gray-600 sm:inline">
              {session.user.email}
              <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                {session.user.role === "researcher" ? "研究者" : "企業"}
              </span>
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              ログアウト
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
