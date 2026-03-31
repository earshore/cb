import type { Context } from 'hono'
import type { Env } from '../types'
import { CredentialManager } from '../services/credential-manager'

// CodeBuddy OAuth 常量
const CODEBUDDY_BASE_URL = 'https://www.codebuddy.ai'
const CODEBUDDY_AUTH_STATE_ENDPOINT = `${CODEBUDDY_BASE_URL}/v2/plugin/auth/state`
const CODEBUDDY_AUTH_TOKEN_ENDPOINT = `${CODEBUDDY_BASE_URL}/v2/plugin/auth/token`

let lastAuthState: string | null = null

/**
 * 生成随机十六进制字符串
 */
function generateHex(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 生成认证启动请求头
 */
function getAuthStartHeaders(): Record<string, string> {
  const requestId = crypto.randomUUID().replace(/-/g, '')
  return {
    'Host': 'www.codebuddy.ai',
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'close',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Domain': 'www.codebuddy.ai',
    'X-No-Authorization': 'true',
    'X-No-User-Id': 'true',
    'X-No-Enterprise-Id': 'true',
    'X-No-Department-Info': 'true',
    'User-Agent': 'CLI/1.0.8 CodeBuddy/1.0.8',
    'X-Product': 'SaaS',
    'X-Request-ID': requestId
  }
}

/**
 * 生成认证轮询请求头
 */
function getAuthPollHeaders(): Record<string, string> {
  const requestId = crypto.randomUUID().replace(/-/g, '')
  const spanId = generateHex(8)
  return {
    'Host': 'www.codebuddy.ai',
    'Accept': 'application/json, text/plain, */*',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'close',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Request-ID': requestId,
    'b3': `${requestId}-${spanId}-1-`,
    'X-B3-TraceId': requestId,
    'X-B3-ParentSpanId': '',
    'X-B3-SpanId': spanId,
    'X-B3-Sampled': '1',
    'X-No-Authorization': 'true',
    'X-No-User-Id': 'true',
    'X-No-Enterprise-Id': 'true',
    'X-No-Department-Info': 'true',
    'X-Domain': 'www.codebuddy.ai',
    'User-Agent': 'CLI/1.0.8 CodeBuddy/1.0.8',
    'X-Product': 'SaaS'
  }
}

/**
 * 解析 JWT Token 获取用户信息
 */
function parseJWT(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null

    let payload = parts[1]
    // 修复 Base64 padding
    const missingPadding = payload.length % 4
    if (missingPadding) {
      payload += '='.repeat(4 - missingPadding)
    }

    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch (error) {
    console.error('JWT 解析失败:', error)
    return null
  }
}

/**
 * 启动 CodeBuddy OAuth 认证
 */
export async function startAuth(c: Context<{ Bindings: Env }>) {
  try {
    console.log('启动 CodeBuddy 认证流程...')

    const headers = getAuthStartHeaders()
    const nonce = generateHex(8)
    const stateUrl = `${CODEBUDDY_AUTH_STATE_ENDPOINT}?platform=CLI&nonce=${nonce}`

    const response = await fetch(stateUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ nonce })
    })

    if (response.ok) {
      const result: any = await response.json()
      if (result.code === 0 && result.data) {
        const { state: authState, authUrl } = result.data

        if (authState && authUrl) {
          // 检查是否与上次相同
          if (lastAuthState && authState === lastAuthState) {
            console.warn('返回的 state 与上次相同，尝试重新获取...')
            // 可以选择重试一次
          }

          lastAuthState = authState
          const tokenEndpoint = `${CODEBUDDY_AUTH_TOKEN_ENDPOINT}?state=${authState}`

          return c.json({
            success: true,
            method: 'codebuddy_real_auth',
            auth_state: authState,
            verification_uri_complete: authUrl,
            verification_uri: CODEBUDDY_BASE_URL,
            token_endpoint: tokenEndpoint,
            expires_in: 1800,
            interval: 5,
            status: 'awaiting_login',
            instructions: '请点击链接完成 CodeBuddy 登录',
            message: '请使用提供的链接登录 CodeBuddy',
            platform: 'CLI'
          })
        }
      }
    }

    return c.json({
      success: false,
      error: 'auth_start_failed',
      message: '无法启动认证流程'
    }, 500)
  } catch (error: any) {
    console.error('启动认证失败:', error)
    return c.json({
      success: false,
      error: 'auth_start_failed',
      message: `认证启动失败: ${error.message}`
    }, 500)
  }
}

/**
 * 轮询 CodeBuddy OAuth 认证状态
 */
export async function pollAuth(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json()
    const authState = body.auth_state

    if (!authState) {
      return c.json({
        error: 'missing_parameters',
        error_description: '缺少必要的参数：auth_state'
      }, 400)
    }

    console.log('轮询认证状态:', authState)

    const headers = getAuthPollHeaders()
    const url = `${CODEBUDDY_AUTH_TOKEN_ENDPOINT}?state=${authState}`

    const response = await fetch(url, {
      method: 'GET',
      headers
    })

    if (response.ok) {
      const result: any = await response.json()

      // 仍在等待登录
      if (result.code === 11217) {
        return c.json({
          error: 'authorization_pending',
          error_description: result.msg || '等待用户登录...',
          code: result.code
        }, 400)
      }

      // 认证成功
      if (result.code === 0 && result.data && result.data.accessToken) {
        const data = result.data
        const bearerToken = data.accessToken

        // 解析 JWT 获取用户信息
        const jwtData = parseJWT(bearerToken)
        const userId = jwtData?.email || jwtData?.preferred_username || jwtData?.sub || 'unknown'

        const userInfo = jwtData ? {
          sub: jwtData.sub,
          email: jwtData.email,
          preferred_username: jwtData.preferred_username,
          name: jwtData.name,
          given_name: jwtData.given_name,
          family_name: jwtData.family_name,
          exp: jwtData.exp,
          iat: jwtData.iat,
          scope: jwtData.scope,
          session_state: jwtData.sid
        } : {}

        // 构建凭证数据
        const credential = {
          bearer_token: bearerToken,
          user_id: userId,
          created_at: Math.floor(Date.now() / 1000),
          expires_in: data.expiresIn,
          refresh_token: data.refreshToken,
          token_type: data.tokenType || 'Bearer',
          scope: data.scope,
          domain: data.domain,
          session_state: data.sessionState,
          user_info: userInfo
        }

        // 保存凭证
        const credentialManager = new CredentialManager(c.env)
        const saved = await credentialManager.addCredential(credential)

        return c.json({
          access_token: bearerToken,
          token_type: credential.token_type,
          expires_in: credential.expires_in,
          refresh_token: credential.refresh_token,
          scope: credential.scope,
          saved,
          message: '认证成功！🎉',
          user_info: userInfo,
          domain: credential.domain
        })
      }

      // 其他状态
      return c.json({
        error: 'auth_error',
        error_description: result.msg || '认证过程发生错误',
        code: result.code
      }, 400)
    }

    return c.json({
      error: 'auth_error',
      error_description: `API 请求失败，状态码: ${response.status}`
    }, 400)
  } catch (error: any) {
    console.error('轮询认证失败:', error)
    return c.json({
      error: 'auth_error',
      error_description: `轮询失败: ${error.message}`
    }, 500)
  }
}

/**
 * OAuth 回调端点
 */
export async function authCallback(c: Context<{ Bindings: Env }>) {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  if (error) {
    return c.json({
      error,
      error_description: '授权被拒绝或出现错误'
    }, 400)
  }

  return c.json({
    message: '授权成功！请返回应用程序。',
    code,
    state
  })
}
