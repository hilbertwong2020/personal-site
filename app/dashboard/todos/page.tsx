"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

const plannedTodos = ["整理课程 PDF", "写第一篇公开文章", "测试邮箱登录"];

export default function TodosPage() {
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
        <p className="eyebrow">Today</p>
        <h1>待办和计时</h1>
        {isLoading ? <p>正在读取登录状态...</p> : null}
        {!isLoading && !user ? (
          <>
            <p>登录后，这里的待办事项和计时记录会保存到你的账号里。</p>
            <a className="button primary" href="/login">
              去登录
            </a>
          </>
        ) : null}
        {user ? <p>已登录：{user.email}</p> : null}
      </section>

      <section className="editor-panel">
        <label htmlFor="todo-title">新待办</label>
        <input id="todo-title" placeholder="输入今天要做的事" />
        <button className="button primary" type="button" disabled>
          添加功能下一步接数据库
        </button>
        <div className="todo-preview-list">
          {plannedTodos.map((todo) => (
            <label className="todo-item" key={todo}>
              <input type="checkbox" disabled />
              <span>{todo}</span>
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
