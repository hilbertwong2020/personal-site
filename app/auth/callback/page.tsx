"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("正在完成登录...");

  useEffect(() => {
    async function finishLogin() {
      const code = new URLSearchParams(window.location.search).get("code");

      if (!code) {
        setMessage("登录链接无效：缺少 code。");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.replace("/dashboard");
    }

    finishLogin();
  }, []);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Auth callback</p>
        <h1>登录处理中</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}
