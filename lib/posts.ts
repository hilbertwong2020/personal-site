export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  content: string[];
};

export const posts: Post[] = [
  {
    slug: "why-this-site",
    title: "为什么我要建这个网站",
    excerpt: "一个给文章、课程笔记、待办和私密日记慢慢生长的个人空间。",
    date: "2026-06-10",
    content: [
      "我想把这个网站做成一个长期使用的个人空间，而不只是一个普通博客。",
      "公开文章可以给别人看，课程 PDF 和笔记可以作为资料库整理，私密日记只给自己看。后面还会加入邀请制，让受邀用户有自己的写作空间，也可以在授权后协作编辑部分文档。",
      "第一阶段先把地基搭稳：能上线、能写公开文章、能登录、能保存自己的内容。复杂功能会一点点加，不一次性把系统做重。",
    ],
  },
  {
    slug: "course-notes-library",
    title: "课程 PDF 和笔记整理计划",
    excerpt: "把过去上课留下的材料整理成可搜索、可分类、可长期保存的资料库。",
    date: "2026-06-10",
    content: [
      "资料库会先按课程、学期和标签分类。PDF、图片、代码文件和笔记会分开存储，但在页面上统一检索。",
      "文件本身不会放进 GitHub 仓库，后面会使用 Supabase Storage 或其他对象存储。这样代码仓库保持轻量，文件也更容易做权限控制。",
      "长期目标是：打开网站就能快速找到某门课的讲义、作业、项目、总结和复习材料。",
    ],
  },
];

export function getPostBySlug(slug: string) {
  return posts.find((post) => post.slug === slug);
}
