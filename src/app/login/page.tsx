"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  ApiError,
  clearSessionFlag,
  getMe,
  hasSessionFlag,
  login,
  logout,
  setAccessToken,
  signup,
  type User,
  type SignupPayload,
} from "@/lib/api";

type Alert = { type: "success" | "error"; message: string } | null;

type SignupFormFields = {
  displayName: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .email("正しい形式で入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

const signupSchema = z
  .object({
    displayName: z
      .string()
      .optional()
      .transform((value) => (value?.trim() ? value.trim() : undefined))
      .refine((value) => !value || value.length <= 100, {
        message: "表示名は100文字以内で入力してください",
      }),
    email: z
      .string()
      .trim()
      .min(1, "メールアドレスを入力してください")
      .email("正しい形式で入力してください"),
    password: z
      .string()
      .min(6, "パスワードは6文字以上で入力してください")
      .regex(/^[\x21-\x7E]+$/, "半角英数字・記号を使用してください"),
    passwordConfirm: z.string().min(1, "確認用パスワードを入力してください"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordConfirm"],
        message: "パスワードが一致しません",
      });
    }
  });

const apiBase = process.env.NEXT_PUBLIC_API_ENDPOINT?.replace(/\/+$/, "") ?? "";
const PRODUCT_CODE_STORAGE_KEY = "posProductCode";

export default function LoginPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loginAlert, setLoginAlert] = useState<Alert>(null);
  const [signupAlert, setSignupAlert] = useState<Alert>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [signupPending, setSignupPending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [productCode, setProductCode] = useState("");

  useEffect(() => {
    if (!hasSessionFlag()) {
      setInitializing(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const user = await getMe();
        if (!mounted) return;
        setCurrentUser(user);
      } catch {
        if (!mounted) return;
        clearSessionFlag();
        setCurrentUser(null);
      } finally {
        if (mounted) setInitializing(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PRODUCT_CODE_STORAGE_KEY) ?? "";
    if (stored) {
      setProductCode(stored.replace(/\D+/g, ""));
    }
  }, []);

  const handleProductCodeChange = useCallback((value: string) => {
    const numeric = value.replace(/\D+/g, "");
    setProductCode(numeric);
    if (typeof window === "undefined") return;
    if (numeric) {
      window.localStorage.setItem(PRODUCT_CODE_STORAGE_KEY, numeric);
    } else {
      window.localStorage.removeItem(PRODUCT_CODE_STORAGE_KEY);
    }
  }, []);

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoginAlert(null);
      setLoginPending(true);
      const form = new FormData(event.currentTarget);
      const candidate = {
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      };
      const parsed = loginSchema.safeParse(candidate);
      if (!parsed.success) {
        setLoginAlert({ type: "error", message: "入力内容をご確認ください" });
        setLoginPending(false);
        return;
      }
      try {
        const response = await login(parsed.data);
        setAccessToken(response.access_token);
        router.replace("/pos");
      } catch (error) {
        const err = error as ApiError;
        setLoginAlert({ type: "error", message: err?.message ?? "ログインに失敗しました" });
      } finally {
        setLoginPending(false);
      }
    },
    [router],
  );

  const handleSignup = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSignupAlert(null);
      setSignupPending(true);
      const form = new FormData(event.currentTarget);
      const raw: SignupFormFields = {
        displayName: String(form.get("displayName") ?? ""),
        email: String(form.get("signupEmail") ?? ""),
        password: String(form.get("signupPassword") ?? ""),
        passwordConfirm: String(form.get("signupPasswordConfirm") ?? ""),
      };
      const parsed = signupSchema.safeParse(raw);
      if (!parsed.success) {
        setSignupAlert({ type: "error", message: "入力内容をご確認ください" });
        setSignupPending(false);
        return;
      }
      try {
        const payload: SignupPayload = {
          email: parsed.data.email,
          password: parsed.data.password,
        };
        if (parsed.data.displayName) {
          payload.display_name = parsed.data.displayName;
        }
        const response = await signup(payload);
        setAccessToken(response.access_token);
        router.replace("/pos");
      } catch (error) {
        const err = error as ApiError;
        setSignupAlert({ type: "error", message: err?.message ?? "アカウント作成に失敗しました" });
      } finally {
        setSignupPending(false);
      }
    },
    [router],
  );

  const handleGoogleLogin = () => {
    setGoogleError(null);
    if (!apiBase) {
      setGoogleError("NEXT_PUBLIC_API_ENDPOINT が設定されていません");
      return;
    }
    const redirect = encodeURIComponent("/pos");
    window.location.href = `${apiBase}/auth/google/login?redirect=${redirect}`;
  };

  if (initializing) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-center text-slate-600">読み込み中...</p>
      </main>
    );
  }

  if (currentUser) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        <p className="text-slate-700">ログイン済み: {currentUser.display_name}</p>
        <button
          className="btn"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          ログアウト
        </button>
      </main>
    );
  }

  const renderAlert = (alert: Alert) =>
    alert ? (
      <p className={alert.type === "error" ? "text-rose-600" : "text-emerald-700"}>{alert.message}</p>
    ) : null;

  return (
    <main className="mx-auto grid max-w-4xl grid-cols-1 gap-8 p-6 md:grid-cols-2">
      <section className="rounded-xl bg-white/80 p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">ログイン</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="form-label">
              メールアドレス
            </label>
            <input id="email" name="email" type="email" className="input w-full" placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="form-label">
              パスワード
            </label>
            <input id="password" name="password" type="password" className="input w-full" placeholder="********" />
          </div>
          <div>
            <label htmlFor="productCode" className="form-label">
              商品コード（任意）
            </label>
            <input
              id="productCode"
              name="productCode"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input w-full"
              placeholder="123456"
              value={productCode}
              onChange={(event) => handleProductCodeChange(event.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">数値のみ入力できます。空欄のままでもログイン可能です。</p>
          </div>
          {renderAlert(loginAlert)}
          <button type="submit" className="btn btn-secondary w-full justify-center" disabled={loginPending}>
            {loginPending ? "送信中..." : "ログイン"}
          </button>
        </form>
        <div className="my-6 border-t" />
        <button className="btn w-full justify-center" onClick={handleGoogleLogin}>
          <span className="mr-2">G</span>
          Googleでログイン
        </button>
        {googleError && <p className="mt-2 text-sm text-rose-600">{googleError}</p>}
      </section>

      <section className="rounded-xl bg-white/80 p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">アカウント作成</h2>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="form-label">
              表示名（任意）
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              className="input w-full"
              placeholder="山田 太郎"
            />
          </div>
          <div>
            <label htmlFor="signupEmail" className="form-label">
              メールアドレス
            </label>
            <input
              id="signupEmail"
              name="signupEmail"
              type="email"
              className="input w-full"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="signupPassword" className="form-label">
              パスワード
            </label>
            <input
              id="signupPassword"
              name="signupPassword"
              type="password"
              className="input w-full"
              placeholder="********"
            />
            <p className="mt-1 text-xs text-slate-500">6文字以上の半角英数字・記号を使用してください。</p>
          </div>
          <div>
            <label htmlFor="signupPasswordConfirm" className="form-label">
              パスワード（確認）
            </label>
            <input
              id="signupPasswordConfirm"
              name="signupPasswordConfirm"
              type="password"
              className="input w-full"
              placeholder="********"
            />
          </div>
          {renderAlert(signupAlert)}
          <button type="submit" className="btn btn-secondary w-full justify-center" disabled={signupPending}>
            {signupPending ? "作成中..." : "アカウントを作成"}
          </button>
        </form>
      </section>
    </main>
  );
}
