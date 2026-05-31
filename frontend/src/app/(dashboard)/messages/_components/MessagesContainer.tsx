"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { messageApi, profileApi, type ThreadSummary } from "@/lib/api";
import type { Message } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return isToday
    ? d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
}

// ─── ThreadItem ──────────────────────────────────────────────────────────────

function ThreadItem({
  thread,
  isActive,
  partnerName,
  onClick,
}: {
  thread: ThreadSummary;
  isActive: boolean;
  partnerName: string;
  onClick: () => void;
}) {
  const lastBody = thread.last_message?.body ?? "";
  const preview = lastBody.length > 40 ? lastBody.slice(0, 40) + "…" : lastBody || "メッセージはまだありません";
  const timeLabel = thread.last_message
    ? formatTime(thread.last_message.created_at)
    : formatTime(thread.matched_at);

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
        isActive
          ? "border-l-4 border-primary-500 bg-primary-50"
          : "border-l-4 border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-medium text-gray-800">
          {partnerName || <span className="text-gray-400">読み込み中…</span>}
        </span>
        <span className="shrink-0 text-xs text-gray-400">{timeLabel}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-gray-500">{preview}</span>
        {thread.unread_count > 0 && (
          <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1 text-xs font-bold text-white">
            {thread.unread_count > 99 ? "99+" : thread.unread_count}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── MessageBubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm ${
          isMine
            ? "rounded-br-sm bg-primary-600 text-white"
            : "rounded-bl-sm bg-white text-gray-800 shadow-sm"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={`mt-1 text-right text-[10px] ${
            isMine ? "text-primary-200" : "text-gray-400"
          }`}
        >
          {formatTime(message.created_at)}
          {isMine && message.is_read && <span className="ml-1">既読</span>}
        </p>
      </div>
    </div>
  );
}

// ─── MessagesContainer ───────────────────────────────────────────────────────

export default function MessagesContainer({
  initialMatchId,
}: {
  initialMatchId?: string;
}) {
  const { data: session } = useSession();
  const token = session?.accessToken ?? "";
  const myId = session?.user?.id ?? "";
  const myRole = session?.user?.role ?? "";

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [partnerNames, setPartnerNames] = useState<Map<string, string>>(new Map());
  const [activeMatchId, setActiveMatchId] = useState<string | null>(
    initialMatchId ?? null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  // mobile: "list" shows thread panel, "chat" shows message panel
  const [mobileView, setMobileView] = useState<"list" | "chat">(
    initialMatchId ? "chat" : "list",
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSelectedRef = useRef(false);

  // ── data loading ────────────────────────────────────────────────────────

  const loadThreads = useCallback(async () => {
    if (!token || !myRole) return;
    setThreadsLoading(true);
    try {
      const data = await messageApi.listThreads(token);
      setThreads(data);

      // Auto-select first thread on PC when no initialMatchId provided
      if (!autoSelectedRef.current && !initialMatchId && data.length > 0) {
        autoSelectedRef.current = true;
        setActiveMatchId(data[0].match_id);
        window.history.replaceState(null, "", `/messages/${data[0].match_id}`);
      }

      // Resolve partner names in parallel
      const names = new Map<string, string>();
      await Promise.allSettled(
        data.map(async (thread) => {
          try {
            if (myRole === "researcher") {
              const p = await profileApi.getCompany(thread.partner_user_id, token);
              names.set(thread.partner_user_id, p.company_name);
            } else {
              const p = await profileApi.getResearcher(thread.partner_user_id, token);
              names.set(thread.partner_user_id, p.name);
            }
          } catch {
            names.set(thread.partner_user_id, thread.partner_user_id.slice(0, 8));
          }
        }),
      );
      setPartnerNames(new Map(names));
    } catch {
      // silently ignore
    } finally {
      setThreadsLoading(false);
    }
  }, [token, myRole, initialMatchId]);

  const loadMessages = useCallback(
    async (matchId: string) => {
      if (!token) return;
      setMessagesLoading(true);
      setMessagesError("");
      try {
        const data = await messageApi.getThread(matchId, token);
        setMessages(data);
        await messageApi.markAsRead(matchId, token);
        setThreads((prev) =>
          prev.map((t) => (t.match_id === matchId ? { ...t, unread_count: 0 } : t)),
        );
      } catch {
        setMessagesError("メッセージの読み込みに失敗しました");
      } finally {
        setMessagesLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (activeMatchId) loadMessages(activeMatchId);
  }, [activeMatchId, loadMessages]);

  // Scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── interactions ────────────────────────────────────────────────────────

  function selectThread(matchId: string) {
    if (matchId === activeMatchId) return;
    setActiveMatchId(matchId);
    setMessages([]);
    setMobileView("chat");
    window.history.replaceState(null, "", `/messages/${matchId}`);
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if (!activeMatchId || !text || sending) return;
    setSending(true);
    setBody("");
    try {
      const msg = await messageApi.send(activeMatchId, text, token);
      setMessages((prev) => [...prev, msg]);
      setThreads((prev) =>
        prev.map((t) =>
          t.match_id === activeMatchId ? { ...t, last_message: msg } : t,
        ),
      );
    } catch {
      setBody(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  // ── derived state ────────────────────────────────────────────────────────

  const activeThread = threads.find((t) => t.match_id === activeMatchId);
  const partnerName = activeThread
    ? (partnerNames.get(activeThread.partner_user_id) ?? "")
    : "";

  // ── render ───────────────────────────────────────────────────────────────

  const threadListPanel = (
    <div className="flex h-full flex-col border-r border-gray-200">
      <div className="border-b border-gray-200 px-4 py-3.5">
        <h2 className="font-semibold text-gray-800">メッセージ</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {threadsLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : threads.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">
            まだスレッドがありません
          </p>
        ) : (
          threads.map((thread) => (
            <ThreadItem
              key={thread.match_id}
              thread={thread}
              isActive={thread.match_id === activeMatchId}
              partnerName={partnerNames.get(thread.partner_user_id) ?? ""}
              onClick={() => selectThread(thread.match_id)}
            />
          ))
        )}
      </div>
    </div>
  );

  const chatPanel = activeMatchId ? (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3.5">
        <button
          onClick={() => setMobileView("list")}
          className="shrink-0 text-sm text-gray-500 hover:text-gray-700 lg:hidden"
        >
          ← 戻る
        </button>
        <span className="font-semibold text-gray-800">{partnerName || "…"}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
        {messagesLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : messagesError ? (
          <p className="text-center text-sm text-red-500">{messagesError}</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            まだメッセージがありません。最初のメッセージを送りましょう。
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMine={msg.sender_id === myId}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-3 border-t border-gray-200 bg-white px-4 py-3"
      >
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="メッセージを入力… (Shift+Enterで改行)"
          rows={2}
          maxLength={5000}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "送信中…" : "送信"}
        </button>
      </form>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-gray-400">スレッドを選択してください</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ── Desktop: side-by-side ── */}
      <div className="hidden w-1/3 shrink-0 lg:block">{threadListPanel}</div>
      <div className="hidden flex-1 lg:block">{chatPanel}</div>

      {/* ── Mobile: toggle ── */}
      <div
        className={`w-full lg:hidden ${mobileView === "list" ? "block" : "hidden"}`}
      >
        {threadListPanel}
      </div>
      <div
        className={`w-full lg:hidden ${mobileView === "chat" ? "block" : "hidden"}`}
      >
        {chatPanel}
      </div>
    </div>
  );
}
