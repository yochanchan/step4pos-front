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
  email: z.string().trim().min(1, "メールアドレスを入力してください").email("正しい形式で入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

const signupSchema = z
  .object({
    displayName: z
      .string()
      .optional()
      .transform((v) => (v?.trim() ? v.trim() : undefined))
      .refine((v) => !v || v.length <= 100, {
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
      .regex(/^[\x21-\x7E]+$/, "半角の記号・英数字のみ使用できます"),
    passwordConfirm: z.string().min(1, "確認用パスワードを入力してください"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["passwordConfirm"], message: "パスワードが一致しません" });
    }
  });

const apiBase = process.env.NEXT_PUBLIC_API_ENDPOINT?.replace(/\/+$/, "") ?? "";

export default function LoginPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loginAlert, setLoginAlert] = useState<Alert>(null);
  const [signupAlert, setSignupAlert] = useState<Alert>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [signupPending, setSignupPending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

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

  const handleLogin = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginAlert(null);
    setLoginPending(true);
    const form = new FormData(e.currentTarget);
    const data = { email: String(form.get("email") || ""), password: String(form.get("password") || "") };
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) {
      setLoginAlert({ type: "error", message: "入力内容をご確認ください" });
      setLoginPending(false);
      return;
    }
    try {
      const res = await login(parsed.data);
      setAccessToken(res.access_token);
      router.replace("/");
    } catch (err) {
      const e = err as ApiError;
      setLoginAlert({ type: "error", message: e?.message || "ログインに失敗しました" });
    } finally {
      setLoginPending(false);
    }
  }, [router]);

  const handleSignup = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSignupAlert(null);
    setSignupPending(true);
    const form = new FormData(e.currentTarget);
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
      const res = await signup(payload);
      setAccessToken(res.access_token);
      router.replace("/");
    } catch (err) {
      const e = err as ApiError;
      setSignupAlert({ type: "error", message: e?.message || "アカウントの作成に失敗しました" });
    } finally {
      setSignupPending(false);
    }
  }, [router]);

  const handleGoogleLogin = useCallback(() => {
    setGoogleError(null);
    if (!apiBase) {
      setGoogleError("NEXT_PUBLIC_API_ENDPOINT が設定されていません。");
      return;
    }
    const redirect = encodeURIComponent("/");
    window.location.href = `${apiBase}/auth/google/login?redirect=${redirect}`;
  }, []);

  if (initializing) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-center text-slate-600">Loading...</p>
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

  const renderAlert = (a: Alert) =>
    a ? (
      <p className={a.type === "error" ? "text-rose-600" : "text-emerald-700"}>{a.message}</p>
    ) : null;

  return (
    <main className="mx-auto grid max-w-4xl grid-cols-1 gap-8 p-6 md:grid-cols-2">
      <section className="rounded-xl bg-white/70 p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">ログイン</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="form-label">メールアドレス</label>
            <input id="email" name="email" type="email" className="input w-full" placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="form-label">パスワード</label>
            <input id="password" name="password" type="password" className="input w-full" placeholder="********" />
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

      <section className="rounded-xl bg-white/70 p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">アカウント作成</h2>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="form-label">表示名（任意）</label>
            <input id="displayName" name="displayName" type="text" className="input w-full" placeholder="山田 太郎" />
          </div>
          <div>
            <label htmlFor="signupEmail" className="form-label">メールアドレス</label>
            <input id="signupEmail" name="signupEmail" type="email" className="input w-full" placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="signupPassword" className="form-label">パスワード</label>
            <input id="signupPassword" name="signupPassword" type="password" className="input w-full" placeholder="********" />
            <p className="mt-1 text-xs text-slate-500">6文字以上・半角記号英数字のみ</p>
          </div>
          <div>
            <label htmlFor="signupPasswordConfirm" className="form-label">パスワード（確認）</label>
            <input id="signupPasswordConfirm" name="signupPasswordConfirm" type="password" className="input w-full" placeholder="********" />
          </div>
          {renderAlert(signupAlert)}
          <button type="submit" className="btn btn-secondary w-full justify-center" disabled={signupPending}>
            {signupPending ? "送信中..." : "アカウントを作成"}
          </button>
        </form>
      </section>
    </main>
  );
}

