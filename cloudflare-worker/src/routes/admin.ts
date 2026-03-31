import type { Context } from 'hono'
import type { Env } from '../types'
import { adminHTML } from './admin-html'

/**
 * 返回管理界面 HTML
 */
export function getAdminPage(c: Context<{ Bindings: Env }>) {
  return c.html(adminHTML)
}
