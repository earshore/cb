import type { Context } from 'hono'
import type { Env } from '../types'

/**
 * 获取配置
 */
export async function getSettings(c: Context<{ Bindings: Env }>) {
  try {
    const env = c.env || {}
    const settings = {
      CODEBUDDY_API_ENDPOINT: env.CODEBUDDY_API_ENDPOINT || 'https://www.codebuddy.ai',
      ROTATION_COUNT: env.ROTATION_COUNT || '1',
      MODELS: env.MODELS || 'claude-4.0,claude-3.7,gpt-5,gpt-5-mini,gpt-5-nano,o4-mini,gemini-2.5-flash,gemini-2.5-pro,auto-chat'
    }

    const labels = {
      CODEBUDDY_API_ENDPOINT: 'CodeBuddy API 端点',
      ROTATION_COUNT: '凭证轮换次数',
      MODELS: '可用模型列表'
    }

    return c.json({ settings, labels })
  } catch (error: any) {
    console.error('Get settings error:', error)
    return c.json({ error: 'Failed to get settings', message: error.message }, 500)
  }
}

/**
 * 更新配置
 * 注意: Cloudflare Workers 的环境变量是只读的，需要通过 wrangler.toml 或 Dashboard 修改
 */
export async function updateSettings(c: Context<{ Bindings: Env }>) {
  try {
    const data = await c.req.json()
    const env = c.env || {}

    return c.json({
      message: '配置更新需要修改 wrangler.toml 文件并重新部署 Worker',
      note: 'Cloudflare Workers 环境变量是只读的，无法通过 API 动态修改',
      current_settings: {
        CODEBUDDY_API_ENDPOINT: env.CODEBUDDY_API_ENDPOINT || 'https://www.codebuddy.ai',
        ROTATION_COUNT: env.ROTATION_COUNT || '1',
        MODELS: env.MODELS || 'claude-4.0,claude-3.7,gpt-5,gpt-5-mini,gpt-5-nano,o4-mini,gemini-2.5-flash,gemini-2.5-pro,auto-chat'
      }
    }, 400)
  } catch (error: any) {
    console.error('Update settings error:', error)
    return c.json({ error: 'Failed to update settings', message: error.message }, 500)
  }
}
