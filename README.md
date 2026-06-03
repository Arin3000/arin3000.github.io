# ArinLee Blog

这是一个基于 [Hexo](https://hexo.io/) 的个人博客项目，适合发布到 GitHub Pages。

## 本地使用

```bash
npm install
npm run server
```

本地预览默认地址是 `http://localhost:4000`。

## 写文章

```bash
npx hexo new "文章标题"
```

文章会生成在 `source/_posts/`。

## 发布到 GitHub Pages

1. 在 GitHub 创建一个名为 `ArinLee.github.io` 的仓库。
2. 把本项目推送到该仓库的 `main` 分支。
3. 进入仓库 `Settings -> Pages`。
4. 在 `Build and deployment` 里选择 `GitHub Actions`。
5. 等待 Actions 运行完成，访问 `https://ArinLee.github.io`。

如果你的 GitHub 用户名不是 `ArinLee`，请同时修改：

- 仓库名：`你的用户名.github.io`
- `_config.yml` 里的 `url`
- 本 README 中的示例地址
