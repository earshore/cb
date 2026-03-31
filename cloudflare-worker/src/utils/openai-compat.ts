import type { ToolCall } from '../types'

/**
 * OpenAI 兼容性工具函数
 */

/**
 * 转换工具调用 ID 格式: tooluse_xxx -> call_xxx
 */
export function convertToolCallId(codebuddyId: string): string {
  if (codebuddyId.startsWith('tooluse_')) {
    return `call_${codebuddyId.substring(8)}`
  }
  return codebuddyId
}

/**
 * 验证和修复工具调用参数
 */
export function validateAndFixToolCallArgs(args: string): string {
  if (!args) {
    return '{}'
  }

  args = args.trim()

  // 检查是否是多个 JSON 对象连接的情况
  if (args.includes('}{')) {
    const jsonObjects: any[] = []
    let currentObj = ''
    let braceCount = 0

    for (let i = 0; i < args.length; i++) {
      const char = args[i]
      currentObj += char

      if (char === '{') {
        braceCount++
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0 && currentObj.trim()) {
          try {
            const parsed = JSON.parse(currentObj.trim())
            jsonObjects.push(parsed)
            currentObj = ''
          } catch {
            currentObj = ''
          }
        }
      }
    }

    if (jsonObjects.length > 0) {
      return JSON.stringify(jsonObjects[0])
    }
  }

  // 尝试解析原始参数
  try {
    JSON.parse(args)
    return args
  } catch {
    // 尝试修复常见的 JSON 问题
    if (!args.endsWith('}') && args.split('{').length > args.split('}').length) {
      args += '}'
    } else if (!args.endsWith(']') && args.split('[').length > args.split(']').length) {
      args += ']'
    }

    try {
      JSON.parse(args)
      return args
    } catch {
      return '{}'
    }
  }
}

/**
 * 解析 SSE 行
 */
export function parseSSELine(line: string): any | null {
  if (!line.startsWith('data: ')) {
    return null
  }

  const data = line.substring(6).trim()
  if (!data || data === '[DONE]') {
    return null
  }

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * 格式化 SSE 错误响应
 */
export function formatSSEError(message: string, errorType: string = 'stream_error'): string {
  const errorData = {
    error: {
      message,
      type: errorType
    }
  }
  return `data: ${JSON.stringify(errorData)}\n\n`
}

/**
 * 转换 SSE 块为 OpenAI 格式
 */
export function convertSSEChunkToOpenAIFormat(
  chunkData: any,
  toolCallIndexMap: Map<string, number>
): any {
  if (!chunkData.choices) {
    return chunkData
  }

  const choice = chunkData.choices[0]
  const delta = choice?.delta
  const toolCalls = delta?.tool_calls

  if (!toolCalls || toolCalls.length === 0) {
    return chunkData
  }

  // 转换工具调用格式
  const convertedToolCalls = toolCalls.map((tc: any) => {
    const converted = { ...tc }

    // 转换 ID 格式
    if (tc.id) {
      const originalId = tc.id
      const convertedId = convertToolCallId(originalId)
      converted.id = convertedId

      // 分配新的 index
      if (!toolCallIndexMap.has(originalId)) {
        toolCallIndexMap.set(originalId, toolCallIndexMap.size)
      }

      converted.index = toolCallIndexMap.get(originalId)
    } else if (toolCallIndexMap.size > 0) {
      // 如果没有 ID，使用最后一个工具调用的 index
      converted.index = Math.max(...Array.from(toolCallIndexMap.values()))
    }

    return converted
  })

  // 更新 chunk 数据
  const convertedChunk = { ...chunkData }
  convertedChunk.choices[0].delta.tool_calls = convertedToolCalls

  return convertedChunk
}
