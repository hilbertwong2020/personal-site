# Supabase Setup Guide

下一阶段目标：给网站加入登录、邀请制、文章、私密日记、待办事项和文件上传。

Supabase 会负责：

- 用户注册和登录
- 数据库
- 文件存储
- 权限规则

## 第一步：创建 Supabase 项目

1. 打开 Supabase：

   ```text
   https://supabase.com
   ```

2. 用 GitHub 登录。
3. 点击 `New project`。
4. Organization 选你的个人账号。
5. Project name 建议：

   ```text
   wang-space
   ```

6. Database Password 生成一个强密码，并保存到密码管理器或安全笔记里。
7. Region 选择离你常用访问地区近的区域。美国用户可以先选美国区域。
8. Pricing plan 选择 Free。
9. 点击 `Create new project`。

创建项目可能需要几分钟。

## 第二步：找到 API 配置

项目创建完成后：

1. 进入项目 Dashboard。
2. 左侧打开 `Project Settings`。
3. 打开 `API`。
4. 找到：

   ```text
   Project URL
   anon public key
   ```

这两个值之后要放到本地 `.env.local` 和 Vercel 的 Environment Variables 里。

不要把真实 key 写进 GitHub。

## 第三步：本地环境变量

复制 `.env.example` 成 `.env.local`：

```bash
cp .env.example .env.local
```

然后填入：

```text
NEXT_PUBLIC_SUPABASE_URL=你的 Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 anon public key
```

## 第四步：Vercel 环境变量

在 Vercel 项目里：

1. 打开 `Settings`。
2. 进入 `Environment Variables`。
3. 添加：

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

4. 保存后重新 Deploy。

## 第五步：数据库表

第一版数据库 schema 放在：

```text
supabase/schema.sql
```

等 Supabase 项目创建好后，可以在 Supabase SQL Editor 里运行这个文件里的 SQL。

## 第六步：临时关闭邮箱确认

为了先测试“邮箱 + 密码”注册登录，可以临时关闭邮箱确认。

在 Supabase 项目里：

1. 打开 `Authentication`。
2. 打开 `Providers`。
3. 选择 `Email`。
4. 关闭 `Confirm email`。
5. 保存。

之后注册新账号时，会直接创建 session 并进入后台。等邀请制和管理员审批做好后，可以再决定是否重新开启邮箱确认。

## 当前先不做的事

长期不要开放任何公开注册。

建议路线：

1. 先只允许你自己登录。
2. 再做邀请码。
3. 再允许受邀用户写自己的文章。
4. 最后再做指定文档协作编辑。
