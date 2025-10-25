'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import {
  ApiError,
  getMe,
  login,
  logout,
  setAccessToken,
  signup,
  type User,
} from '@/lib/api';

type AlertState = {
  type: 'success' | 'error';
  message: string;
};

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'メールアドレスを入力してください。')
    .email('有効なメールアドレスを入力してください。'),
  password: z.string().min(1, 'パスワードを入力してください。'),
});

const passwordHint =
  '英大文字・英小文字・数字・記号をそれぞれ1文字以上含めてください。';

const signupSchema = z
  .object({
    displayName: z
      .string()
      .optional()
      .transform((value) => {
        const trimmed = (value ?? '').trim();
        return trimmed.length ? trimmed : undefined;
      })
      .refine((value) => !value || value.length <= 100, {
        message: '表示名は100文字以内で入力してください。',
      }),
    email: z
      .string()
      .trim()
      .min(1, 'メールアドレスを入力してください。')
      .email('有効なメールアドレスを入力してください。'),
    password: z
      .string()
      .min(12, 'パスワードは12文字以上で入力してください。')
      .regex(/[A-Z]/, passwordHint)
      .regex(/[a-z]/, passwordHint)
      .regex(/[0-9]/, passwordHint)
      .regex(/[^A-Za-z0-9]/, passwordHint),
    passwordConfirm: z.string().min(1, '確認用パスワードを入力してください。'),
    agree: z.literal(true, {
      errorMap: () => ({
        message: '利用規約とプライバシーポリシーに同意してください。',
      }),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passwordConfirm'],
        message: 'パスワードが一致しません。',
      });
    }
  });

const apiBase = process.env.NEXT_PUBLIC_API_ENDPOINT?.replace(/\/+$/, '') ?? '';

type SignupErrorKey =
  | 'displayName'
  | 'email'
  | 'password'
  | 'passwordConfirm'
  | 'agree'
  | 'form';

type LoginErrorKey = 'email' | 'password';

export default function LoginPage(): JSX.Element {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [globalAlert, setGlobalAlert] = useState<AlertState | null>(null);

  const [loginErrors, setLoginErrors] = useState<Partial<Record<LoginErrorKey, string>>>({});
  const [loginAlert, setLoginAlert] = useState<AlertState | null>(null);
  const [loginPending, setLoginPending] = useState(false);

  const [signupErrors, setSignupErrors] = useState<Partial<Record<SignupErrorKey, string>>>({});
  const [signupAlert, setSignupAlert] = useState<AlertState | null>(null);
  const [signupPending, setSignupPending] = useState(false);

  const [lineError, setLineError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await getMe();
        if (!mounted) return;
        setCurrentUser(user);
      } catch {
        if (!mounted) return;
        setCurrentUser(null);
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginAlert(null);
    setLoginErrors({});
    setGlobalAlert(null);

    const formData = new FormData(event.currentTarget);
    const raw = {
      email: String(formData.get('loginEmail') ?? ''),
      password: String(formData.get('loginPassword') ?? ''),
    };

    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      const { fieldErrors } = parsed.error.flatten();
      setLoginErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setLoginPending(true);
    try {
      const response = await login(parsed.data);
      setAccessToken(response.access_token);
      setCurrentUser(response.user);
      event.currentTarget.reset();
      setLoginAlert({
        type: 'success',
        message: 'ログインしました。',
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginAlert({ type: 'error', message: error.message });
      } else {
        setLoginAlert({
          type: 'error',
          message: 'ログインに失敗しました。時間をおいて再度お試しください。',
        });
      }
    } finally {
      setLoginPending(false);
    }
  }, []);

  const handleSignup = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignupAlert(null);
    setSignupErrors({});
    setGlobalAlert(null);

    const formData = new FormData(event.currentTarget);
    const raw = {
      displayName: String(formData.get('signupDisplayName') ?? ''),
      email: String(formData.get('signupEmail') ?? ''),
      password: String(formData.get('signupPassword') ?? ''),
      passwordConfirm: String(formData.get('signupPasswordConfirm') ?? ''),
      agree: formData.get('signupAgree') === 'on',
    };

    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      const { fieldErrors, formErrors } = parsed.error.flatten();
      setSignupErrors({
        displayName: fieldErrors.displayName?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        passwordConfirm: fieldErrors.passwordConfirm?.[0],
        agree: fieldErrors.agree?.[0],
        form: formErrors[0],
      });
      return;
    }

    const { displayName, email, password } = parsed.data;
    setSignupPending(true);
    try {
      const response = await signup({
        email,
        password,
        ...(displayName ? { display_name: displayName } : {}),
      });
      setAccessToken(response.access_token);
      setCurrentUser(response.user);
      event.currentTarget.reset();
      setSignupAlert({
        type: 'success',
        message: 'アカウントを作成しました。',
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setSignupAlert({ type: 'error', message: error.message });
      } else {
        setSignupAlert({
          type: 'error',
          message: 'アカウントの作成に失敗しました。入力内容をご確認ください。',
        });
      }
    } finally {
      setSignupPending(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setGlobalAlert(null);
    try {
      await logout();
      setAccessToken(null);
      setCurrentUser(null);
      setGlobalAlert({
        type: 'success',
        message: 'ログアウトしました。',
      });
    } catch {
      setGlobalAlert({
        type: 'error',
        message: 'ログアウトに失敗しました。',
      });
    }
  }, []);

  const handleLineLogin = useCallback(() => {
    setLineError(null);
    if (!apiBase) {
      setLineError('NEXT_PUBLIC_API_ENDPOINT が設定されていません。');
      return;
    }
    window.location.href = `${apiBase}/auth/line/login`;
  }, []);

  const renderAlert = (alert: AlertState | null, id: string) => {
    if (!alert) {
      return null;
    }
    const className =
      alert.type === 'success'
        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
        : 'bg-rose-100 text-rose-800 border border-rose-200';
    return (
      <div id={id} className={`rounded-lg px-4 py-3 text-sm ${className}`}>
        {alert.message}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-rose-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10 text-center">
          <h1 className="title">ログイン / 新規ID作成</h1>
          <p className="msg text-slate-600">
            POSシステムをご利用いただくには、ログインまたはアカウント作成が必要です。
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            {initializing ? (
              <p className="text-sm text-slate-500">セッションを確認しています…</p>
            ) : currentUser ? (
              <div className="rounded-full bg-white/70 px-5 py-2 text-sm text-slate-700 shadow-sm">
                ようこそ、<span className="font-semibold">{currentUser.display_name}</span> さん
                {currentUser.email && (
                  <span className="ml-2 text-xs text-slate-500">({currentUser.email})</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">まだログインしていません。</p>
            )}

            {currentUser && (
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary px-4"
              >
                ログアウト
              </button>
            )}

            {renderAlert(globalAlert, 'global-alert')}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <section className="card bg-sky-50">
            <h2 className="section-title">ログイン</h2>
            <p className="section-subtitle">
              登録済みのメールアドレスとパスワードでサインインしてください。
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleLogin} noValidate>
              <div>
                <label htmlFor="login-email" className="form-label">
                  メールアドレス
                </label>
                <input
                  id="login-email"
                  name="loginEmail"
                  type="email"
                  autoComplete="email"
                  className={`input w-full ${loginErrors.email ? 'ring-2 ring-rose-400' : ''}`}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(loginErrors.email)}
                  aria-describedby={loginErrors.email ? 'login-email-error' : undefined}
                  disabled={loginPending}
                />
                {loginErrors.email && (
                  <p id="login-email-error" className="mt-1 text-sm text-rose-600">
                    {loginErrors.email}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="login-password" className="form-label">
                  パスワード
                </label>
                <input
                  id="login-password"
                  name="loginPassword"
                  type="password"
                  autoComplete="current-password"
                  className={`input w-full ${loginErrors.password ? 'ring-2 ring-rose-400' : ''}`}
                  placeholder="********"
                  aria-invalid={Boolean(loginErrors.password)}
                  aria-describedby={loginErrors.password ? 'login-password-error' : undefined}
                  disabled={loginPending}
                />
                {loginErrors.password && (
                  <p id="login-password-error" className="mt-1 text-sm text-rose-600">
                    {loginErrors.password}
                  </p>
                )}
              </div>

              {renderAlert(loginAlert, 'login-alert')}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  className="btn btn-primary w-full justify-center disabled:opacity-60"
                  disabled={loginPending}
                >
                  {loginPending ? '送信中...' : 'ログイン'}
                </button>
              </div>
            </form>

            <div className="mt-8 border-t border-sky-100 pt-6">
              <p className="section-subtitle mb-3">またはソーシャルログイン</p>
              <button
                type="button"
                className="btn btn-line w-full justify-center disabled:opacity-60"
                onClick={handleLineLogin}
                disabled={loginPending || signupPending}
              >
                <span className="line-icon">LINE</span>
                LINEでログイン
              </button>
              {lineError && <p className="mt-2 text-sm text-rose-600">{lineError}</p>}
            </div>
          </section>

          <section className="card bg-rose-50">
            <h2 className="section-title">新規ID作成</h2>
            <p className="section-subtitle">
              メールアドレスでアカウントを作成し、店舗管理をスタートしましょう。
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleSignup} noValidate>
              <div>
                <label htmlFor="signup-name" className="form-label">
                  お名前（任意）
                </label>
                <input
                  id="signup-name"
                  name="signupDisplayName"
                  type="text"
                  className={`input w-full ${signupErrors.displayName ? 'ring-2 ring-rose-400' : ''}`}
                  placeholder="山田 太郎"
                  disabled={signupPending}
                  aria-invalid={Boolean(signupErrors.displayName)}
                  aria-describedby={signupErrors.displayName ? 'signup-name-error' : undefined}
                />
                {signupErrors.displayName && (
                  <p id="signup-name-error" className="mt-1 text-sm text-rose-600">
                    {signupErrors.displayName}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="signup-email" className="form-label">
                  メールアドレス
                </label>
                <input
                  id="signup-email"
                  name="signupEmail"
                  type="email"
                  className={`input w-full ${signupErrors.email ? 'ring-2 ring-rose-400' : ''}`}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={signupPending}
                  aria-invalid={Boolean(signupErrors.email)}
                  aria-describedby={signupErrors.email ? 'signup-email-error' : undefined}
                />
                {signupErrors.email && (
                  <p id="signup-email-error" className="mt-1 text-sm text-rose-600">
                    {signupErrors.email}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="signup-password" className="form-label">
                  パスワード
                </label>
                <input
                  id="signup-password"
                  name="signupPassword"
                  type="password"
                  className={`input w-full ${signupErrors.password ? 'ring-2 ring-rose-400' : ''}`}
                  placeholder="********"
                  autoComplete="new-password"
                  disabled={signupPending}
                  aria-invalid={Boolean(signupErrors.password)}
                  aria-describedby={signupErrors.password ? 'signup-password-error' : undefined}
                />
                <p className="mt-1 text-xs text-slate-500">
                  12文字以上で、英大文字・英小文字・数字・記号を含めてください。
                </p>
                {signupErrors.password && (
                  <p id="signup-password-error" className="mt-1 text-sm text-rose-600">
                    {signupErrors.password}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="signup-password2" className="form-label">
                  パスワード（確認）
                </label>
                <input
                  id="signup-password2"
                  name="signupPasswordConfirm"
                  type="password"
                  className={`input w-full ${signupErrors.passwordConfirm ? 'ring-2 ring-rose-400' : ''}`}
                  placeholder="********"
                  autoComplete="new-password"
                  disabled={signupPending}
                  aria-invalid={Boolean(signupErrors.passwordConfirm)}
                  aria-describedby={signupErrors.passwordConfirm ? 'signup-password2-error' : undefined}
                />
                {signupErrors.passwordConfirm && (
                  <p id="signup-password2-error" className="mt-1 text-sm text-rose-600">
                    {signupErrors.passwordConfirm}
                  </p>
                )}
              </div>

              <div className={`flex items-start gap-3 rounded-lg bg-white/60 p-4 ${signupErrors.agree ? 'ring-2 ring-rose-400' : ''}`}>
                <input
                  id="signup-agree"
                  name="signupAgree"
                  type="checkbox"
                  className="mt-1 h-5 w-5 rounded border-slate-300"
                  disabled={signupPending}
                  aria-invalid={Boolean(signupErrors.agree)}
                  aria-describedby={signupErrors.agree ? 'signup-agree-error' : undefined}
                />
                <label htmlFor="signup-agree" className="text-sm text-slate-700">
                  利用規約とプライバシーポリシーに同意します。
                </label>
              </div>
              {signupErrors.agree && (
                <p id="signup-agree-error" className="text-sm text-rose-600">
                  {signupErrors.agree}
                </p>
              )}

              {signupErrors.form && (
                <p className="text-sm text-rose-600">{signupErrors.form}</p>
              )}
              {renderAlert(signupAlert, 'signup-alert')}

              <button
                type="submit"
                className="btn btn-secondary w-full justify-center disabled:opacity-60"
                disabled={signupPending}
              >
                {signupPending ? '送信中...' : 'アカウントを作成'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
