# 🎉 CodeBuddy Worker 部署完成！

## ✅ 部署信息

- **Worker 名称**: codebuddy-worker
- **访问地址**: https://codebuddy-worker.iclaw.workers.dev
- **Web 管理界面**: https://codebuddy-worker.iclaw.workers.dev
- **部署时间**: 2026-03-31
- **版本 ID**: 77ec8dc1-c42c-4795-bf72-337843b6f096

## 🔑 认证信息

- **API Key**: `sk-U8FtQmChp-api-key`
- **Web 密码**: `admin123cb`

## 📝 下一步操作

### 1. 访问 Web 管理界面

打开浏览器访问：https://codebuddy-worker.iclaw.workers.dev

输入密码：`admin123cb`

### 2. 添加 CodeBuddy 凭证

在 Web 管理界面中：

1. 进入"凭证管理"标签
2. 点击"添加凭证"按钮
3. 填入你的 CodeBuddy Token 和用户 ID
4. 点击"保存"

或者使用命令行：

```bash
cd "D:\Users\Administrator\Documents\GitHub\cb\cloudflare-worker"

# 方法 1: 使用 wrangler CLI（推荐）
npx wrangler kv key put --binding=CREDENTIALS_KV "cred:mytoken_$(date +%s)" '{
  "bearer_token": "你的CodeBuddy_Token",
  "user_id": "你的用户ID",
  "created_at": '$(date +%s)',
  "expires_in": 2592000
}'

# 方法 2: 使用 API
curl -X POST "https://codebuddy-worker.iclaw.workers.dev/v1/credentials" \
  -H "Authorization: Bearer admin123cb" \
  -H "Content-Type: application/json" \
  -d '{
    "bearer_token": "你的CodeBuddy_Token",
    "user_id": "你的用户ID"
  }'
```

### 2. 测试 API

添加凭证后，测试 API 是否正常工作：

```bash
# 测试聊天接口
curl -X POST "https://codebuddy-worker.iclaw.workers.dev/v1/chat/completions" \
  -H "Authorization: Bearer sk-U8FtQmChp-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 3. 查看实时日志

```bash
cd "D:\Users\Administrator\Documents\GitHub\cb\cloudflare-worker"
npx wrangler tail
```

## 📚 文档

- **快速开始**: `QUICKSTART.md`
- **完整文档**: `README.md`
- **项目目录**: `D:\Users\Administrator\Documents\GitHub\cb\cloudflare-worker`

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
```

## ⚙️ 配置说明

当前配置（在 `wrangler.toml` 中）：

- **ROTATION_COUNT**: 1（每次请求轮换凭证）
- **MODELS**: claude-4.0, claude-3.7, gpt-5, gpt-5-mini, gpt-5-nano, o4-mini, gemini-2.5-flash, gemini-2.5-pro, auto-chat
- **KV Namespace ID**: 17788b064bd4411c99333f7976d55fbe

## 🚨 注意事项

1. **凭证管理**: 请妥善保管你的 CodeBuddy Token，不要泄露
2. **API Key**: 建议定期更换 API Key 和 Web 密码
3. **KV 限额**: 免费版每天 1,000 次写入，已优化为每 100 次请求才写入一次状态
4. **过期检查**: 系统会自动跳过过期的凭证
5. **自定义域名**: 如需绑定自定义域名，请在 Cloudflare Dashboard 中配置

## 🔗 相关链接

- **Worker Dashboard**: https://dash.cloudflare.com/
- **Worker URL**: https://codebuddy-worker.iclaw.workers.dev
- **GitHub**: https://github.com/xueyue33/codebuddy2api

## 📞 支持

如遇到问题：

1. 查看实时日志：`npx wrangler tail`
2. 检查凭证状态：访问 `/v1/credentials`
3. 查看完整文档：`README.md`

---

**部署成功！现在你可以开始使用 CodeBuddy Worker 了！** 🚀
