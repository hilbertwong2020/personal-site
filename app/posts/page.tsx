import { posts } from "@/lib/posts";

export default function PostsPage() {
  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <p className="eyebrow">Writing</p>
        <h1>公开文章</h1>
        <p>这里先使用本地文章数据。等后台编辑器做好后，再把文章迁移到 Supabase 数据库。</p>
      </section>

      <section className="dashboard-grid">
        {posts.map((post) => (
          <article className="card" key={post.slug}>
            <p className="card-meta">{post.date}</p>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
            <a className="card-link" href={`/posts/${post.slug}`}>
              阅读文章
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}
