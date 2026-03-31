import type { Context } from 'hono'
import type { Env } from '../types'
import { CredentialManager } from '../services/credential-manager'

/**
 * 获取模型列表
 */
export async function listModels(c: Context<{ Bindings: Env }>) {
  try {
    // 获取凭证
    const credentialManager = new CredentialManager(c.env)
    const credential = await credentialManager.getNextCredential()

    if (!credential) {
      return c.json({ error: 'No valid CodeBuddy credentials available' }, 401)
    }

    // 尝试多个可能的 API 端点
    const endpoints = [
      '/v2/models',
      '/v1/models',
      '/api/models',
      '/models'
    ]

    let modelsData = null

    for (const endpoint of endpoints) {
      try {
        const apiUrl = `${c.env.CODEBUDDY_API_ENDPOINT}${endpoint}`
        console.log(`Trying models endpoint: ${apiUrl}`)

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${credential.bearer_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-User-Id': credential.user_id
          }
        })

        if (response.ok) {
          modelsData = await response.json()
          console.log(`Successfully fetched models from ${endpoint}`)
          break
        } else {
          console.log(`Endpoint ${endpoint} returned ${response.status}`)
        }
      } catch (err) {
        console.log(`Endpoint ${endpoint} failed:`, err)
      }
    }

    // 如果成功获取到模型数据
    if (modelsData) {
      // 转换为 OpenAI 格式
      if (modelsData.data && Array.isArray(modelsData.data)) {
        return c.json({
          object: 'list',
          data: modelsData.data.map((model: any) => ({
            id: model.id || model.name || model.model,
            object: 'model',
            created: model.created || Math.floor(Date.now() / 1000),
            owned_by: model.owned_by || 'codebuddy'
          }))
        })
      }

      // 如果是数组格式
      if (Array.isArray(modelsData)) {
        return c.json({
          object: 'list',
          data: modelsData.map((model: any) => ({
            id: typeof model === 'string' ? model : (model.id || model.name || model.model),
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'codebuddy'
          }))
        })
      }

      // 返回原始数据
      return c.json(modelsData)
    }

    // 如果所有端点都失败，使用环境变量中的模型列表
    console.log('All endpoints failed, using MODELS from env')
    const modelsStr = c.env.MODELS || 'Default,auto-chat'
    const models = modelsStr.split(',').map(m => m.trim()).filter(m => m)

    return c.json({
      object: 'list',
      data: models.map(model => ({
        id: model,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'codebuddy'
      }))
    })
  } catch (error: any) {
    console.error('List models error:', error)
    return c.json({ error: 'Failed to list models', message: error.message }, 500)
  }
}
