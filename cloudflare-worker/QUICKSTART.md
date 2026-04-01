# CodeBuddy Worker 快速使用指南

## 🎉 部署成功！

你的 CodeBuddy Worker 已成功部署到 Cloudflare，可以通过以下地址访问：

**Worker 域名**: https://your-worker.workers.dev

## 📝 第一步：添加 CodeBuddy 凭证

### 方法 1：通过命令行（推荐）

```bash
cd cloudflare-worker

# 添加凭证（替换为你的实际 Token 和用户 ID）
npx wrangler kv key put --binding=CREDENTIALS_KV "cred:user1_$(date +%s)" '{
  "bearer_token": "你的CodeBuddy_Token",
  "user_id": "你的用户ID",
  "created_at": '$(date +%s)',
  "expires_in": 2592000
}'
```

### 方法 2：通过 API

```bash
curl -X POST "https://your-worker.workers.dev/v1/credentials" \
  -H "Authorization: Bearer your-web-password" \
  -H "Content-Type: application/json" \
  -d '{
    "bearer_token": "你的CodeBuddy_Token",
    "user_id": "你的用户ID",
    "created_at": '$(date +%s)',
    "expires_in": 2592000
  }'
```

## 🚀 第二步：测试 API

### 使用 curl 测试

```bash
# 非流式请求
curl -X POST "https://your-worker.workers.dev/v1/chat/completions" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto-chat",
    "messages": [{"role": "user", "content": "你好，请介绍一下你自己"}]
  }'

# 流式请求
curl -X POST "https://your-worker.workers.dev/v1/chat/completions" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto-chat",
    "messages": [{"role": "user", "content": "写一个 Python Hello World"}],
    "stream": true
  }'
```

### 使用 Python 测试

```python
import openai

client = openai.OpenAI(
    api_key="your-api-key",
    base_url="https://your-worker.workers.dev/v1"
)

# 非流式
response = client.chat.completions.create(
    model="auto-chat",
    messages=[
        {"role": "user", "content": "你好，2+2等于几？"}
    ]
)
print(response.choices[0].message.content)

# 流式
stream = client.chat.completions.create(
    model="auto-chat",
    messages=[
        {"role": "user", "content": "写一个 Python 快速排序"}
    ],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

## 🔑 认证信息

- **Web 管理界面密码**: 在部署时通过 `wrangler secret put WEB_PASSWORD` 设置
- **API 调用密钥**: 在部署时通过 `wrangler secret put API_KEY` 设置

## 📊 管理功能

### 查看所有凭证

```bash
curl "https://your-worker.workers.dev/v1/credentials" \
  -H "Authorization: Bearer your-web-password"
```

### 查看当前使用的凭证

```bash
curl "https://your-worker.workers.dev/v1/credentials/current" \
  -H "Authorization: Bearer your-web-password"
```

### 删除凭证

```bash
curl -X POST "https://your-worker.workers.dev/v1/credentials/delete" \
  -H "Authorization: Bearer your-web-password" \
  -H "Content-Type: application/json" \
  -d '{"index": 0}'
```

### 切换自动轮换

```bash
curl -X POST "https://your-worker.workers.dev/v1/credentials/toggle-rotation" \
  -H "Authorization: Bearer your-web-password"
```

## 🔧 常用命令

```bash
# 进入项目目录
cd cloudflare-worker

# 查看实时日志
npx wrangler tail

# 查看 KV 中的凭证
npx wrangler kv key list --binding=CREDENTIALS_KV --prefix=cred:

# 查看特定凭证
npx wrangler kv key get --binding=CREDENTIALS_KV "cred:user1_1234567890"

# 删除凭证
npx wrangler kv key delete --binding=CREDENTIALS_KV "cred:user1_1234567890"

# 查看轮换状态
npx wrangler kv key get --binding=CREDENTIALS_KV "rotation_state"
```

## 📌 重要提示

1. **凭证轮换**：默认每次请求轮换凭证（`ROTATION_COUNT=1`），可在 Web 界面调整
2. **过期检查**：系统会自动跳过过期的凭证
3. **KV 限额**：免费版每天 1,000 次写入，已优化为每 100 次请求才写入一次状态
4. **安全性**：建议定期更换 API key 和 Web 密码

## 🆘 遇到问题？

1. 查看实时日志：`npx wrangler tail`
2. 检查凭证是否过期：访问 Web 管理界面
3. 确认 API key 是否正确
4. 查看完整文档：`cloudflare-worker/README.md`

---

**祝使用愉快！** 🎊
