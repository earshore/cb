# CodeBuddy Worker 部署指南

## 环境变量配置

本项目使用 Cloudflare Workers Secrets 来安全存储敏感信息。

### 1. 复制环境变量示例文件

```bash
cp .env.example .env
```

### 2. 编辑 .env 文件

填入你的实际配置值：

```env
# Web 管理界面密码（必填）
WEB_PASSWORD=your_secure_password_here

# API 访问密钥（必填）
API_KEY=sk-your-api-key-here

# CodeBuddy API 端点（可选）
CODEBUDDY_API_ENDPOINT=https://www.codebuddy.ai

# 凭证轮换次数（可选）
ROTATION_COUNT=1

# 可用模型列表（可选）
MODELS=auto-chat,gpt-5,gpt-5-mini,gpt-5-nano
```

### 3. 设置 Cloudflare Workers Secrets

**重要：** 敏感信息（密码、密钥）必须使用 secrets 存储，不要直接写在 `wrangler.toml` 中。

```bash
# 设置 Web 管理界面密码
npx wrangler secret put WEB_PASSWORD

# 设置 API 访问密钥
npx wrangler secret put API_KEY
```

运行命令后，会提示你输入对应的值。

### 4. 创建 KV 命名空间

```bash
# 创建 KV 命名空间
npx wrangler kv namespace create CREDENTIALS_KV

# 将返回的 ID 填入 wrangler.toml 的 kv_namespaces.id 字段
```

### 5. 部署 Worker

```bash
npx wrangler deploy
```

## 环境变量说明

| 变量名 | 必填 | 说明 | 默认值 |
|--------|------|------|--------|
| `WEB_PASSWORD` | ✅ | Web 管理界面登录密码 | - |
| `API_KEY` | ✅ | API 访问密钥，用于 OpenAI 兼容接口认证 | - |
| `CODEBUDDY_API_ENDPOINT` | ❌ | CodeBuddy API 端点地址 | `https://www.codebuddy.ai` |
| `ROTATION_COUNT` | ❌ | 凭证自动轮换次数（每使用 N 次后切换） | `1` |
| `MODELS` | ❌ | 可用模型列表（逗号分隔） | 见 `.env.example` |

## 安全建议

1. **永远不要**将 `WEB_PASSWORD` 和 `API_KEY` 提交到 Git 仓库
2. 使用 `wrangler secret` 命令设置敏感信息
3. `.env` 文件已添加到 `.gitignore`，确保不会被提交
4. 定期更换密码和密钥
5. 使用强密码（至少 12 位，包含大小写字母、数字和特殊字符）

## 更新 Secrets

如需更新已设置的 secret：

```bash
# 更新密码
npx wrangler secret put WEB_PASSWORD

# 更新 API Key
npx wrangler secret put API_KEY
```

## 查看已设置的 Secrets

```bash
npx wrangler secret list
```

## 删除 Secrets

```bash
npx wrangler secret delete WEB_PASSWORD
npx wrangler secret delete API_KEY
```

## 访问管理界面

部署完成后，访问你的 Worker URL：

```
https://your-worker.workers.dev
```

使用 `WEB_PASSWORD` 中设置的密码登录。

## 🌐 API 端点

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/health` | GET | 无 | 健康检查 |
| `/api` | GET | 无 | API 信息 |
| `/v1/models` | GET | API Key | 获取模型列表 |
| `/v1/chat/completions` | POST | API Key | 聊天完成 |
| `/v1/credentials` | GET | Web 密码 | 查看凭证列表 |
| `/v1/credentials` | POST | Web 密码 | 添加凭证 |
| `/v1/credentials/delete` | POST | Web 密码 | 删除凭证 |
| `/v1/credentials/current` | GET | Web 密码 | 查看当前凭证 |
| `/v1/credentials/toggle-rotation` | POST | Web 密码 | 切换自动轮换 |

## 🔧 管理命令

```bash
# 查看所有凭证
npx wrangler kv key list --binding=CREDENTIALS_KV --prefix=cred:

# 查看特定凭证
npx wrangler kv key get --binding=CREDENTIALS_KV "cred:mytoken_1234567890"

# 删除凭证
npx wrangler kv key delete --binding=CREDENTIALS_KV "cred:mytoken_1234567890"

# 查看轮换状态
npx wrangler kv key get --binding=CREDENTIALS_KV "rotation_state"

# 重新部署
npx wrangler deploy

# 查看部署历史
npx wrangler deployments list

# 查看实时日志
npx wrangler tail
```
