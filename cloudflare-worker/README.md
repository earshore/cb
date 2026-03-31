# CodeBuddy Worker 部署指南

这是 CodeBuddy2API 的 Cloudflare Worker 版本，提供与 OpenAI 兼容的 API 接口。

## 功能特性

- ✅ OpenAI 兼容的 `/v1/chat/completions` API
- ✅ 流式和非流式响应支持
- ✅ 凭证管理和自动轮换
- ✅ Web 管理界面
- ✅ 工具调用支持
- ✅ 优化的 KV 写入频率（符合免费限额）
- ✅ 自定义域名支持

## 前置要求

- Node.js 16+ 和 npm
- Cloudflare 账户
- 域名托管在 Cloudflare（用于自定义域名）

## 快速开始

### 1. 安装依赖

```bash
cd cloudflare-worker
npm install
```

### 2. 创建 KV 命名空间

```bash
# 创建生产环境 KV
wrangler kv:namespace create CREDENTIALS_KV

# 创建预览环境 KV（用于开发）
wrangler kv:namespace create CREDENTIALS_KV --preview
```

命令会输出类似以下内容：
```
🌀 Creating namespace with title "codebuddy-worker-CREDENTIALS_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "CREDENTIALS_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

### 3. 更新 wrangler.toml

将上一步获得的 KV namespace ID 填入 `wrangler.toml`：

```toml
kv_namespaces = [
  { binding = "CREDENTIALS_KV", id = "你的生产环境ID", preview_id = "你的预览环境ID" }
]
```

### 4. 配置环境变量（可选）

如果你想使用更安全的方式存储密码和 API key，可以使用 secrets：

```bash
# 设置 Web 访问密码
wrangler secret put WEB_PASSWORD
# 输入: admin123cb

# 设置 API 调用密钥
wrangler secret put API_KEY
# 输入: sk-U8FtQmChp-api-key
```

如果使用 secrets，需要从 `wrangler.toml` 的 `[vars]` 部分删除对应的变量。

### 5. 本地开发测试

```bash
npm run dev
```

访问 `http://localhost:8787` 查看管理界面。

### 6. 部署到 Cloudflare

```bash
npm run deploy
```

部署成功后，你的 Worker 将运行在 `https://codebuddy-worker.你的账户名.workers.dev`

### 7. 配置自定义域名

#### 方法 1: 通过 Cloudflare Dashboard（推荐）

1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages
3. 选择你的 Worker (`codebuddy-worker`)
4. 点击 "Settings" -> "Triggers" -> "Custom Domains"
5. 点击 "Add Custom Domain"
6. 输入 `cbapi.hongecb.store`
7. Cloudflare 会自动创建 DNS 记录

#### 方法 2: 通过 wrangler.toml

确保 `wrangler.toml` 中的 routes 配置正确：

```toml
routes = [
  { pattern = "cbapi.hongecb.store/*", zone_name = "hongecb.store" }
]
```

然后重新部署：
```bash
npm run deploy
```

### 8. 添加 CodeBuddy 凭证

#### 方法 1: 通过 Web 界面（推荐）

1. 访问 `https://cbapi.hongecb.store/`
2. 输入密码 `admin123cb` 登录
3. 进入"凭证管理"标签
4. 点击"添加凭证"或使用"自动获取认证"

#### 方法 2: 通过 wrangler CLI

```bash
wrangler kv:key put --binding=CREDENTIALS_KV "cred:user1_1234567890" '{
  "bearer_token": "你的CodeBuddy Token",
  "user_id": "你的用户ID",
  "created_at": 1234567890,
  "expires_in": 2592000
}'
```

## 使用 API

### 认证

所有 API 请求需要在 Authorization header 中提供 API key：

```
Authorization: Bearer sk-U8FtQmChp-api-key
```

### 聊天完成 API

```bash
# 非流式请求
curl -X POST "https://cbapi.hongecb.store/v1/chat/completions" \
  -H "Authorization: Bearer sk-U8FtQmChp-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'

# 流式请求
curl -X POST "https://cbapi.hongecb.store/v1/chat/completions" \
  -H "Authorization: Bearer sk-U8FtQmChp-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto-chat",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

### 获取模型列表

```bash
curl "https://cbapi.hongecb.store/v1/models" \
  -H "Authorization: Bearer sk-U8FtQmChp-api-key"
```

### Python 客户端示例

```python
import openai

client = openai.OpenAI(
    api_key="sk-U8FtQmChp-api-key",
    base_url="https://cbapi.hongecb.store/v1"
)

response = client.chat.completions.create(
    model="auto-chat",
    messages=[
        {"role": "user", "content": "你好，2+2等于几？"}
    ]
)

print(response.choices[0].message.content)
```

## 配置说明

### 环境变量（wrangler.toml）

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `WEB_PASSWORD` | `admin123cb` | Web 管理界面访问密码 |
| `API_KEY` | `sk-U8FtQmChp-api-key` | API 调用认证密钥 |
| `CODEBUDDY_API_ENDPOINT` | `https://www.codebuddy.ai` | CodeBuddy API 端点 |
| `ROTATION_COUNT` | `1` | 凭证轮换频率（每 N 次请求轮换一次） |
| `MODELS` | `claude-4.0,claude-3.7,...` | 可用模型列表 |

### KV 存储优化

为了符合 Cloudflare KV 免费限额（1,000 次写入/天），本项目做了以下优化：

1. **凭证存储**：只在添加/删除凭证时写入（很少发生）
2. **轮换状态**：每 100 次请求才写入一次（从 10,000 次降到 100 次）
3. **手动操作**：手动选择凭证、切换自动轮换时立即写入

## 监控和调试

### 查看实时日志

```bash
npm run tail
```

### 查看 KV 存储内容

```bash
# 列出所有凭证
wrangler kv:key list --binding=CREDENTIALS_KV --prefix=cred:

# 查看特定凭证
wrangler kv:key get --binding=CREDENTIALS_KV "cred:user1_1234567890"

# 查看轮换状态
wrangler kv:key get --binding=CREDENTIALS_KV "rotation_state"
```

### 删除凭证

```bash
wrangler kv:key delete --binding=CREDENTIALS_KV "cred:user1_1234567890"
```

## 故障排除

### 1. 部署失败

- 确保已安装最新版本的 wrangler：`npm install -g wrangler`
- 确保已登录：`wrangler login`
- 检查 `wrangler.toml` 配置是否正确

### 2. 自定义域名无法访问

- 确保域名已托管在 Cloudflare
- 检查 DNS 记录是否正确
- 等待 DNS 传播（可能需要几分钟）

### 3. KV 写入限额超出

- 检查轮换状态写入频率是否过高
- 考虑增加 `saveThreshold`（在 `credential-manager.ts` 中）
- 升级到 Cloudflare 付费计划

### 4. 凭证过期

- 通过 Web 界面查看凭证状态
- 删除过期凭证并添加新凭证
- 考虑实现自动刷新 token 功能

## 性能优化

### Cloudflare Worker 限制

- **CPU 时间**：免费版 10ms，付费版 50ms
- **内存**：128MB
- **请求时间**：无限制（I/O 时间不计入 CPU 时间）

### 优化建议

1. **流式响应**：直接转发，不缓存（已实现）
2. **凭证缓存**：在 Worker 实例中缓存凭证列表（已实现）
3. **减少 KV 写入**：批量写入或降低写入频率（已实现）
4. **使用 Durable Objects**：如果需要更复杂的状态管理（可选）

## 安全建议

1. **使用 Secrets**：将密码和 API key 存储为 secrets 而不是环境变量
2. **定期轮换密钥**：定期更改 `WEB_PASSWORD` 和 `API_KEY`
3. **限制访问**：考虑添加 IP 白名单或 rate limiting
4. **监控使用情况**：定期检查 Worker 日志和 KV 使用情况

## 从 FastAPI 版本迁移

如果你之前使用的是 FastAPI 版本，可以通过以下步骤迁移凭证：

1. 从 `.codebuddy_creds/*.json` 读取所有凭证文件
2. 使用 `wrangler kv:key put` 命令将每个凭证写入 KV
3. 测试 API 是否正常工作
4. 逐步切换客户端到新的 Worker 端点

## 支持

如果遇到问题，请：

1. 查看 Worker 日志：`npm run tail`
2. 检查 Cloudflare Dashboard 中的 Worker 指标
3. 提交 Issue 到 GitHub 仓库

## 许可证

MIT License
