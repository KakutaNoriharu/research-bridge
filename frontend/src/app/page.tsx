"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const features = [
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
      </svg>
    ),
    title: "AIによる意味的マッチング",
    description:
      "キーワードの一致ではなく、研究内容の意味をAIが深く理解。技術ニーズと研究シーズを意味レベルで照合し、本当に相性のいい相手を見つけます。",
  },
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    title: "双方向プラットフォーム",
    description:
      "研究者・企業どちらからでもアプローチ可能。インタレスト（興味あり）を双方が送り合い、両者が一致した時点でマッチング成立。押しつけのない対等な出会いを実現します。",
  },
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
    title: "アプリ内メッセージ",
    description:
      "マッチング成立後すぐにプラットフォーム内でやり取りを開始。メールアドレスや連絡先を交換しなくても、安全にコミュニケーションを取れます。",
  },
];

export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <span className="text-lg font-bold tracking-tight text-white">ResearchBridge</span>
            <span className="ml-3 hidden text-sm text-slate-400 sm:inline">研究と企業をAIでつなぐ</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              ログイン
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-400"
            >
              無料登録
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-slate-900 via-primary-900 to-slate-800 px-6 py-24 text-center text-white md:py-36">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary-300">
          産学連携マッチングプラットフォーム
        </p>
        <h2 className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          研究と企業を
          <br className="hidden sm:block" />
          AIでつなぐ
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
          研究者の知見と企業の技術ニーズをAIが意味レベルで照合。
          <br className="hidden md:block" />
          いままで出会えなかった最適なパートナーが見つかります。
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/register?role=researcher"
            className="w-full rounded-xl bg-white px-8 py-4 text-sm font-semibold text-primary-700 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
          >
            🔬 研究者として始める
          </Link>
          <Link
            href="/auth/register?role=company"
            className="w-full rounded-xl border border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20 sm:w-auto"
          >
            🏢 企業として始める
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h3 className="mb-3 text-center text-3xl font-bold text-gray-900">
            ResearchBridge の特徴
          </h3>
          <p className="mb-14 text-center text-gray-500">
            産学連携をもっとスムーズに、もっとスマートに。
          </p>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {features.map(({ icon, title, description }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-7 transition-shadow hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                  {icon}
                </div>
                <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
                <p className="text-sm leading-relaxed text-gray-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-primary-600 px-6 py-16 text-center text-white">
        <h3 className="mb-3 text-2xl font-bold md:text-3xl">今すぐ始めよう</h3>
        <p className="mb-8 text-primary-100">無料で登録して、AIマッチングを体験してください。</p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/register?role=researcher"
            className="w-full rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 sm:w-auto"
          >
            研究者として登録
          </Link>
          <Link
            href="/auth/register?role=company"
            className="w-full rounded-xl border border-white/40 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
          >
            企業として登録
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-gray-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center gap-2 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <p className="font-bold text-gray-900">ResearchBridge</p>
              <p className="mt-0.5 text-sm text-gray-500">
                研究者と企業をAIでマッチングする産学連携プラットフォーム
              </p>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link href="/auth/login" className="hover:text-primary-600 hover:underline">
                ログイン
              </Link>
              <Link href="/auth/register" className="hover:text-primary-600 hover:underline">
                新規登録
              </Link>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} ResearchBridge. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
