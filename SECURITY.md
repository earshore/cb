# 安全检查清单

在将项目发布到 GitHub 之前，请确保完成以下检查：

## ✅ 敏感信息检查

### 1. 环境变量和配置文件
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] `.env.example` 中不包含真实密码或密钥
- [ ] `config.json` 已添加到 `.gitignore`
- [ ] `wrangler.toml` 中不包含真实的 KV namespace ID
- [ ] `wrangler.toml` 中不包含自定义域名配置

### 2. 凭证文件
- [ ] `.codebuddy_creds/*` 目录内容已添加到 `.gitignore`
- [ ] 没有 `.json` 凭证文件被提交到仓库
- [ ] `manager_state.json` 已添加到 `.gitignore`（如果存在）

### 3. 文档中的敏感信息
- [ ] `README.md` 中的密码已替换为占位符
- [ ] `README.md` 中的 API key 已替换为占位符
- [ ] `cloudflare-worker/README.md` 中的域名已替换为示例
- [ ] `cloudflare-worker/QUICKSTART.md` 中的敏感信息已清理
- [ ] `cloudflare-worker/DEPLOYMENT.md` 中没有真实凭证
- [ ] 所有临时文档已删除

### 4. 日志和临时文件
- [ ] `*.log` 文件已添加到 `.gitignore`
- [ ] `logs/` 目录已添加到 `.gitignore`
- [ ] 临时文件（`tmp_*`, `temp_*`）已添加到 `.gitignore`

### 5. IDE 和系统文件
- [ ] `.vscode/` 已添加到 `.gitignore`
- [ ] `.idea/` 已添加到 `.gitignore`
- [ ] `.DS_Store` 已添加到 `.gitignore`

## 🔍 提交前检查命令

运行以下命令检查是否有敏感信息：

```bash
# 检查是否有 .env 文件被跟踪
git ls-files | grep "\.env$"

# 检查是否有凭证文件被跟踪
git ls-files | grep "\.codebuddy_creds"

# 检查是否有配置文件被跟踪
git ls-files | grep "config\.json"

# 搜索可能的密码（示例）
git grep -i "password.*=" -- "*.md" "*.toml" "*.json"

# 搜索可能的 API key
git grep -i "api.*key.*=" -- "*.md" "*.toml" "*.json"
```

## 🛡️ 安全建议

### 部署前
1. 使用强密码（至少 12 位，包含大小写字母、数字和特殊字符）
2. 为不同环境使用不同的密钥
3. 定期轮换密码和 API key

### 部署后
1. 使用 Cloudflare Workers Secrets 存储敏感信息
2. 启用 Cloudflare 的安全功能（WAF、Rate Limiting）
3. 监控异常访问和使用情况
4. 定期审查访问日志

### Git 提交
1. 提交前运行 `git status` 检查暂存文件
2. 使用 `git diff --cached` 查看即将提交的更改
3. 永远不要使用 `git add .` 或 `git add -A`，明确指定要添加的文件
4. 如果不小心提交了敏感信息，使用 `git filter-branch` 或 `BFG Repo-Cleaner` 清理历史

## 📋 发布检查清单

在执行 `git push` 之前：

- [ ] 已完成上述所有安全检查
- [ ] 已运行检查命令，确认没有敏感信息
- [ ] 已测试 `.env.example` 文件的完整性
- [ ] 已更新 `README.md` 中的安装说明
- [ ] 已确认所有文档中的示例都使用占位符
- [ ] 已删除所有临时和测试文档

## 🚨 如果不小心泄露了敏感信息

1. **立即更改所有泄露的密码和密钥**
2. 从 Git 历史中删除敏感信息：
   ```bash
   # 使用 BFG Repo-Cleaner（推荐）
   bfg --replace-text passwords.txt
   
   # 或使用 git filter-branch
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/sensitive/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. 强制推送清理后的历史：
   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```
4. 通知所有协作者重新克隆仓库

## 📞 联系方式

如果发现安全问题，请通过 GitHub Issues 报告（不要在 Issue 中包含敏感信息）。
