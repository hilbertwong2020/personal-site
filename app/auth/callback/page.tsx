"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("正在完成登录...");

  useEffect(() => {
    async function finishLogin() {
      const searchParams = new URLSearchParams(window.location.search);
      const requestedNextPath = searchParams.get("next");
      const nextPath =
        requestedNextPath?.startsWith("/") && !requestedNextPath.startsWith("//")
          ? requestedNextPath
          : "/dashboard/todos";
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError = hashParams.get("error_description") || hashParams.get("error");

      if (hashError) {
        setMessage(decodeURIComponent(hashError.replaceAll("+", " ")));
        return;
      }

      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();

      if (existingSession) {
        window.location.replace(nextPath);
        return;
      }

      const code = searchParams.get("code");

      if (!code) {
        setMessage("登录链接无效或已过期。请回到登录页重新发送一封邮件。");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.replace(nextPath);
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
