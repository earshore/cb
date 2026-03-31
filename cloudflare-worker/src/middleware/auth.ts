import type { Context } from 'hono'
import type { Env } from '../types'

/**
 * Web 界面认证中间件
 * 验证 Authorization header 是否为 "Bearer admin123cb"
 */
export async function webAuth(c: Context<{ Bindings: Env }>, next: () => Promise<void>) {
  const auth = c.req.header('Authorization')

  // 优先从 KV 读取密码，如果不存在则使用环境变量
  const storedPassword = await c.env.CREDENTIALS_KV.get('config:web_password')
  const expectedPassword = storedPassword || c.env?.WEB_PASSWORD || 'admin123cb'

  if (!auth || auth !== `Bearer ${expectedPassword}`) {
    return c.json({
      error: {
        message: 'Invalid web password',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    }, 401)
  }

  await next()
}

/**
 * API 认证中间件
 * 验证 Authorization header 是否为 "Bearer sk-U8FtQmChp-api-key"
 */
export async function apiAuth(c: Context<{ Bindings: Env }>, next: () => Promise<void>) {
  const auth = c.req.header('Authorization')

  // 优先从 KV 读取 API Key，如果不存在则使用环境变量
  const storedApiKey = await c.env.CREDENTIALS_KV.get('config:api_key')
  const expectedKey = storedApiKey || c.env?.API_KEY || 'sk-U8FtQmChp-api-key'

  console.log('API Auth - Received:', auth ? 'Bearer ***' : 'none')
  console.log('API Auth - Expected:', expectedKey ? 'Bearer ***' : 'none')

  if (!auth || auth !== `Bearer ${expectedKey}`) {
    return c.json({
      error: {
        message: 'Incorrect API key provided',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    }, 401)
  }

  await next()
}

/**
 * 通用认证中间件（同时支持 Web 密码和 API key）
 */
export async function authenticate(c: Context<{ Bindings: Env }>, next: () => Promise<void>) {
  const auth = c.req.header('Authorization')

  if (!auth) {
    return c.json({
      error: {
        message: 'Missing Authorization header',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    }, 401)
  }

  try {
    // 优先从 KV 读取，如果不存在则使用环境变量
    const storedPassword = await c.env.CREDENTIALS_KV.get('config:web_password').catch(() => null)
    const storedApiKey = await c.env.CREDENTIALS_KV.get('config:api_key').catch(() => null)

    const expectedWebPassword = storedPassword || c.env?.WEB_PASSWORD || 'admin123cb'
    const expectedApiKey = storedApiKey || c.env?.API_KEY || 'sk-U8FtQmChp-api-key'

    // 检查是否是有效的 Web 密码或 API key
    const isValidWebPassword = auth === `Bearer ${expectedWebPassword}`
    const isValidApiKey = auth === `Bearer ${expectedApiKey}`

    if (!isValidWebPassword && !isValidApiKey) {
      return c.json({
        error: {
          message: 'Incorrect API key provided',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      }, 401)
    }

    await next()
  } catch (error) {
    console.error('Auth error:', error)
    return c.json({
      error: {
        message: 'Authentication failed',
        type: 'internal_server_error',
        code: 'internal_error'
      }
    }, 500)
  }
}
