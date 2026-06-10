# Free Deployment Guide

这一阶段我们先把静态网站免费上线。推荐顺序：

1. GitHub Pages：最便宜，适合当前静态版本，费用为 0。
2. Vercel Free：以后升级到 Next.js 更顺手，费用也可以先为 0。
3. Cloudflare Pages：也很便宜，适合长期低成本部署。

## 方案 A：GitHub Pages

适合现在这个版本，因为当前网站只有：

- `index.html`
- `styles.css`
- `app.js`

### 第一步：创建 GitHub 仓库

1. 打开 GitHub。
2. 点右上角 `+`。
3. 选择 `New repository`。
4. Repository name 可以写：

   ```text
   personal-site
   ```

5. 选择 `Public` 或 `Private` 都可以。
6. 不要勾选自动创建 README，因为本地已经有了。
7. 点击 `Create repository`。

### 第二步：把本地代码推到 GitHub

在这个项目目录运行下面命令。

先确认当前位置：

```bash
pwd
```

应该看到：

```text
/Users/yunan/Documents/个人网站
```

然后提交代码：

```bash
git add .
git commit -m "Create first personal site"
```

再连接 GitHub 仓库。把下面的地址换成你自己的仓库地址：

```bash
git remote add origin https://github.com/YOUR_USERNAME/personal-site.git
git push -u origin main
```

### 第三步：开启 GitHub Pages

1. 打开 GitHub 仓库页面。
2. 进入 `Settings`。
3. 左侧选择 `Pages`。
4. `Build and deployment` 里面选择：

   ```text
   Source: Deploy from a branch
   Branch: main
   Folder: / (root)
   ```

5. 点击 `Save`。

几分钟后，GitHub 会给你一个网址，通常长这样：

```text
https://YOUR_USERNAME.github.io/personal-site/
```

这就是别人可以访问的网站。

## 方案 B：Vercel Free

适合以后升级成 Next.js 版本。

步骤：

1. 把代码推到 GitHub。
2. 打开 Vercel。
3. 选择 `Add New Project`。
4. 导入 GitHub 仓库。
5. Framework Preset 选择 `Other`。
6. Build Command 留空。
7. Output Directory 留空或写 `.`。
8. 点击 Deploy。

## 方案 C：Cloudflare Pages

适合长期低成本静态网站。

步骤：

1. 把代码推到 GitHub。
2. 打开 Cloudflare Dashboard。
3. 进入 `Workers & Pages`。
4. 选择 `Create application`。
5. 选择 `Pages`。
6. 连接 GitHub 仓库。
7. Framework preset 选择 `None`。
8. Build command 留空。
9. Output directory 写：

   ```text
   /
   ```

10. 点击 Deploy。

## 域名什么时候买

不急。

建议先用免费网址把网站跑通。等你确认网站结构和名字后，再买域名。

域名购买后可以绑定到：

- GitHub Pages
- Vercel
- Cloudflare Pages

以后如果要省钱又稳定，可以考虑把 DNS 放在 Cloudflare。

## 当前推荐

现在先用 GitHub Pages。

原因：

- 当前项目是静态网站。
- 不需要 npm。
- 不需要服务器。
- 不需要每月费用。
- 适合第一次体验完整上线流程。
