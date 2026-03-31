import type { Context } from 'hono'
import type { Env } from '../types'

/**
 * 获取使用统计
 * 注意：Cloudflare Workers 免费版没有内置的统计功能
 * 这里返回模拟数据，实际统计需要自己实现计数逻辑
 */
export async function getStats(c: Context<{ Bindings: Env }>) {
  try {
    // 从 KV 读取统计数据（如果存在）
    const statsKey = 'stats:usage'
    const statsData = await c.env.CREDENTIALS_KV.get(statsKey)

    let stats = {
      total_requests: 0,
      model_usage: {},
      credential_usage: {}
    }

    if (statsData) {
      try {
        stats = JSON.parse(statsData)
      } catch (e) {
        console.error('Failed to parse stats data:', e)
      }
    }

    return c.json({
      total_requests: stats.total_requests || 0,
      model_usage: stats.model_usage || {},
      credential_usage: stats.credential_usage || {}
    })
  } catch (error: any) {
    console.error('Get stats error:', error)
    return c.json({ error: 'Failed to get stats', message: error.message }, 500)
  }
}

/**
 * 记录请求统计（内部使用）
 */
export async function recordStats(
  env: Env,
  model: string,
  credentialId: string
): Promise<void> {
  try {
    const statsKey = 'stats:usage'
    const statsData = await env.CREDENTIALS_KV.get(statsKey)

    let stats = {
      total_requests: 0,
      model_usage: {} as Record<string, number>,
      credential_usage: {} as Record<string, number>
    }

    if (statsData) {
      try {
        stats = JSON.parse(statsData)
      } catch (e) {
        console.error('Failed to parse stats data:', e)
      }
    }

    // 更新统计
    stats.total_requests++
    stats.model_usage[model] = (stats.model_usage[model] || 0) + 1
    stats.credential_usage[credentialId] = (stats.credential_usage[credentialId] || 0) + 1

    // 保存回 KV（注意：这会增加写入次数）
    await env.CREDENTIALS_KV.put(statsKey, JSON.stringify(stats))
  } catch (error) {
    console.error('Failed to record stats:', error)
    // 不抛出错误，避免影响主要功能
  }
}
