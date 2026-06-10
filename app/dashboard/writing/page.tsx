"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type Visibility = "public" | "members" | "private" | "shared";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  visibility: Visibility;
  published_at: string | null;
  created_at: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function WritingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [isPublished, setIsPublished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId],
  );

  useEffect(() => {
    async function loadData() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {
        const { data, error } = await supabase
          .from("posts")
          .select("id,title,slug,excerpt,content,visibility,published_at,created_at")
          .eq("author_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (error) {
          setMessage(error.message);
        } else {
          setPosts((data ?? []) as Post[]);
        }
      }

      setIsLoading(false);
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!selectedPost) {
      return;
    }

    setTitle(selectedPost.title);
    setSlug(selectedPost.slug);
    setExcerpt(selectedPost.excerpt ?? "");
    setContent(selectedPost.content);
    setVisibility(selectedPost.visibility);
    setIsPublished(Boolean(selectedPost.published_at));
  }, [selectedPost]);

  function startNewPost() {
    setSelectedPostId(null);
    setTitle("");
    setSlug("");
    setExcerpt("");
    setContent("");
    setVisibility("public");
    setIsPublished(false);
    setMessage("");
  }

  async function savePost() {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const finalTitle = title.trim();
    const finalSlug = (slug.trim() || slugify(finalTitle)).toLowerCase();

    if (!finalTitle || !finalSlug) {
      setMessage("标题和 slug 都不能为空。");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const payload = {
      title: finalTitle,
      slug: finalSlug,
      excerpt: excerpt.trim(),
      content,
      visibility,
      published_at: isPublished ? new Date().toISOString() : null,
    };

    if (selectedPostId) {
      const { data, error } = await supabase
        .from("posts")
        .update(payload)
        .eq("id", selectedPostId)
        .select("id,title,slug,excerpt,content,visibility,published_at,created_at")
        .single();

      setIsSaving(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setPosts((currentPosts) =>
        currentPosts.map((post) => (post.id === selectedPostId ? (data as Post) : post)),
      );
      setMessage("文章已保存。");
      return;
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({
        ...payload,
        author_id: user.id,
      })
      .select("id,title,slug,excerpt,content,visibility,published_at,created_at")
      .single();

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPosts((currentPosts) => [data as Post, ...currentPosts]);
    setSelectedPostId(data.id);
    setMessage("文章已创建。");
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <p className="eyebrow">Writing studio</p>
        <h1>博客写作</h1>
        {isLoading ? <p>正在读取登录状态...</p> : null}
        {!isLoading && !user ? (
          <>
            <p>请先登录，再写文章。</p>
            <a className="button primary" href="/login">
              去登录
            </a>
          </>
        ) : null}
        {user ? <p>已登录：{user.email}</p> : null}
      </section>

      <section className="writing-layout">
        <aside className="sidebar-panel">
          <button className="button primary" type="button" onClick={startNewPost} disabled={!user}>
            新文章
          </button>
          <div className="item-list">
            {posts.map((post) => (
              <button
                className={post.id === selectedPostId ? "item-button active" : "item-button"}
                type="button"
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
              >
                <strong>{post.title}</strong>
                <span>{post.published_at ? "已发布" : "草稿"} · {post.visibility}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="editor-panel">
          <label htmlFor="post-title">标题</label>
          <input
            id="post-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!selectedPostId) {
                setSlug(slugify(event.target.value));
              }
            }}
            placeholder="文章标题"
            disabled={!user}
          />
          <label htmlFor="post-slug">Slug</label>
          <input id="post-slug" value={slug} onChange={(event) => setSlug(event.target.value)} disabled={!user} />
          <label htmlFor="post-excerpt">摘要</label>
          <input
            id="post-excerpt"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="一句话简介"
            disabled={!user}
          />
          <label htmlFor="post-visibility">可见性</label>
          <select
            id="post-visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
            disabled={!user}
          >
            <option value="public">公开</option>
            <option value="members">登录用户可见</option>
            <option value="private">仅自己可见</option>
          </select>
          <label className="todo-item">
            <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
            <span>发布文章</span>
          </label>
          <label htmlFor="post-content">正文</label>
          <textarea
            id="post-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="开始写文章..."
            rows={14}
            disabled={!user}
          />
          <button className="button primary" type="button" onClick={savePost} disabled={!user || isSaving}>
            {isSaving ? "保存中..." : "保存文章"}
          </button>
          {message ? <p className="auth-message">{message}</p> : null}
        </section>
      </section>
    </main>
  );
}
