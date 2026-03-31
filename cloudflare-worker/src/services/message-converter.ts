import type { OpenAIMessage, CodeBuddyMessage, ContentBlock } from '../types'

/**
 * 将 OpenAI 格式消息转换为 CodeBuddy 格式
 */
export function convertOpenAIToCodeBuddyMessages(openaiMessages: OpenAIMessage[]): CodeBuddyMessage[] {
  const codebuddyMessages: CodeBuddyMessage[] = []

  // 过滤掉包含错误信息的消息，防止触发 11128 渠道检测
  const filteredMessages = openaiMessages.filter(msg => {
    const content = msg.content
    // 跳过包含 API 错误信息的助手消息
    if (
      msg.role === 'assistant' &&
      typeof content === 'string' &&
      (content.includes('Error: API error') || content.includes('API error:'))
    ) {
      return false
    }
    return true
  })

  // CodeBuddy 要求至少 2 条消息，如果只有 1 条用户消息，添加系统消息
  if (filteredMessages.length === 1 && filteredMessages[0].role === 'user') {
    codebuddyMessages.push({
      role: 'system',
      content: 'You are a helpful assistant.'
    })
  }

  for (const msg of filteredMessages) {
    let role = msg.role
    let content = msg.content

    // 处理特殊的 tool 角色，转换为 user 角色
    if (role === 'tool') {
      role = 'user'
    }

    // 检查是否包含工具调用相关内容
    let hasToolContent = false

    // 检查字符串化的 JSON 内容
    if (typeof content === 'string' && content.startsWith('[{') && content.endsWith('}]')) {
      try {
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          content = parsed
        }
      } catch {
        // 解析失败，保持原样
      }
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'object' && item.type && ['tool_result', 'tool_use'].includes(item.type)) {
          hasToolContent = true
          break
        }
      }
    }

    if (hasToolContent && Array.isArray(content)) {
      // 包含工具调用内容，保持结构化格式
      const processedContent: ContentBlock[] = []

      for (const item of content) {
        if (typeof item === 'object' && item !== null) {
          if (item.type === 'tool_result') {
            // 确保 toolUseId 存在且有效
            let toolUseId = item.toolUseId || item.tool_use_id || item.id
            if (!toolUseId || !/^[a-zA-Z0-9_-]+$/.test(toolUseId)) {
              toolUseId = `tool_${Math.random().toString(36).substring(2, 10)}`
            }

            processedContent.push({
              type: 'tool_result',
              toolUseId,
              content: item.content || item.text || ''
            })
          } else if (item.type === 'tool_use') {
            const toolId = item.id || `tool_${Math.random().toString(36).substring(2, 10)}`
            processedContent.push({
              type: 'tool_use',
              id: toolId,
              name: item.name || '',
              input: item.input || {}
            })
          } else if (item.type === 'text') {
            processedContent.push(item)
          } else if (item.text && !item.type) {
            // 可能是工具结果的简化格式
            const toolUseId = `tool_${Math.random().toString(36).substring(2, 10)}`
            processedContent.push({
              type: 'tool_result',
              toolUseId,
              content: item.text
            })
          } else {
            processedContent.push(item)
          }
        } else {
          processedContent.push(item)
        }
      }

      codebuddyMessages.push({
        role,
        content: processedContent
      })
    } else {
      // 普通文本内容，转换为字符串
      let textContent: string

      if (typeof content === 'string') {
        textContent = content
      } else if (Array.isArray(content)) {
        const textParts: string[] = []
        for (const item of content) {
          if (typeof item === 'object' && item !== null) {
            if (item.type === 'text') {
              textParts.push(item.text || '')
            } else {
              textParts.push(JSON.stringify(item))
            }
          } else if (typeof item === 'string') {
            textParts.push(item)
          } else {
            textParts.push(String(item))
          }
        }
        textContent = textParts.join('')
      } else {
        textContent = content != null ? String(content) : ''
      }

      codebuddyMessages.push({
        role,
        content: textContent
      })
    }
  }

  return codebuddyMessages
}

/**
 * 生成 CodeBuddy API 所需的请求头
 */
export function generateCodeBuddyHeaders(
  bearerToken: string,
  userId?: string,
  conversationId?: string,
  conversationRequestId?: string,
  conversationMessageId?: string,
  requestId?: string
): Record<string, string> {
  return {
    'Host': 'www.codebuddy.ai',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'x-stainless-arch': 'x64',
    'x-stainless-lang': 'js',
    'x-stainless-os': 'Windows',
    'x-stainless-package-version': '5.10.1',
    'x-stainless-retry-count': '0',
    'x-stainless-runtime': 'node',
    'x-stainless-runtime-version': 'v22.13.1',
    'X-Conversation-ID': conversationId || crypto.randomUUID(),
    'X-Conversation-Request-ID': conversationRequestId || generateRandomHex(32),
    'X-Conversation-Message-ID': conversationMessageId || crypto.randomUUID().replace(/-/g, ''),
    'X-Request-ID': requestId || crypto.randomUUID().replace(/-/g, ''),
    'X-Agent-Intent': 'craft',
    'X-IDE-Type': 'CLI',
    'X-IDE-Name': 'CLI',
    'X-IDE-Version': '1.0.7',
    'Authorization': `Bearer ${bearerToken}`,
    'X-Domain': 'www.codebuddy.ai',
    'User-Agent': 'CLI/1.0.7 CodeBuddy/1.0.7',
    'X-Product': 'SaaS',
    'X-User-Id': userId || 'b5be3a67-237e-4ee6-9b9a-0b9ecd7b454b'
  }
}

/**
 * 生成随机十六进制字符串
 */
function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length / 2)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
