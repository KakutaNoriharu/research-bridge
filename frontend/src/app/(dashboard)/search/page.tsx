"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import UserCard from "@/components/UserCard";
import { searchApi, interestApi, type SearchResult, type RecommendationItem } from "@/lib/api";
import type { ResearcherProfile, CompanyProfile } from "@/types";

const COLLAB_OPTIONS: { value: string; label: string }[] = [
  { value: "joint_research", label: "共同研究" },
  { value: "commissioned_research", label: "受託研究" },
  { value: "consulting", label: "技術相談" },
  { value: "poc", label: "PoC" },
];

function toCardProps(item: RecommendationItem) {
  const p = item.profile as ResearcherProfile & CompanyProfile;
  const isResearcher = "university" in p;
  const name = isResearcher ? p.name : p.company_name;
  const affiliation = isResearcher ? p.university : (p.industry ?? "");
  const raw = isResearcher ? (p.research_summary ?? "") : (p.tech_needs ?? "");
  const summaryPreview = raw.length > 100 ? raw.slice(0, 100) + "…" : raw;
  return { userId: item.user_id, name, affiliation, summaryPreview, score: item.match_score };
}

function SearchContent() {
  const { data: session } = useSession();
  const token = session?.accessToken ?? "";

  const router = useRouter();
  const searchParams = useSearchParams();

  // form state (initialised from URL)
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [fieldInput, setFieldInput] = useState("");
  const [fieldTags, setFieldTags] = useState<string[]>(() => {
    const f = searchParams.get("fields");
    return f ? f.split(",").filter(Boolean) : [];
  });
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => {
    const t = searchParams.get("types");
    return t ? t.split(",").filter(Boolean) : [];
  });
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page") ?? "1"));

  // result state
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // interest state
  const [sentSet, setSentSet] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  const buildUrlParams = useCallback(
    (q: string, fields: string[], types: string[], page: number) => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (fields.length) p.set("fields", fields.join(","));
      if (types.length) p.set("types", types.join(","));
      if (page > 1) p.set("page", String(page));
      return p.toString();
    },
    [],
  );

  const doSearch = useCallback(
    async (q: string, fields: string[], types: string[], page: number) => {
      if (!token) return;
      abortRef.current?.abort();
      setLoading(true);
      setError("");
      try {
        const data = await searchApi.search(
          {
            q: q || undefined,
            fields: fields.length ? fields.join(",") : undefined,
            types: types.length ? types.join(",") : undefined,
            page,
          },
          token,
        );
        setResult(data);
      } catch {
        setError("検索に失敗しました。もう一度お試しください。");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // sync URL → form on browser back/forward
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const fields = searchParams.get("fields")?.split(",").filter(Boolean) ?? [];
    const types = searchParams.get("types")?.split(",").filter(Boolean) ?? [];
    const page = Number(searchParams.get("page") ?? "1");
    setQuery(q);
    setFieldTags(fields);
    setSelectedTypes(types);
    setCurrentPage(page);
    doSearch(q, fields, types, page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // load sent interests on mount
  useEffect(() => {
    if (!token) return;
    interestApi.list(token).then((res) => {
      const ids = new Set(
        res.sent.filter((i) => i.status !== "withdrawn").map((i) => i.receiver_id),
      );
      setSentSet(ids);
    }).catch(() => {});
  }, [token]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const qs = buildUrlParams(query, fieldTags, selectedTypes, 1);
    router.push(`/search${qs ? `?${qs}` : ""}`);
  }

  function handleReset() {
    setQuery("");
    setFieldTags([]);
    setSelectedTypes([]);
    setCurrentPage(1);
    router.push("/search");
  }

  function handleFieldKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = fieldInput.trim();
      if (val && !fieldTags.includes(val)) {
        setFieldTags((prev) => [...prev, val]);
      }
      setFieldInput("");
    }
  }

  function removeField(tag: string) {
    setFieldTags((prev) => prev.filter((t) => t !== tag));
  }

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    );
  }

  function goToPage(page: number) {
    const qs = buildUrlParams(query, fieldTags, selectedTypes, page);
    router.push(`/search${qs ? `?${qs}` : ""}`);
  }

  async function handleInterestSend(userId: string) {
    if (!token || sentSet.has(userId)) return;
    setSentSet((prev) => new Set([...prev, userId]));
    try {
      await interestApi.send(userId, token);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status !== 409) {
        setSentSet((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    }
  }

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const pages = result?.pages ?? 1;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">検索・一覧</h1>

      {/* Search form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        {/* Freetext */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            フリーワード
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前・概要・所属など"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Field keyword tags */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            研究分野・キーワード
          </label>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
            {fieldTags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeField(tag)}
                  className="text-primary-500 hover:text-primary-800"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={fieldInput}
              onChange={(e) => setFieldInput(e.target.value)}
              onKeyDown={handleFieldKeyDown}
              placeholder="入力してEnterで追加"
              className="min-w-[140px] flex-1 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Collab type checkboxes */}
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">連携形態</p>
          <div className="flex flex-wrap gap-4">
            {COLLAB_OPTIONS.map(({ value, label }) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(value)}
                  onChange={() => toggleType(value)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            検索
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            条件をリセット
          </button>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : result !== null ? (
        <>
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{total}</span> 件見つかりました
          </p>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <p className="text-gray-500">条件に一致するユーザーが見つかりませんでした</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const props = toCardProps(item);
                return (
                  <UserCard
                    key={item.user_id}
                    {...props}
                    hasInterestSent={sentSet.has(item.user_id)}
                    onInterestSend={handleInterestSend}
                  />
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                前へ
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {pages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= pages}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
