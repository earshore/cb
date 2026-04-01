import type { Context } from 'hono'
import type { Env } from '../types'

/**
 * 修改 Web 密码
 */
export async function changePassword(c: Context<{ Bindings: Env }>) {
  try {
    const data = await c.req.json()
    const { current_password, new_password } = data

    if (!current_password || !new_password) {
      return c.json({
        error: {
          message: 'Current password and new password are required',
          type: 'invalid_request_error',
          code: 'missing_parameter'
        }
      }, 400)
    }

    // 验证新密码长度
    if (new_password.length < 6) {
      return c.json({
        error: {
          message: 'New password must be at least 6 characters',
          type: 'invalid_request_error',
          code: 'invalid_parameter'
        }
      }, 400)
    }

    // 从 KV 读取当前密码（如果存在）
    const storedPassword = await c.env.CREDENTIALS_KV.get('config:web_password')
    const currentPassword = storedPassword || c.env.WEB_PASSWORD || 'change-me-in-production'

    // 验证当前密码
    if (current_password !== currentPassword) {
      return c.json({
        error: {
          message: 'Current password is incorrect',
          type: 'invalid_request_error',
          code: 'invalid_password'
        }
      }, 401)
    }

    // 保存新密码到 KV
    await c.env.CREDENTIALS_KV.put('config:web_password', new_password)

    return c.json({
      message: 'Password changed successfully',
      note: 'Please use the new password for future logins'
    })
  } catch (error: any) {
    console.error('Change password error:', error)
    return c.json({
      error: {
        message: 'Failed to change password',
        type: 'internal_server_error',
        code: 'internal_error'
      }
    }, 500)
  }
}

/**
 * 修改 API Key
 */
export async function changeApiKey(c: Context<{ Bindings: Env }>) {
  try {
    const data = await c.req.json()
    const { new_api_key } = data

    if (!new_api_key) {
      return c.json({
        error: {
          message: 'New API key is required',
          type: 'invalid_request_error',
          code: 'missing_parameter'
        }
      }, 400)
    }

    // 验证 API Key 格式
    if (!new_api_key.startsWith('sk-') || new_api_key.length < 10) {
      return c.json({
        error: {
          message: 'Invalid API key format (must start with sk- and be at least 10 characters)',
          type: 'invalid_request_error',
          code: 'invalid_parameter'
        }
      }, 400)
    }

    // 保存新 API Key 到 KV
    await c.env.CREDENTIALS_KV.put('config:api_key', new_api_key)

    return c.json({
      message: 'API key changed successfully',
      note: 'Please use the new API key for future API calls'
    })
  } catch (error: any) {
    console.error('Change API key error:', error)
    return c.json({
      error: {
        message: 'Failed to change API key',
        type: 'internal_server_error',
        code: 'internal_error'
      }
    }, 500)
  }
}

/**
 * 获取所有 API Keys
 */
export async function listApiKeys(c: Context<{ Bindings: Env }>) {
  try {
    const list = await c.env.CREDENTIALS_KV.list({ prefix: 'config:api_key:' })
    const keys: any[] = []

    for (const item of list.keys) {
      const key = await c.env.CREDENTIALS_KV.get(item.name)
      if (key) {
        const keyId = item.name.replace('config:api_key:', '')
        keys.push({
          id: keyId,
          key: key,
          created_at: item.metadata?.created_at || Date.now()
        })
      }
    }

    // 总是返回默认key
    const defaultKey = c.env.API_KEY || 'sk-change-me-in-production'
    keys.unshift({
      id: 'default',
      key: defaultKey,
      created_at: Date.now(),
      is_default: true
    })

    return c.json({ keys })
  } catch (error: any) {
    console.error('List API keys error:', error)
    return c.json({
      error: {
        message: 'Failed to list API keys',
        type: 'internal_server_error',
        code: 'internal_error'
      }
    }, 500)
  }
}

/**
 * 添加新 API Key
 */
export async function addApiKey(c: Context<{ Bindings: Env }>) {
  try {
    const data = await c.req.json()
    const { api_key } = data

    if (!api_key) {
      return c.json({
        error: {
          message: 'API key is required',
          type: 'invalid_request_error',
          code: 'missing_parameter'
        }
      }, 400)
    }

    // 验证 API Key 格式
    if (!api_key.startsWith('sk-') || api_key.length < 10) {
      return c.json({
        error: {
          message: 'Invalid API key format (must start with sk- and be at least 10 characters)',
          type: 'invalid_request_error',
          code: 'invalid_parameter'
        }
      }, 400)
    }

    // 生成唯一ID
    const keyId = Date.now().toString()
    const keyName = `config:api_key:${keyId}`

    // 保存到 KV
    await c.env.CREDENTIALS_KV.put(keyName, api_key, {
      metadata: { created_at: Date.now() }
    })

    return c.json({
      message: 'API key added successfully',
      key_id: keyId
    })
  } catch (error: any) {
    console.error('Add API key error:', error)
    return c.json({
      error: {
        message: 'Failed to add API key',
        type: 'internal_server_error',
        code: 'internal_error'
      }
    }, 500)
  }
}

/**
 * 删除 API Key
 */
export async function deleteApiKey(c: Context<{ Bindings: Env }>) {
  try {
    const data = await c.req.json()
    const { key_id } = data

    if (!key_id) {
      return c.json({
        error: {
          message: 'Key ID is required',
          type: 'invalid_request_error',
          code: 'missing_parameter'
        }
      }, 400)
    }

    // 不允许删除默认key
    if (key_id === 'default') {
      return c.json({
        error: {
          message: 'Cannot delete default API key',
          type: 'invalid_request_error',
          code: 'invalid_operation'
        }
      }, 400)
    }

    const keyName = `config:api_key:${key_id}`
    await c.env.CREDENTIALS_KV.delete(keyName)

    return c.json({
      message: 'API key deleted successfully'
    })
  } catch (error: any) {
    console.error('Delete API key error:', error)
    return c.json({
      error: {
        message: 'Failed to delete API key',
        type: 'internal_server_error',
        code: 'internal_error'
      }
    }, 500)
  }
}
