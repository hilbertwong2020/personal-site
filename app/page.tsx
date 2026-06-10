"use client";

import { useMemo, useState } from "react";

const roadmapItems = [
  "本地打开 Next.js 版本网站。",
  "部署到 Vercel Free，作为未来动态网站入口。",
  "接 Supabase：登录、数据库、权限、文件存储。",
  "逐个完成文章、资料库、待办计时、私密日记。",
];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function Home() {
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds] = useState(25 * 60);

  const timerStatus = useMemo(() => {
    if (isRunning) {
      return `计时器界面已准备好：${formatTime(remainingSeconds)}`;
    }

    return "计时器还没有开始。下一步会把它接成真正可保存的任务记录。";
  }, [isRunning, remainingSeconds]);

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          Wang&apos;s Space
        </a>
        <nav className="nav" aria-label="主导航">
          <a href="#writing">文章</a>
          <a href="#library">资料库</a>
          <a href="#today">今日</a>
          <a href="#private">私密</a>
          <a href="/login">登录</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Personal knowledge space</p>
            <h1>记录想法、课程笔记、今天要做的事。</h1>
            <p>
              这里会慢慢长成一个个人网站：公开文章给大家看，私密日记只给自己看，
              受邀朋友可以在自己的空间写文章，也可以在授权后一起编辑部分文档。
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#writing">
                看网站雏形
              </a>
              <a className="button secondary" href="#roadmap">
                开发路线
              </a>
            </div>
          </div>
          <aside className="hero-panel" aria-label="当前阶段">
            <span className="panel-label">当前阶段</span>
            <strong>Step 2</strong>
            <p>从静态网页升级到 Next.js 应用，准备接登录、数据库和文件存储。</p>
          </aside>
        </section>

        <section className="section" id="writing">
          <div className="section-heading">
            <p className="eyebrow">Writing</p>
            <h2>公开文章</h2>
          </div>
          <div className="grid two">
            <article className="card">
              <p className="card-meta">草稿 · 个人网站</p>
              <h3>为什么我要建这个网站</h3>
              <p>
                这里以后会放第一篇公开文章。下一步我们会把文章从静态卡片变成数据库里的内容。
              </p>
            </article>
            <article className="card">
              <p className="card-meta">计划 · 学习笔记</p>
              <h3>课程 PDF 和笔记整理</h3>
              <p>之后可以上传旧课件、PDF、笔记，并用标签和搜索把它们组织起来。</p>
            </article>
          </div>
        </section>

        <section className="section" id="library">
          <div className="section-heading">
            <p className="eyebrow">Library</p>
            <h2>资料库</h2>
          </div>
          <div className="library-list">
            <div>
              <strong>课程 PDF</strong>
              <span>未来接 Supabase Storage 上传和权限控制</span>
            </div>
            <div>
              <strong>课堂笔记</strong>
              <span>按课程、学期、标签分类</span>
            </div>
            <div>
              <strong>协作文档</strong>
              <span>受邀用户被授权后才可以编辑</span>
            </div>
          </div>
        </section>

        <section className="section split" id="today">
          <div>
            <p className="eyebrow">Today</p>
            <h2>今日待办和计时</h2>
            <p>
              这个模块之后会变成真正的 to-do list，可以记录任务、开始计时、保存完成记录。
            </p>
          </div>
          <div className="todo-box">
            <label className="todo-item">
              <input type="checkbox" defaultChecked />
              <span>完成静态网站上线</span>
            </label>
            <label className="todo-item">
              <input type="checkbox" defaultChecked />
              <span>改名为 Wang&apos;s Space</span>
            </label>
            <label className="todo-item">
              <input type="checkbox" />
              <span>升级到 Next.js</span>
            </label>
            <button className="timer-button" type="button" onClick={() => setIsRunning((value) => !value)}>
              {isRunning ? "暂停计时" : "准备 25 分钟计时"}
            </button>
            <p className="timer-status">{timerStatus}</p>
          </div>
        </section>

        <section className="section split private-section" id="private">
          <div>
            <p className="eyebrow">Private</p>
            <h2>私密日记</h2>
            <p>
              上线后，日记内容不会放在公开页面里。我们会用登录和数据库权限保证只有你自己能看到。
            </p>
          </div>
          <div className="diary-preview" aria-label="私密日记示意">
            <p>今天想记录的事...</p>
            <span>Locked until login is ready</span>
          </div>
        </section>

        <section className="section" id="roadmap">
          <div className="section-heading">
            <p className="eyebrow">Roadmap</p>
            <h2>下一步怎么走</h2>
          </div>
          <ol className="roadmap">
            {roadmapItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="footer">
        <span>Built step by step.</span>
        <span>Wang&apos;s Space</span>
      </footer>
    </>
  );
}
