"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export default function DiaryPage() {
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

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <p className="eyebrow">Private diary</p>
        <h1>私密日记</h1>
        {isLoading ? <p>正在读取登录状态...</p> : null}
        {!isLoading && !user ? (
          <>
            <p>这里以后只对你自己开放。请先登录，再写入和保存日记。</p>
            <a className="button primary" href="/login">
              去登录
            </a>
          </>
        ) : null}
        {user ? <p>已登录：{user.email}</p> : null}
      </section>

      <section className="editor-panel">
        <label htmlFor="diary-title">标题</label>
        <input id="diary-title" placeholder="今天的标题" />
        <label htmlFor="diary-content">内容</label>
        <textarea id="diary-content" placeholder="今天想记录的事..." rows={10} />
        <button className="button primary" type="button" disabled>
          保存功能下一步接数据库
        </button>
      </section>
    </main>
  );
}
