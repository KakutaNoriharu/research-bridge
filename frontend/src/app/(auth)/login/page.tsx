"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-lg">
      <h2 className="mb-6 text-xl font-semibold text-gray-800">ログイン</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="メールアドレス"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="パスワード"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" loading={loading} className="mt-2 w-full" size="lg">
          ログイン
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        アカウントをお持ちでない方は{" "}
        <Link href="/register" className="font-medium text-primary-600 hover:underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
