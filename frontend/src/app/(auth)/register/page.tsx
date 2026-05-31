"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authApi } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type Role = "researcher" | "company";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("researcher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authApi.register({ email, password, role });

      // Auto-login after registration
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("登録は完了しましたが、ログインに失敗しました。ログインページからお試しください。");
      } else {
        router.push("/profile");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-lg">
      <h2 className="mb-6 text-xl font-semibold text-gray-800">新規登録</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Role selector */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">アカウント種別</span>
          <div className="grid grid-cols-2 gap-3">
            {(["researcher", "company"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-lg border-2 py-3 text-sm font-medium transition-colors ${
                  role === r
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {r === "researcher" ? "🔬 研究者" : "🏢 企業"}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="メールアドレス"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="パスワード（8文字以上）"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" loading={loading} className="mt-2 w-full" size="lg">
          登録する
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        既にアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-medium text-primary-600 hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
