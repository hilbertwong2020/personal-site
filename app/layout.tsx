import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wang's Space",
  description: "一个个人知识空间：文章、课程笔记、待办、计时和私密日记。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
