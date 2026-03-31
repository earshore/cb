import type { Context } from 'hono'
import type { Env, Credential } from '../types'
import { CredentialManager } from '../services/credential-manager'

/**
 * 列出所有凭证
 */
export async function listCredentials(c: Context<{ Bindings: Env }>) {
  try {
    const credentialManager = new CredentialManager(c.env)
    const credentialsInfo = await credentialManager.getCredentialsInfo()

    // 格式化时间显示
    const safeCredentials = credentialsInfo.map(info => {
      let timeRemainingStr = 'Unknown'
      if (info.time_remaining !== null && info.time_remaining > 0) {
        const days = Math.floor(info.time_remaining / 86400)
        const hours = Math.floor((info.time_remaining % 86400) / 3600)
        const minutes = Math.floor((info.time_remaining % 3600) / 60)
        timeRemainingStr = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
      } else if (info.time_remaining !== null) {
        timeRemainingStr = 'Expired'
      }

      return {
        ...info,
        time_remaining_str: timeRemainingStr
      }
    })

    return c.json({ credentials: safeCredentials })
  } catch (error: any) {
    console.error('List credentials error:', error)
    return c.json({ error: 'Failed to list credentials', message: error.message }, 500)
  }
}

/**
 * 添加新凭证
 */
export async function addCredential(c: Context<{ Bindings: Env }>) {
  try {
    const data = await c.req.json()

    if (!data.bearer_token) {
      return c.json({ error: 'bearer_token is required' }, 422)
    }

    const credential: Credential = {
      bearer_token: data.bearer_token,
      user_id: data.user_id || 'unknown',
      created_at: data.created_at || Math.floor(Date.now() / 1000),
      expires_in: data.expires_in,
      user_info: data.user_info,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      scope: data.scope,
      domain: data.domain,
      session_state: data.session_state
    }

    const credentialManager = new CredentialManager(c.env)
    const success = await credentialManager.addCredential(credential)

    if (!success) {
      return c.json({ error: 'Failed to save credential' }, 500)
    }

    return c.json({ message: 'Credential added successfully' })
  } catch (error: any) {
    console.error('Add credential error:', error)
    return c.json({ error: 'Failed to add credential', message: error.message }, 500)
  }
}

/**
 * 删除凭证
 */
export async function deleteCredential(c: Context<{ Bindings: Env }>) {
  try {
    const data = await c.req.json()
    const index = data.index

    if (index === undefined || typeof index !== 'number') {
      return c.json({ error: 'Valid integer index is required' }, 422)
    }

    const credentialManager = new CredentialManager(c.env)
    const success = await credentialManager.deleteCredential(index)

    if (!success) {
      return c.json({ error: 'Invalid index or failed to delete credential' }, 400)
    }

    return c.json({ message: `Credential #${index + 1} deleted successfully` })
  } catch (error: any) {
    console.error('Delete credential error:', error)
    return c.json({ error: 'Failed to delete credential', message: error.message }, 500)
  }
}

/**
 * 手动选择凭证
 */
export async function selectCredential(c: Context<{ Bindings: Env }>) {
  try {
    const data = await c.req.json()
    const index = data.index

    if (index === undefined || typeof index !== 'number') {
      return c.json({ error: 'index is required' }, 422)
    }

    const credentialManager = new CredentialManager(c.env)
    const success = await credentialManager.setManualCredential(index)

    if (!success) {
      return c.json({ error: 'Invalid credential index' }, 400)
    }

    return c.json({ message: `Credential #${index + 1} selected successfully` })
  } catch (error: any) {
    console.error('Select credential error:', error)
    return c.json({ error: 'Failed to select credential', message: error.message }, 500)
  }
}

/**
 * 恢复自动轮换
 */
export async function resumeAutoRotation(c: Context<{ Bindings: Env }>) {
  try {
    const credentialManager = new CredentialManager(c.env)
    await credentialManager.clearManualSelection()

    return c.json({ message: 'Resumed automatic credential rotation' })
  } catch (error: any) {
    console.error('Resume auto rotation error:', error)
    return c.json({ error: 'Failed to resume auto rotation', message: error.message }, 500)
  }
}

/**
 * 切换自动轮换
 */
export async function toggleAutoRotation(c: Context<{ Bindings: Env }>) {
  try {
    const credentialManager = new CredentialManager(c.env)
    const isEnabled = await credentialManager.toggleAutoRotation()

    const status = isEnabled ? 'enabled' : 'disabled'
    return c.json({
      message: `Auto rotation ${status}`,
      auto_rotation_enabled: isEnabled
    })
  } catch (error: any) {
    console.error('Toggle auto rotation error:', error)
    return c.json({ error: 'Failed to toggle auto rotation', message: error.message }, 500)
  }
}

/**
 * 获取当前凭证信息
 */
export async function getCurrentCredential(c: Context<{ Bindings: Env }>) {
  try {
    const credentialManager = new CredentialManager(c.env)
    const info = await credentialManager.getCurrentCredentialInfo()

    return c.json(info)
  } catch (error: any) {
    console.error('Get current credential error:', error)
    return c.json({ error: 'Failed to get current credential', message: error.message }, 500)
  }
}

/**
 * 验证特定凭证
 */
export async function validateCredential(c: Context<{ Bindings: Env }>) {
  try {
    const data = await c.req.json()
    const index = data.index

    if (index === undefined || typeof index !== 'number') {
      return c.json({ error: 'index is required' }, 422)
    }

    const credentialManager = new CredentialManager(c.env)
    const credentials = await credentialManager.getAllCredentials()

    if (index < 0 || index >= credentials.length) {
      return c.json({
        valid: false,
        error: 'Invalid credential index',
        details: `Index ${index} out of range (0-${credentials.length - 1})`
      }, 400)
    }

    const credential = credentials[index]

    // 检查是否过期
    if (credential.expires_in) {
      const expiresAt = credential.created_at + credential.expires_in
      const now = Math.floor(Date.now() / 1000)
      if (now >= expiresAt) {
        return c.json({
          valid: false,
          error: 'Credential expired',
          details: `Expired at ${new Date(expiresAt * 1000).toISOString()}`
        })
      }
    }

    // 尝试调用 CodeBuddy API 验证
    const apiUrl = `${c.env.CODEBUDDY_API_ENDPOINT}/v2/chat/completions`
    const testPayload = {
      model: 'auto-chat',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'test' }
      ],
      max_tokens: 5,
      stream: true
    }

    const headers = {
      'Host': 'www.codebuddy.ai',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${credential.bearer_token}`,
      'X-User-Id': credential.user_id,
      'X-Conversation-ID': crypto.randomUUID(),
      'X-Request-ID': crypto.randomUUID().replace(/-/g, '')
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload)
    })

    if (response.ok) {
      return c.json({
        valid: true,
        message: 'Credential is valid',
        status: response.status
      })
    } else {
      const errorText = await response.text()
      return c.json({
        valid: false,
        error: `API returned ${response.status}`,
        details: errorText,
        status: response.status
      }, response.status)
    }
  } catch (error: any) {
    console.error('Validate credential error:', error)
    return c.json({
      valid: false,
      error: 'Validation failed',
      details: error.message
    }, 500)
  }
}
