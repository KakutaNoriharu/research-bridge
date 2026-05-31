"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { authApi, ApiError } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type Role = "researcher" | "company";

type FieldErrors = {
  role?: string;
  email?: string;
  password?: string;
  confirm?: string;
  form?: string;
};

function validate(
  role: Role | null,
  email: string,
  password: string,
  confirm: string,
): FieldErrors {
  const errs: FieldErrors = {};

  if (!role) {
    errs.role = "アカウント種別を選択してください";
  }

  if (!email) {
    errs.email = "メールアドレスを入力してください";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errs.email = "有効なメールアドレスを入力してください";
  }

  if (!password) {
    errs.password = "パスワードを入力してください";
  } else if (password.length < 8) {
    errs.password = "パスワードは8文字以上で入力してください";
  }

  if (!confirm) {
    errs.confirm = "確認用パスワードを入力してください";
  } else if (password !== confirm) {
    errs.confirm = "パスワードが一致しません";
  }

  return errs;
}

function RegisterForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Landing page passes ?role=researcher or ?role=company to pre-select
  const qRole = searchParams.get("role") as Role | null;
  const [role, setRole] = useState<Role | null>(
    qRole === "researcher" || qRole === "company" ? qRole : null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  function clearError(field: keyof FieldErrors) {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errs = validate(role, email, password, confirm);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await authApi.register({ email, password, role: role! });

      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setErrors({
          form: "登録は完了しましたが、ログインに失敗しました。ログインページからお試しください。",
        });
      } else {
        router.push("/profile/edit");
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: "このメールアドレスは既に登録されています" });
      } else {
        setErrors({ form: err instanceof Error ? err.message : "登録に失敗しました" });
      }
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-lg">
      <h1 className="mb-6 text-xl font-semibold text-gray-800">アカウント作成</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* ── Role selector ── */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-700">アカウント種別</span>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: "researcher", label: "🔬 研究者" },
                { value: "company", label: "🏢 企業" },
              ] as { value: Role; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setRole(value);
                  clearError("role");
                }}
                className={[
                  "rounded-lg border-2 py-3 text-sm font-medium transition-colors",
                  role === value
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : errors.role
                      ? "border-red-300 text-gray-600 hover:border-red-400"
                      : "border-gray-200 text-gray-600 hover:border-gray-300",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.role && (
            <p className="text-xs text-red-600">{errors.role}</p>
          )}
        </div>

        {/* ── Email ── */}
        <Input
          label="メールアドレス"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError("email");
          }}
          error={errors.email}
        />

        {/* ── Password ── */}
        <Input
          label="パスワード"
          type="password"
          autoComplete="new-password"
          placeholder="8文字以上"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError("password");
            // Re-validate confirm match live if already touched
            if (confirm && e.target.value !== confirm) {
              setErrors((prev) => ({ ...prev, confirm: "パスワードが一致しません" }));
            } else if (confirm) {
              setErrors((prev) => ({ ...prev, confirm: undefined }));
            }
          }}
          error={errors.password}
        />

        {/* ── Confirm ── */}
        <Input
          label="パスワード（確認）"
          type="password"
          autoComplete="new-password"
          placeholder="もう一度入力"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (password && e.target.value !== password) {
              setErrors((prev) => ({ ...prev, confirm: "パスワードが一致しません" }));
            } else {
              setErrors((prev) => ({ ...prev, confirm: undefined }));
            }
          }}
          error={errors.confirm}
        />

        {/* ── Form-level error ── */}
        {errors.form && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {errors.form}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 w-full"
          size="lg"
        >
          {loading ? "登録中..." : "登録する"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        すでにアカウントをお持ちの方は{" "}
        <Link
          href="/auth/login"
          className="font-medium text-primary-600 hover:underline"
        >
          こちら
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
