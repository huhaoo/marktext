# GitHub 自动发布

仓库：`huhaoo/marktext`。流程：`.github/workflows/release.yml`。

这是基于上游 0.19.1 的个人维护线，使用 `0.19.1-0.N` / `v0.19.1-0.N` 编号。除非明确升级基线，不按仓库里导入的上游分支或标签递增版本号。

## 新版本

1. 同步修改根目录及 `packages/desktop/package.json` 的 `version`，例如 `0.19.1-0.5`。
2. 在 `docs/releases/v0.19.1-0.5.md` 添加说明，提交并推送。
3. 为同一个提交创建并推送 `v0.19.1-0.5` 标签。

流程自动运行版本检查、桌面单元测试、类型、静态与许可检查。全部通过后构建 Linux、Windows x64/ARM64、macOS x64/ARM64，再发布安装包及 `SHA256SUMS.txt`。

带预发布后缀的标签（例如 `-rc.3`）自动标为预发布。已有标签不会被移动，历史 Release 不会被删除。

## 重跑已有版本

在 GitHub Actions 中打开 **Release MarkText → Run workflow**，填写已经存在的版本标签。它会检出该标签的提交并重新验证、构建和上传；同名生成资产可更新，其余资产保留。

使用仓库自动提供的 `GITHUB_TOKEN`，无需另外配置发布令牌。发布任务具有 `contents: write` 权限，其余任务为只读。
