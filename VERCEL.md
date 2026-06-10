# Vercel Deployment Guide

这个文件记录下一阶段：把 Next.js 版本部署到 Vercel Free。

当前 GitHub Pages 网站仍然可用：

```text
https://hilbertwong2020.github.io/personal-site/
```

但是 GitHub Pages 更适合静态网页。后面要做登录、邀请制、数据库、私密日记和文件上传，建议把 Next.js 版本部署到 Vercel。

## 部署步骤

1. 打开 Vercel。
2. 使用 GitHub 账号登录。
3. 点击 `Add New Project`。
4. 选择 `hilbertwong2020/personal-site`。
5. Framework Preset 选择 `Next.js`。
6. Build Command 保持默认：

   ```text
   npm run build
   ```

7. Install Command 保持默认：

   ```text
   npm install
   ```

8. 点击 `Deploy`。

部署完成后，Vercel 会给一个免费网址，通常类似：

```text
https://personal-site-xxxx.vercel.app
```

## 之后要做

Next.js 部署成功后，再创建 Supabase 项目，并配置：

- 登录认证
- 用户资料表
- 邀请码表
- 文章表
- 私密日记表
- 待办事项表
- 文件存储 bucket
- 数据库权限规则

