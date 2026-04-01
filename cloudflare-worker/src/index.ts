import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'
import { apiAuth, webAuth, authenticate } from './middleware/auth'
import { chatCompletions } from './routes/chat'
import { listModels } from './routes/models'
import {
  listCredentials,
  addCredential,
  deleteCredential,
  selectCredential,
  resumeAutoRotation,
  toggleAutoRotation,
  getCurrentCredential,
  validateCredential,
  toggleCredentialDisabled
} from './routes/credentials'
import { getAdminPage } from './routes/admin'
import { startAuth, pollAuth, authCallback } from './routes/auth'
import { getSettings, updateSettings } from './routes/settings'
import { getStats } from './routes/stats'
import { changePassword, changeApiKey, listApiKeys, addApiKey, deleteApiKey } from './routes/password'

const app = new Hono<{ Bindings: Env }>()

// CORS 中间件
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true
}))

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'healthy', service: 'codebuddy-worker' })
})

// 调试端点 - 检查环境变量
app.get('/debug/env', (c) => {
  return c.json({
    has_env: !!c.env,
    has_api_key: !!c.env?.API_KEY,
    has_web_password: !!c.env?.WEB_PASSWORD,
    api_key_length: c.env?.API_KEY?.length || 0,
    web_password_length: c.env?.WEB_PASSWORD?.length || 0
  })
})

// 根路径 - 返回管理界面
app.get('/', getAdminPage)

// API 信息
app.get('/api', (c) => {
  return c.json({
    service: 'CodeBuddy Worker',
    version: '1.0.0',
    description: 'CodeBuddy API proxy on Cloudflare Workers with OpenAI-compatible interface',
    endpoints: {
      models: '/v1/models',
      chat: '/v1/chat/completions',
      credentials: '/v1/credentials'
    }
  })
})

// OpenAI 兼容 API 路由（同时接受 API key 和 Web 密码）
app.post('/v1/chat/completions', authenticate, chatCompletions)
app.get('/v1/models', authenticate, listModels)

// 兼容原有路径（带 /codebuddy 前缀）
app.post('/codebuddy/v1/chat/completions', authenticate, chatCompletions)
app.get('/codebuddy/v1/models', authenticate, listModels)

// 额外的 OpenAI 兼容端点（用于某些客户端的自动发现）
app.options('/v1/chat/completions', (c) => c.text('', 204))
app.options('/v1/models', (c) => c.text('', 204))

// 一些客户端会调用这些端点来验证 API
app.get('/v1', (c) => {
  return c.json({
    object: 'api',
    version: '1.0.0',
    endpoints: ['/v1/models', '/v1/chat/completions']
  })
})

app.get('/v1/engines', authenticate, listModels) // 旧版 OpenAI API 兼容
app.post('/v1/completions', authenticate, chatCompletions) // 旧版补全端点

// 凭证管理路由（需要认证）
app.get('/v1/credentials', authenticate, listCredentials)
app.post('/v1/credentials', authenticate, addCredential)
app.post('/v1/credentials/delete', authenticate, deleteCredential)
app.post('/v1/credentials/select', authenticate, selectCredential)
app.post('/v1/credentials/auto', authenticate, resumeAutoRotation)
app.post('/v1/credentials/toggle-rotation', authenticate, toggleAutoRotation)
app.get('/v1/credentials/current', authenticate, getCurrentCredential)
app.post('/v1/credentials/validate', authenticate, validateCredential)
app.post('/v1/credentials/toggle-disabled', authenticate, toggleCredentialDisabled)

// 兼容原有路径（带 /codebuddy 前缀）
app.get('/codebuddy/v1/credentials', authenticate, listCredentials)
app.post('/codebuddy/v1/credentials', authenticate, addCredential)
app.post('/codebuddy/v1/credentials/delete', authenticate, deleteCredential)
app.post('/codebuddy/v1/credentials/select', authenticate, selectCredential)
app.post('/codebuddy/v1/credentials/auto', authenticate, resumeAutoRotation)
app.post('/codebuddy/v1/credentials/toggle-rotation', authenticate, toggleAutoRotation)
app.get('/codebuddy/v1/credentials/current', authenticate, getCurrentCredential)
app.post('/codebuddy/v1/credentials/validate', authenticate, validateCredential)
app.post('/codebuddy/v1/credentials/toggle-disabled', authenticate, toggleCredentialDisabled)

// OAuth 认证路由
app.get('/codebuddy/auth/start', startAuth)
app.post('/codebuddy/auth/poll', pollAuth)
app.get('/codebuddy/auth/callback', authCallback)

// 设置路由
app.get('/api/settings', authenticate, getSettings)
app.post('/api/settings', authenticate, updateSettings)

// 统计路由
app.get('/api/stats', authenticate, getStats)

// 密码管理路由
app.post('/api/change-password', authenticate, changePassword)
app.post('/api/change-api-key', authenticate, changeApiKey)
app.get('/api/api-keys', authenticate, listApiKeys)
app.post('/api/api-keys', authenticate, addApiKey)
app.delete('/api/api-keys', authenticate, deleteApiKey)

// 404 处理 - 返回标准的 OpenAI 错误格式
app.notFound((c) => {
  return c.json({
    error: {
      message: 'Not Found',
      type: 'invalid_request_error',
      code: 'not_found'
    }
  }, 404)
})

// 错误处理 - 返回标准的 OpenAI 错误格式
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({
    error: {
      message: err.message || 'Internal Server Error',
      type: 'internal_server_error',
      code: 'internal_error'
    }
  }, 500)
})

export default app
