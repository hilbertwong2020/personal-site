"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type PermissionLevel = "view" | "edit";

type Document = {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  visibility: "public" | "members" | "private" | "shared";
  created_at: string;
};

export default function CollabPage() {
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareLevel, setShareLevel] = useState<PermissionLevel>("edit");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const isOwner = Boolean(user && selectedDocument && selectedDocument.owner_id === user.id);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {
        const { data, error } = await supabase
          .from("documents")
          .select("id,owner_id,title,content,visibility,created_at")
          .order("created_at", { ascending: false });

        if (error) {
          setMessage(error.message);
        } else {
          setDocuments((data ?? []) as Document[]);
        }
      }

      setIsLoading(false);
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!selectedDocument) {
      return;
    }

    setTitle(selectedDocument.title);
    setContent(selectedDocument.content);
  }, [selectedDocument]);

  function startNewDocument() {
    setSelectedDocumentId(null);
    setTitle("");
    setContent("");
    setShareEmail("");
    setMessage("");
  }

  async function saveDocument() {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const finalTitle = title.trim();

    if (!finalTitle) {
      setMessage("标题不能为空。");
      return;
    }

    setIsSaving(true);
    setMessage("");

    if (selectedDocumentId) {
      const { data, error } = await supabase
        .from("documents")
        .update({ title: finalTitle, content, visibility: "shared" })
        .eq("id", selectedDocumentId)
        .select("id,owner_id,title,content,visibility,created_at")
        .single();

      setIsSaving(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setDocuments((currentDocuments) =>
        currentDocuments.map((document) => (document.id === selectedDocumentId ? (data as Document) : document)),
      );
      setMessage("协作文档已保存。");
      return;
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        owner_id: user.id,
        title: finalTitle,
        content,
        visibility: "shared",
      })
      .select("id,owner_id,title,content,visibility,created_at")
      .single();

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDocuments((currentDocuments) => [data as Document, ...currentDocuments]);
    setSelectedDocumentId(data.id);
    setMessage("协作文档已创建。");
  }

  async function shareDocument() {
    if (!user || !selectedDocument || !isOwner) {
      setMessage("只有文档 owner 可以授权。");
      return;
    }

    const email = shareEmail.trim().toLowerCase();

    if (!email) {
      setMessage("请输入朋友注册用的邮箱。");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    if (!profile) {
      setMessage("没有找到这个用户。朋友需要先注册一次。");
      return;
    }

    const { error } = await supabase.from("document_permissions").upsert({
      document_id: selectedDocument.id,
      user_id: profile.id,
      level: shareLevel,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`已授权 ${email} ${shareLevel === "edit" ? "编辑" : "查看"}。`);
    setShareEmail("");
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <p className="eyebrow">Collaboration</p>
        <h1>协作文章</h1>
        {isLoading ? <p>正在读取登录状态...</p> : null}
        {!isLoading && !user ? (
          <>
            <p>请先登录，再创建或编辑协作文档。</p>
            <a className="button primary" href="/login">
              去登录
            </a>
          </>
        ) : null}
        {user ? <p>已登录：{user.email}</p> : null}
      </section>

      <section className="writing-layout">
        <aside className="sidebar-panel">
          <button className="button primary" type="button" onClick={startNewDocument} disabled={!user}>
            新协作文档
          </button>
          <div className="item-list">
            {documents.map((document) => (
              <button
                className={document.id === selectedDocumentId ? "item-button active" : "item-button"}
                type="button"
                key={document.id}
                onClick={() => setSelectedDocumentId(document.id)}
              >
                <strong>{document.title}</strong>
                <span>{document.owner_id === user?.id ? "我创建的" : "别人分享的"}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="editor-panel">
          <label htmlFor="document-title">标题</label>
          <input
            id="document-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="协作文章标题"
            disabled={!user}
          />
          <label htmlFor="document-content">正文</label>
          <textarea
            id="document-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="这里可以写需要共同编辑的文章或文档..."
            rows={16}
            disabled={!user}
          />
          <button className="button primary" type="button" onClick={saveDocument} disabled={!user || isSaving}>
            {isSaving ? "保存中..." : "保存协作文档"}
          </button>

          <div className="share-panel">
            <h2>授权朋友</h2>
            <p>朋友需要先注册账号。之后你可以用 TA 的邮箱授权查看或编辑。</p>
            <label htmlFor="share-email">朋友邮箱</label>
            <input
              id="share-email"
              value={shareEmail}
              onChange={(event) => setShareEmail(event.target.value)}
              placeholder="friend@example.com"
              disabled={!isOwner}
            />
            <label htmlFor="share-level">权限</label>
            <select
              id="share-level"
              value={shareLevel}
              onChange={(event) => setShareLevel(event.target.value as PermissionLevel)}
              disabled={!isOwner}
            >
              <option value="edit">可以编辑</option>
              <option value="view">只能查看</option>
            </select>
            <button className="button secondary" type="button" onClick={shareDocument} disabled={!isOwner}>
              添加授权
            </button>
          </div>

          {message ? <p className="auth-message">{message}</p> : null}
        </section>
      </section>
    </main>
  );
}
