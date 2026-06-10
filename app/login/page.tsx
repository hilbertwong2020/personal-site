"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("登录链接已经发送到邮箱。请打开邮件里的链接继续。");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Private access</p>
        <h1>登录 Wang&apos;s Space</h1>
        <p>
          现在先使用邮箱 magic link 登录。下一步我们会加邀请制和管理员审批，避免任何人随便注册。
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
          <button className="button primary" type="submit" disabled={isLoading}>
            {isLoading ? "发送中..." : "发送登录链接"}
          </button>
        </form>
        {message ? <p className="auth-message">{message}</p> : null}
        <a className="auth-back" href="/">
          回到首页
        </a>
      </section>
    </main>
  );
}
