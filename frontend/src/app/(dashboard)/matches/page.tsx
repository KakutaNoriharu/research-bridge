import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { matchingApi } from "@/lib/api";
import type { Match } from "@/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function MatchesPage() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  const myRole = session?.user?.role;

  let matches: Match[] = [];
  if (token) {
    try {
      matches = await matchingApi.listMatches(token) as Match[];
    } catch {
      // empty state
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">マッチング一覧</h1>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-gray-500">まだマッチングがありません</p>
          <p className="mt-1 text-sm text-gray-400">相手にインタレストを送ってマッチングを成立させましょう</p>
          <Link
            href="/search"
            className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            候補を探す
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((match) => {
            const partnerId = myRole === "researcher" ? match.company_id : match.researcher_id;

            return (
              <div
                key={match.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {myRole === "researcher" ? "企業" : "研究者"} ID: {partnerId.slice(0, 8)}...
                  </p>
                  <p className="text-sm text-gray-400">
                    マッチング成立: {formatDate(match.matched_at)}
                  </p>
                </div>
                <Link
                  href={`/messages?match=${match.id}`}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  メッセージ
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
