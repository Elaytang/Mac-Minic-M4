# Git 2.56.0 · 外置盘安装与 GitHub 认证

> 装好时间：2026-10-20 · 机型 Mac mini M4 · macOS 27.0 (26A428)

## 1. 装在哪

| 项 | 路径 |
|---|---|
| 安装目录 | `/Volumes/Macintosh HD2/Applications/git`（29MB） |
| 主程序 | `/Volumes/Macintosh HD2/Applications/git/bin/git` |
| 固定短路径 | `~/git/bin/git` → 软链到上面（拔外置盘时路径不失效于配置） |
| PATH 入口 | `/Volumes/Macintosh HD2/Applications/bin/git`（已在 `~/.zprofile` 里把 git 目录前置） |
| git-core | `~/git/libexec/git-core`，凭据助手 `git-credential-osxkeychain` 已编译在内 |

系统自带的 `/usr/bin/git`（Apple Git 2.50.1）没动，仍然在，只是新终端里排后面。

## 2. 怎么生效

`~/.zprofile` 末尾追加了三行（已生效，新开终端即用）：

```zsh
# 2026-10-20 git 2.56（外置卷）优先于系统 /usr/bin/git（Apple Git 2.50）
export PATH="/Volumes/Macintosh HD2/Applications/git/bin:$PATH"
```

已开着的终端要手动刷一下：

```zsh
source ~/.zprofile
git --version      # → git version 2.56.0
```

## 3. GitHub 认证（已完成）

2026-10-20 已把公钥挂到账号 **Elaytang**（key title: Mac Mini M4，指纹 `SHA256:jg0SwMwyPh1NMgziM+7h324fgyyuc4lyOiwbTIdSBFA`），ssh-agent + 登录钥匙串都已装载。

公钥内容（整行复制，含末尾 `tangyuan@macmini-m4`）：

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGUlu+tKZWkNWO6/WxGR9vci/hrIF4QLlKTvO61F4T3q tangyuan@macmini-m4
```

网页操作（约 1 分钟）：

1. 打开 https://github.com/settings/keys
2. 点 **New SSH key**
3. Title 填 `Mac mini M4`，Key type 保持 **Authentication Key**
4. 粘贴上面那一整行 → **Add SSH key**

然后验证：

```zsh
ssh -T git@github.com
# 成功会看到：Hi <你的用户名>! You've successfully authenticated...
```

## 4. 提交身份（已设置）

```
user.name  = Elaytang
user.email = 175331562+Elaytang@users.noreply.github.com
```

邮箱用 GitHub 官方 noreply 形式（`userId+login@users.noreply.github.com`）：提交能正确归属到账号，又不暴露真实邮箱。

验证：

```zsh
git config --global --get user.name
git config --global --get user.email
```

## 5. 当前仓库：Tangline → Mac-Minic-M4（已推送）

本目录 `/Volumes/Macintosh HD2/存储/Codex/软件开发` 已初始化并推到：

- 远端：`git@github.com:Elaytang/Mac-Minic-M4.git`
- 分支：`main`，跟踪 `origin/main`
- 首个提交：`5f514ad` chore: 初始化 Tangline 仓库（Electron + React，mihomo 控制台）
- 纳入版本控制：56 个文件 / 约 2.8MB（源码 + 图标 + 文档）

`.gitignore` 已挡掉的（实测 `git check-ignore` 逐条确认）：

| 路径 | 原因 |
|---|---|
| `node_modules/` | 依赖，`npm ci` 可重建（460MB） |
| `release/` | 打包产物 dmg/zip（1.5GB） |
| `dist/` | Vite 构建产物 |
| `assets/.chrome-icon-profile/` | 本地 Chrome 调试配置，含 Cookies / Login Data 会话库 |
| `hello-git/` | 临时测试仓库（已移到 `Codex/_quarantine/`） |
| `*.bak` `*.log` `.DS_Store` | 备份 / 日志 / 系统文件 |

### 日常三件套

```zsh
git st                      # 别名：status -sb
git add -A
git commit -m "feat: 说明改了什么"
git push
```

`push.autoSetupRemote=true` 已开，新分支第一次推不用写 `-u origin xxx`。

## 6. 已验证 / 未执行

| 项 | 结果 |
|---|---|
| `git --version`（新登录 shell） | 2.56.0，`whence -a git` 首位是外置盘 | 已验证 |
| 本地 init / add / commit / log | 通过 | 已验证 |
| HTTPS 克隆 GitHub 公共仓库 | 通过（octocat/Hello-World 浅克隆） | 已验证 |
| `git ls-remote https://github.com/git/git.git` | 返回 refs | 已验证 |
| github.com:22 连通 | nc 成功 | 已验证 |
| `ssh -T git@github.com` | `Hi Elaytang! You've successfully authenticated...` | 已验证 |
| 自有仓库读取 | `git ls-remote git@github.com:Elaytang/chatbox.git` 返回 `refs/heads/main` | 已验证 |
| 提交归属 | 本地 commit `name=Elaytang` / `email=175331562+Elaytang@users.noreply.github.com` | 已验证 |
| `git push` 到 `Elaytang/Mac-Minic-M4` | `* [new branch] main -> main`，远端 sha = 本地 5f514ad | 已验证 |
| 远端回读克隆 | 新目录 `git clone` 成功，56 文件，无 node_modules/release | 已验证 |
| 提交归属（GitHub 侧） | API 读到 author = Elaytang / 175331562+Elaytang@users.noreply.github.com | 已验证 |

## 7. 回滚

```zsh
'/Volumes/Macintosh HD2/存储/Codex/build/backup-git-install-20261020/rollback.sh'
```

会还原 `~/.zprofile`、`~/.gitconfig`，删掉两个软链，把 git 目录移进 `_removed_git_<时间戳>`，最后打印回退后的 `git --version`（应回到 2.50.1 Apple Git）。

备份原件在 `backup-git-install-20261020/`：`zprofile.bak`、`gitconfig.bak`、`zshrc.bak`。

## 8. 备注

- 外置卷挂载参数是 `nodev,nosuid,noowners`：`nosuid` 不影响 git（git 不需要 setuid）；如哪天外置盘没插，`/usr/bin/git` 自动兜底，配置不会崩。
- `~/git` 是我给外置盘路径起的短别名，避免 `git --exec-path` 里出现带空格的路径（空格路径在 Makefile 里会炸，源码编译时踩过一次）。
- 编译器用的是 Command Line Tools（clang 26.5），构建参数 `NO_RUST=YesPlease`（本机无 cargo，Rust 子系统非必需）。
- 构建缓存保留在 `/Volumes/Macintosh HD2/存储/Codex/build/git-2.56.0`（61MB）+ tar 包 8MB，想省空间可删。
