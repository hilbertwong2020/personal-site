"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type DiaryEntry = {
  id: string;
  title: string | null;
  content: string;
  entry_date: string;
  created_at?: string;
};

type SpeechRecognitionResultItem = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionResultItem;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function DiaryPage() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [speechLanguage, setSpeechLanguage] = useState("zh-CN");
  const [speechPreview, setSpeechPreview] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);
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
        const entriesResult = await supabase
          .from("diary_entries")
          .select("id,title,content,entry_date,created_at")
          .eq("owner_id", currentUser.id)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50);

        if (entriesResult.error) {
          setMessage(entriesResult.error.message);
        }

        setEntries((entriesResult.data ?? []) as DiaryEntry[]);
      }

      setIsLoading(false);
    }

    loadData();
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = content;
    }
  }, [entry?.id, selectedDate]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    [],
  );

  function syncEditorContent() {
    setContent(editorRef.current?.innerHTML ?? "");
  }

  function runEditorCommand(command: string, value?: string) {
    if (!user) {
      return;
    }

    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorContent();
  }

  function transformSelection(transform: (value: string) => string) {
    if (!user) {
      return;
    }

    editorRef.current?.focus();
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const text = selection.toString();

    if (!text) {
      return;
    }

    document.execCommand("insertText", false, transform(text));
    syncEditorContent();
  }

  function insertSpeechText(value: string) {
    editorRef.current?.focus();
    document.execCommand("insertText", false, value);
    syncEditorContent();
  }

  async function refreshDiaryEntries(ownerId: string) {
    const { data, error } = await supabase
      .from("diary_entries")
      .select("id,title,content,entry_date,created_at")
      .eq("owner_id", ownerId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setMessage(error.message);
      return [];
    }

    const freshEntries = (data ?? []) as DiaryEntry[];
    setEntries(freshEntries);
    return freshEntries;
  }

  function toggleSpeechInput() {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setSpeechPreview("");
      return;
    }

    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("这个浏览器暂不支持语音输入。请用 Chrome 或 Edge 试试。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLanguage;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];

        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        insertSpeechText(`${finalText.trim()} `);
      }

      setSpeechPreview(interimText.trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setSpeechPreview("");
      setMessage(`语音输入停止：${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
      setSpeechPreview("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setMessage("语音输入已开始。浏览器可能会要求麦克风权限。");
  }

  async function saveDiary(options: { forceNew?: boolean } = {}) {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const currentContent = editorRef.current?.innerHTML ?? content;

    setIsSaving(true);
    setMessage("");

    if (entry && !options.forceNew) {
      const { data, error } = await supabase
        .from("diary_entries")
        .update({ title, content: currentContent })
        .eq("id", entry.id)
        .select("id,title,content,entry_date,created_at")
        .single();

      setIsSaving(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setEntry(data);
      setContent(data.content);
      const freshEntries = await refreshDiaryEntries(user.id);
      setMessage(`这篇旧日记已更新。数据库现在读到 ${freshEntries.length} 篇日记。`);
      return;
    }

    const { data, error } = await supabase
        .from("diary_entries")
        .insert({
          owner_id: user.id,
          title,
          content: currentContent,
          entry_date: selectedDate,
        })
        .select("id,title,content,entry_date,created_at")
        .single();

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEntry(data);
    setContent(data.content);
    const freshEntries = await refreshDiaryEntries(user.id);
    setMessage(`新日记已保存到 ${data.entry_date}。数据库现在读到 ${freshEntries.length} 篇日记。`);
  }

  function chooseEntry(nextEntry: DiaryEntry) {
    setSelectedDate(nextEntry.entry_date);
    setEntry(nextEntry);
    setTitle(nextEntry.title ?? "");
    setContent(nextEntry.content);
    setMessage("");
  }

  function startNewDiary(nextDate = todayIsoDate()) {
    setSelectedDate(nextDate);
    setEntry(null);
    setTitle("");
    setContent("");
    setMessage(`正在写 ${nextDate} 的新日记。保存后会新增一篇，不会覆盖旧日记。`);

    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  }

  const recentFiveDates = Array.from(new Set(entries.map((item) => item.entry_date))).slice(0, 5);
  const recentFiveDayEntries = entries.filter((item) => recentFiveDates.includes(item.entry_date));
  const visibleEntries = showAllEntries ? entries : recentFiveDayEntries;

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
          <p className="version-marker">版本标记：DIARY-NO-OVERWRITE</p>
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
          <button className="button primary" type="button" onClick={() => startNewDiary(todayIsoDate())} disabled={!user}>
            写今天
          </button>
          <button className="mini-button" type="button" onClick={() => startNewDiary(selectedDate)} disabled={!user}>
            新写一篇
          </button>
          <div className="diary-list-heading">
            <strong>{showAllEntries ? "全部日记" : "最近五天日记"}</strong>
            <span>{showAllEntries ? `${entries.length} 篇` : `${recentFiveDates.length} 天 / ${recentFiveDayEntries.length} 篇`}</span>
          </div>
          <div className="item-list">
            {entries.length === 0 ? (
              <p className="timer-status">当前登录账号还没有读到日记。请确认是不是用同一个邮箱写的。</p>
            ) : null}
            {visibleEntries.map((item) => (
              <button
                className={item.id === entry?.id ? "item-button active" : "item-button"}
                type="button"
                onClick={() => chooseEntry(item)}
                key={item.id}
              >
                <strong>{item.title || "无标题日记"}</strong>
                <span>{item.entry_date}</span>
              </button>
            ))}
          </div>
          {entries.length > recentFiveDayEntries.length ? (
            <button className="mini-button diary-list-toggle" type="button" onClick={() => setShowAllEntries((value) => !value)}>
              {showAllEntries ? "收起到最近五天" : "查看全部日记"}
            </button>
          ) : null}
        </aside>

        <section className="editor-panel">
          <div className="panel-heading-row">
            <div>
              <p className="eyebrow">Write</p>
              <h2>写日记</h2>
            </div>
            <div className="button-row compact-actions">
              {entry ? (
                <button className="mini-button" type="button" onClick={() => saveDiary({ forceNew: true })} disabled={!user || isSaving}>
                  另存为新篇
                </button>
              ) : null}
              <button className="button primary" type="button" onClick={() => saveDiary()} disabled={!user || isSaving}>
                {isSaving ? "保存中..." : entry ? "更新这篇日记" : "保存新日记"}
              </button>
            </div>
          </div>
          <label htmlFor="diary-date">日期</label>
          <input
            id="diary-date"
            type="date"
            value={selectedDate}
            onChange={(event) => startNewDiary(event.target.value)}
            disabled={!user}
          />
          {user && !entry ? <p className="timer-status">正在写 {selectedDate} 的新日记，保存后会新增到左侧列表。</p> : null}
          {user && entry ? <p className="timer-status">正在编辑一篇旧日记。要写第二篇，请点“新写一篇”或“另存为新篇”。</p> : null}
          <label htmlFor="diary-title">标题</label>
          <input
            id="diary-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="今天的标题"
            disabled={!user}
          />
          <label htmlFor="diary-rich-editor">内容</label>
          <div className="rich-toolbar" aria-label="日记格式工具栏">
            <select
              aria-label="段落格式"
              defaultValue="div"
              onChange={(event) => runEditorCommand("formatBlock", event.target.value)}
              disabled={!user}
            >
              <option value="div">正文</option>
              <option value="h2">标题</option>
              <option value="h3">小标题</option>
              <option value="blockquote">引用</option>
            </select>
            <select
              aria-label="字体"
              defaultValue="Arial"
              onChange={(event) => runEditorCommand("fontName", event.target.value)}
              disabled={!user}
            >
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times</option>
              <option value="Courier New">Courier</option>
            </select>
            <select
              aria-label="字号"
              defaultValue="3"
              onChange={(event) => runEditorCommand("fontSize", event.target.value)}
              disabled={!user}
            >
              <option value="2">小</option>
              <option value="3">正常</option>
              <option value="4">大</option>
              <option value="5">更大</option>
            </select>
            <select
              aria-label="语音输入语言"
              value={speechLanguage}
              onChange={(event) => setSpeechLanguage(event.target.value)}
              disabled={!user || isListening}
            >
              <option value="zh-CN">普通话</option>
              <option value="en-US">English</option>
            </select>
            <button
              className={isListening ? "voice-button listening" : "voice-button"}
              type="button"
              onClick={toggleSpeechInput}
              disabled={!user}
            >
              {isListening ? "停止语音输入" : "🎙 开始语音输入"}
            </button>
            <button type="button" onClick={() => runEditorCommand("bold")} disabled={!user}>
              B
            </button>
            <button type="button" onClick={() => runEditorCommand("italic")} disabled={!user}>
              I
            </button>
            <button type="button" onClick={() => runEditorCommand("underline")} disabled={!user}>
              U
            </button>
            <button type="button" onClick={() => runEditorCommand("strikeThrough")} disabled={!user}>
              S
            </button>
            <button type="button" onClick={() => transformSelection((value) => value.toUpperCase())} disabled={!user}>
              AA
            </button>
            <button type="button" onClick={() => transformSelection((value) => value.toLowerCase())} disabled={!user}>
              aa
            </button>
            <button type="button" onClick={() => runEditorCommand("insertUnorderedList")} disabled={!user}>
              • List
            </button>
            <button type="button" onClick={() => runEditorCommand("insertOrderedList")} disabled={!user}>
              1. List
            </button>
            <button type="button" onClick={() => runEditorCommand("justifyLeft")} disabled={!user}>
              左
            </button>
            <button type="button" onClick={() => runEditorCommand("justifyCenter")} disabled={!user}>
              中
            </button>
            <button type="button" onClick={() => runEditorCommand("insertHorizontalRule")} disabled={!user}>
              横线
            </button>
            <button type="button" onClick={() => runEditorCommand("removeFormat")} disabled={!user}>
              清格式
            </button>
          </div>
          {isListening || speechPreview ? (
            <div className="speech-preview" aria-live="polite">
              <span>实时语音预览</span>
              <p>{speechPreview || "正在听...你说的话会先显示在这里。"}</p>
            </div>
          ) : null}
          <div
            className="rich-editor"
            contentEditable={Boolean(user)}
            id="diary-rich-editor"
            onInput={syncEditorContent}
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            data-placeholder="今天想记录的事..."
            suppressContentEditableWarning
          />
          <div className="button-row compact-actions">
            {entry ? (
              <button className="mini-button" type="button" onClick={() => saveDiary({ forceNew: true })} disabled={!user || isSaving}>
                另存为新篇
              </button>
            ) : null}
            <button className="button primary" type="button" onClick={() => saveDiary()} disabled={!user || isSaving}>
              {isSaving ? "保存中..." : entry ? "更新这篇日记" : "保存这篇新日记"}
            </button>
          </div>
          <p className="timer-status">日记只保存在你的账号下，其他用户不会看到。</p>
          {message ? <p className="auth-message">{message}</p> : null}
        </section>
      </section>
    </main>
  );
}
