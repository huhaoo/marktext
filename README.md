# MarkText personal modification

这是基于官方 MarkText `v0.19.1` 的个人修改版，面向 Windows x64。它不是
官方 MarkText 的发行版本；官方源代码和版本更新仍以
[marktext/marktext](https://github.com/marktext/marktext) 为准。

## 本修改版的三个变化

1. **自动复制设置**：首次通过 setup.exe 安装时，会从官方 MarkText 的
   `%APPDATA%\marktext` 自动复制主要设置和 Local Storage（包括
   `latex-alias`），之后定制版继续使用自己的设置目录，不会和官方版互相
   覆盖。再次安装不会重复覆盖已经存在的定制版设置。
2. **增加 `latex-alias` 功能**：在 Preferences 的 Features 分类中
   （中文界面显示为“功能”）打开 LaTeX macros（中文界面显示为
   “LaTeX 宏”），每行定义一个 KaTeX 宏：

   ```text
   \R = \mathbb{R}
   \norm = \left\lVert #1 \right\rVert
   ```

   这些宏只作用于数学环境，不会改写普通 Markdown 文本或代码块。
3. **个人修改版**：修改集中在补丁脚本、构建脚本和文档中，便于后续官方
   版本更新后重新应用；不会假设可以直接与官方分支自动合并。

## Releases

- [本修改版 Releases](https://github.com/huhaoo/marktext/releases)
- [官方 MarkText Releases](https://github.com/marktext/marktext/releases)

setup.exe 应作为本修改版的 GitHub Release asset 发布，不建议把生成的二进制
直接提交进 Git 仓库。当前构建仍以官方 `v0.19.1` 为基线。

## LaTeX macros

The feature adds a small LaTeX macros editor under
**Preferences > Features > LaTeX macros**. The category and control labels
follow the selected MarkText language; they are not shown as mixed-language
labels. Each line defines one KaTeX macro:

```text
\R = \mathbb{R}
\norm = \left\lVert #1 \right\rVert
```

Macros are read only by the three math-rendering paths. Ordinary Markdown text
is never rewritten. The implementation uses KaTeX's own `macros` option, so
`#1` ... `#9` are expanded by KaTeX.

See [docs/math-macros.md](docs/math-macros.md) for user instructions and
[docs/math-macros-implementation.md](docs/math-macros-implementation.md) for
the short source-level reapplication guide.
