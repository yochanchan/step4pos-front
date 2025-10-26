"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSessionFlag, getMe, logout, setAccessToken } from "@/lib/api";

type CartItem = {
  name: string;
  price: number;
};

export default function PosPage() {
  const router = useRouter();
  const codeInput = useRef<HTMLInputElement>(null);
  const [lookup, setLookup] = useState<CartItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [checkoutTotal, setCheckoutTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const apiBase = process.env.NEXT_PUBLIC_API_ENDPOINT ?? "";

  useEffect(() => {
    let active = true;
    (async () => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        await getMe();
        if (active) {
          setInitializing(false);
        }
      } catch {
        if (!active) return;
        clearSessionFlag();
        router.replace("/login");
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);


  const fetchItem = useCallback(async () => {
    setError(null);
    const code = codeInput.current?.value.trim();
    if (!code) return;

    try {
      const response = await fetch(`${apiBase}/item?prd_code=${encodeURIComponent(code)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("lookup_failed");
      }
      const data = await response.json();
      setLookup({ name: data.name, price: data.price });
    } catch {
      setLookup(null);
      setError("商品が見つかりませんでした。");
    }
  }, [apiBase]);

  const addToCart = useCallback(() => {
    if (!lookup) return;
    setCart((current) => [...current, lookup]);
    setLookup(null);
    if (codeInput.current) {
      codeInput.current.value = "";
    }
  }, [lookup]);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.price, 0),
    [cart],
  );

  const handleDeal = useCallback(async () => {
    if (!cart.length) return;
    setError(null);
    const payload = {
      cartpayload: cart.map((_, index) => index + 1),
      amountpayload: totalAmount,
    };
    try {
      const response = await fetch(`${apiBase}/deal`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("deal_failed");
      }
      setCheckoutTotal(totalAmount);
      setModalOpen(true);
      setCart([]);
    } catch {
      setError("購入手続きに失敗しました。");
    }
  }, [apiBase, cart, totalAmount]);

  const handleLogout = useCallback(async () => {
    if (logoutPending) return;
    setLogoutError(null);
    setLogoutPending(true);
    try {
      await logout();
      setAccessToken(null);
      router.replace("/login");
    } catch {
      setLogoutError("ログアウトに失敗しました。再度お試しください。");
    } finally {
      setLogoutPending(false);
    }
  }, [logoutPending, router]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    if (codeInput.current) {
      codeInput.current.value = "";
    }
  }, []);

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">セッションを確認しています...</p>
      </main>
    );
  }

  return (
    <main className="space-y-6 bg-gray-50 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">ようちゃんPOSアプリ</h1>
          <p className="text-sm text-slate-500">Codexにもトライしました</p>
        </div>
        <div className="flex items-center gap-3">
          {logoutError && <p className="text-sm text-rose-600">{logoutError}</p>}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLogout}
            disabled={logoutPending}
          >
            {logoutPending ? "ログアウト中..." : "ログアウト"}
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 lg:grid-cols-[1fr,1fr]">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">商品番号指定</h2>
          <p className="text-sm text-slate-500">1~4のいずれかを入力して、青いボタンを押してください</p>
          <div className="mt-4 flex gap-3">
            <input ref={codeInput} type="text" className="input w-full" placeholder="商品コード" />
            <button className="btn btn-primary" onClick={fetchItem}>
              商品コード読み込み
            </button>
          </div>

          {lookup && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              <p>{lookup.name}</p>
              <p className="font-semibold">¥{lookup.price.toLocaleString()}</p>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button className="btn btn-secondary w-full disabled:opacity-50" onClick={addToCart} disabled={!lookup}>
              追加
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">購入リスト</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {cart.map((item, index) => (
              <li key={index} className="flex justify-between rounded bg-slate-50 px-3 py-2">
                <span>{item.name}</span>
                <span>¥{item.price.toLocaleString()}</span>
              </li>
            ))}
            {!cart.length && <li className="text-slate-400">まだ何も読み込まれていません</li>}
          </ul>
          <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-800">
            <span>合計</span>
            <span>¥{totalAmount.toLocaleString()}</span>
          </div>
          <button className="btn btn-primary mt-4 w-full disabled:opacity-50" onClick={handleDeal} disabled={!cart.length}>
            購入
          </button>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[90%] max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
            <p className="text-sm text-slate-600">購入できました！</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">合計金額: ¥{checkoutTotal.toLocaleString()}</p>
            <button className="btn btn-primary mt-4 w-full" onClick={closeModal}>
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
