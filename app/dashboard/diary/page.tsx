"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type DiaryEntry = {
  id: string;
  title: string | null;
  content: string;
  entry_date: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function DiaryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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
          .from("diary_entries")
          .select("id,title,content,entry_date")
          .eq("owner_id", currentUser.id)
          .eq("entry_date", todayIsoDate())
          .maybeSingle();

        if (error) {
          setMessage(error.message);
        }

        if (data) {
          setEntry(data);
          setTitle(data.title ?? "");
          setContent(data.content);
        }
      }

      setIsLoading(false);
    }

    loadUser();
  }, []);

  async function saveDiary() {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    setIsSaving(true);
    setMessage("");

    if (entry) {
      const { data, error } = await supabase
        .from("diary_entries")
        .update({ title, content })
        .eq("id", entry.id)
        .select("id,title,content,entry_date")
        .single();

      setIsSaving(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setEntry(data);
      setMessage("日记已保存。");
      return;
    }

    const { data, error } = await supabase
      .from("diary_entries")
      .insert({
        owner_id: user.id,
        title,
        content,
        entry_date: todayIsoDate(),
      })
      .select("id,title,content,entry_date")
      .single();

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEntry(data);
    setMessage("日记已保存。");
  }

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
        <input
          id="diary-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="今天的标题"
          disabled={!user}
        />
        <label htmlFor="diary-content">内容</label>
        <textarea
          id="diary-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="今天想记录的事..."
          rows={10}
          disabled={!user}
        />
        <button className="button primary" type="button" onClick={saveDiary} disabled={!user || isSaving}>
          {isSaving ? "保存中..." : "保存今天的日记"}
        </button>
        {message ? <p className="auth-message">{message}</p> : null}
      </section>
    </main>
  );
}
