"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type Todo = {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
};

export default function TodosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {
        const { data, error } = await supabase
          .from("todos")
          .select("id,title,completed,created_at")
          .eq("owner_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (error) {
          setMessage(error.message);
        } else {
          setTodos(data ?? []);
        }
      }

      setIsLoading(false);
    }

    loadUser();
  }, []);

  async function addTodo() {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const title = newTodo.trim();

    if (!title) {
      setMessage("请输入待办内容。");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("todos")
      .insert({
        owner_id: user.id,
        title,
      })
      .select("id,title,completed,created_at")
      .single();

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTodos((currentTodos) => [data, ...currentTodos]);
    setNewTodo("");
    setMessage("待办已添加。");
  }

  async function toggleTodo(todo: Todo) {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const nextCompleted = !todo.completed;
    setTodos((currentTodos) =>
      currentTodos.map((currentTodo) =>
        currentTodo.id === todo.id ? { ...currentTodo, completed: nextCompleted } : currentTodo,
      ),
    );

    const { error } = await supabase.from("todos").update({ completed: nextCompleted }).eq("id", todo.id);

    if (error) {
      setMessage(error.message);
      setTodos((currentTodos) =>
        currentTodos.map((currentTodo) =>
          currentTodo.id === todo.id ? { ...currentTodo, completed: todo.completed } : currentTodo,
        ),
      );
      return;
    }

    setMessage(nextCompleted ? "已标记完成。" : "已取消完成。");
  }

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
        <input
          id="todo-title"
          value={newTodo}
          onChange={(event) => setNewTodo(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              addTodo();
            }
          }}
          placeholder="输入今天要做的事"
          disabled={!user}
        />
        <button className="button primary" type="button" onClick={addTodo} disabled={!user || isSaving}>
          {isSaving ? "添加中..." : "添加待办"}
        </button>
        {message ? <p className="auth-message">{message}</p> : null}
        <div className="todo-preview-list">
          {todos.length === 0 ? <p className="timer-status">还没有待办。登录后可以添加今天的任务。</p> : null}
          {todos.map((todo) => (
            <label className="todo-item" key={todo.id}>
              <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo)} disabled={!user} />
              <span className={todo.completed ? "todo-done" : undefined}>{todo.title}</span>
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
