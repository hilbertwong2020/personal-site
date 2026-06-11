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
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {
        const [entryResult, entriesResult] = await Promise.all([
          supabase
            .from("diary_entries")
            .select("id,title,content,entry_date")
            .eq("owner_id", currentUser.id)
            .eq("entry_date", selectedDate)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("diary_entries")
            .select("id,title,content,entry_date")
            .eq("owner_id", currentUser.id)
            .order("entry_date", { ascending: false })
            .limit(30),
        ]);

        if (entryResult.error ?? entriesResult.error) {
          setMessage(entryResult.error?.message ?? entriesResult.error?.message ?? "");
        }

        setEntries((entriesResult.data ?? []) as DiaryEntry[]);

        if (entryResult.data) {
          setEntry(entryResult.data);
          setTitle(entryResult.data.title ?? "");
          setContent(entryResult.data.content);
        } else {
          setEntry(null);
          setTitle("");
          setContent("");
        }
      }

      setIsLoading(false);
    }

    loadData();
  }, [selectedDate]);

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
          entry_date: selectedDate,
        })
        .select("id,title,content,entry_date")
        .single();

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEntry(data);
    setEntries((currentEntries) => {
      const nextEntries = [data as DiaryEntry, ...currentEntries.filter((item) => item.id !== data.id)];
      return nextEntries.sort((a, b) => b.entry_date.localeCompare(a.entry_date)).slice(0, 30);
    });
    setMessage("日记已保存。");
  }

  function chooseEntry(nextEntry: DiaryEntry) {
    setSelectedDate(nextEntry.entry_date);
    setEntry(nextEntry);
    setTitle(nextEntry.title ?? "");
    setContent(nextEntry.content);
    setMessage("");
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <p className="eyebrow">Private diary</p>
        <div className="hero-mini-nav">
          <a className="mini-button" href="/">
            回到主页
          </a>
          <a className="mini-button" href="/dashboard/todos">
            待办和计时
          </a>
          <p className="version-marker">版本标记：DIARY-MVP</p>
        </div>
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

      <section className="writing-layout">
        <aside className="sidebar-panel">
          <button className="button primary" type="button" onClick={() => setSelectedDate(todayIsoDate())} disabled={!user}>
            写今天
          </button>
          <div className="item-list">
            {entries.length === 0 ? <p className="timer-status">还没有日记。</p> : null}
            {entries.map((item) => (
              <button
                className={item.entry_date === selectedDate ? "item-button active" : "item-button"}
                type="button"
                onClick={() => chooseEntry(item)}
                key={item.id}
              >
                <strong>{item.title || "无标题日记"}</strong>
                <span>{item.entry_date}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="editor-panel">
          <label htmlFor="diary-date">日期</label>
          <input
            id="diary-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            disabled={!user}
          />
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
            rows={14}
            disabled={!user}
          />
          <button className="button primary" type="button" onClick={saveDiary} disabled={!user || isSaving}>
            {isSaving ? "保存中..." : "保存这一天的日记"}
          </button>
          <p className="timer-status">日记只保存在你的账号下，其他用户不会看到。</p>
          {message ? <p className="auth-message">{message}</p> : null}
        </section>
      </section>
    </main>
  );
}
