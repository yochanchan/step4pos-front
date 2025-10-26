"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasSessionFlag } from "@/lib/api";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLoggedIn(hasSessionFlag());
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-2xl rounded-2xl bg-white/80 p-10 text-center shadow">
        <h1 className="text-3xl font-semibold text-slate-800">POSダッシュボード</h1>
        <p className="mt-3 text-sm text-slate-600">
          POSコンソールをご利用になるにはログインが必要です。メールアドレスとパスワード、またはGoogleアカウントでログインしてください。
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link href="/login" className="btn btn-primary w-full max-w-xs justify-center">
            ログインページへ
          </Link>
          {loggedIn && (
            <Link href="/pos" className="btn w-full max-w-xs justify-center">
              POSを開く
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
