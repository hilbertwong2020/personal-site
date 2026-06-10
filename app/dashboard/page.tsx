"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);
      setIsLoading(false);
    }

    loadUser();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/");
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <p className="eyebrow">Dashboard</p>
        <h1>个人后台</h1>
        {isLoading ? <p>正在读取登录状态...</p> : null}
        {!isLoading && !user ? (
          <>
            <p>你还没有登录。请先用邮箱登录。</p>
            <a className="button primary" href="/login">
              去登录
            </a>
          </>
        ) : null}
        {user ? (
          <>
            <p>已登录：{user.email}</p>
            <div className="dashboard-actions">
              <a className="button secondary" href="/">
                回首页
              </a>
              <button className="button primary" type="button" onClick={signOut}>
                退出登录
              </button>
            </div>
          </>
        ) : null}
      </section>
      <section className="dashboard-grid">
        <article className="card">
          <p className="card-meta">Next</p>
          <h2>邀请制</h2>
          <p>下一步会限制只有被邀请或被你审批的人才能进入个人空间。</p>
        </article>
        <article className="card">
          <p className="card-meta">Writing</p>
          <h2>博客写作</h2>
          <p>写公开文章、会员可见文章或仅自己可见的草稿。</p>
          <a className="card-link" href="/dashboard/writing">
            打开写作
          </a>
        </article>
        <article className="card">
          <p className="card-meta">Collaboration</p>
          <h2>协作文章</h2>
          <p>创建可以授权朋友查看或共同编辑的文章和文档。</p>
          <a className="card-link" href="/dashboard/collab">
            打开协作
          </a>
        </article>
        <article className="card">
          <p className="card-meta">Private</p>
          <h2>私密日记</h2>
          <p>登录打通后，我们会把私密日记保存到 Supabase，并用权限规则保护。</p>
          <a className="card-link" href="/dashboard/diary">
            打开日记
          </a>
        </article>
        <article className="card">
          <p className="card-meta">Today</p>
          <h2>待办和计时</h2>
          <p>这里会保存每日待办、专注计时和完成记录。</p>
          <a className="card-link" href="/dashboard/todos">
            打开待办
          </a>
        </article>
      </section>
    </main>
  );
}
