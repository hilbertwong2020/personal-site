"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleGoogleLogin() {
    setIsLoading(true);
    setMessage("");

    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard/todos`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setIsLoading(false);
      setMessage(error.message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (mode === "sign-up") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      });

      setIsLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.session) {
        window.location.replace("/dashboard/todos");
        return;
      }

      setMessage("账号已创建。如果 Supabase 要求邮箱确认，请先去 Supabase 关闭 Confirm email。");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.replace("/dashboard/todos");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Private access</p>
        <h1>登录 Wang&apos;s Space</h1>
        <p>可以使用 Gmail 登录，也可以继续使用邮箱和密码。后面再做邀请制和管理员审批。</p>
        <button className="button google-button" type="button" onClick={handleGoogleLogin} disabled={isLoading}>
          使用 Gmail / Google 登录
        </button>
        <div className="auth-divider">或者使用邮箱密码</div>
        <div className="auth-tabs" aria-label="登录模式">
          <button
            className={mode === "sign-in" ? "active" : undefined}
            type="button"
            onClick={() => {
              setMode("sign-in");
              setMessage("");
            }}
          >
            登录
          </button>
          <button
            className={mode === "sign-up" ? "active" : undefined}
            type="button"
            onClick={() => {
              setMode("sign-up");
              setMessage("");
            }}
          >
            注册
          </button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "sign-up" ? (
            <>
              <label htmlFor="display-name">显示用户名</label>
              <input
                id="display-name"
                name="display-name"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Wang"
                required
              />
            </>
          ) : null}
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
          <label htmlFor="password">密码</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 6 位"
            minLength={6}
            required
          />
          <button className="button primary" type="submit" disabled={isLoading}>
            {isLoading ? "处理中..." : mode === "sign-up" ? "创建账号" : "登录"}
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
