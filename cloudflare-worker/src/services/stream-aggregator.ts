import type { ToolCall, ChatCompletionResponse } from '../types'
import { validateAndFixToolCallArgs } from '../utils/openai-compat'

/**
 * 流式响应聚合器
 * 用于将 CodeBuddy 的流式响应聚合为完整的 OpenAI 格式响应
 */
export class StreamResponseAggregator {
  private data: {
    id: string | null
    model: string | null
    content: string
    tool_calls: ToolCall[]
    finish_reason: string | null
    usage: any | null
    system_fingerprint: string | null
  }

  // 使用工具调用 ID 作为键，因为 index 都是 0 会覆盖
  private toolCallMap: Map<string, ToolCall>
  private toolCallOrder: string[]
  private currentToolId: string | null

  constructor() {
    this.data = {
      id: null,
      model: null,
      content: '',
      tool_calls: [],
      finish_reason: null,
      usage: null,
      system_fingerprint: null
    }
    this.toolCallMap = new Map()
    this.toolCallOrder = []
    this.currentToolId = null
  }

  /**
   * 处理单个响应块
   */
  processChunk(obj: any): void {
    // 聚合基本信息
    this.data.id = this.data.id || obj.id
    this.data.model = this.data.model || obj.model
    this.data.system_fingerprint = obj.system_fingerprint || this.data.system_fingerprint

    if (obj.usage) {
      this.data.usage = obj.usage
    }

    const choices = obj.choices
    if (!choices || choices.length === 0) {
      return
    }

    const choice = choices[0]
    if (choice.finish_reason) {
      this.data.finish_reason = choice.finish_reason
    }

    const delta = choice.delta
    if (!delta) {
      return
    }

    // 聚合内容
    if (delta.content) {
      this.data.content += delta.content
    }

    // 处理工具调用
    if (delta.tool_calls) {
      this.processToolCalls(delta.tool_calls)
    }
  }

  /**
   * 处理工具调用
   */
  private processToolCalls(toolCalls: any[]): void {
    for (const tc of toolCalls) {
      const toolId = tc.id

      // 如果有 ID，这是一个新的工具调用
      if (toolId) {
        if (!this.toolCallMap.has(toolId)) {
          this.toolCallMap.set(toolId, {
            id: toolId,
            type: 'function',
            function: {
              name: '',
              arguments: ''
            }
          })
          this.toolCallOrder.push(toolId)
          this.currentToolId = toolId
        } else {
          this.currentToolId = toolId
        }

        const toolCall = this.toolCallMap.get(toolId)!
        if (tc.type) {
          toolCall.type = tc.type
        }

        const func = tc.function
        if (func) {
          if (func.name) {
            toolCall.function.name = func.name
          }
          if (func.arguments) {
            toolCall.function.arguments += func.arguments
          }
        }
      }
      // 如果没有 ID，但有当前工具调用 ID，这是增量数据
      else if (this.currentToolId && this.toolCallMap.has(this.currentToolId)) {
        const toolCall = this.toolCallMap.get(this.currentToolId)!
        const func = tc.function
        if (func) {
          if (func.name) {
            toolCall.function.name = func.name
          }
          if (func.arguments) {
            toolCall.function.arguments += func.arguments
          }
        }
      }
    }
  }

  /**
   * 完成聚合并返回最终响应
   */
  finalize(): ChatCompletionResponse {
    // 按接收顺序构建工具调用列表
    if (this.toolCallMap.size > 0) {
      this.data.tool_calls = []
      for (const toolId of this.toolCallOrder) {
        const tc = this.toolCallMap.get(toolId)
        if (tc) {
          // 验证和修复工具调用参数
          tc.function.arguments = validateAndFixToolCallArgs(tc.function.arguments)
          this.data.tool_calls.push(tc)
        }
      }
    }

    // 构建最终响应
    const finalMessage: any = {
      role: 'assistant',
      content: this.data.content
    }

    if (this.data.tool_calls.length > 0) {
      finalMessage.tool_calls = this.data.tool_calls
    }

    const finishReason = this.data.tool_calls.length > 0
      ? 'tool_calls'
      : (this.data.finish_reason || 'stop')

    const finalResponse: ChatCompletionResponse = {
      id: this.data.id || crypto.randomUUID(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.data.model || 'unknown',
      choices: [
        {
          index: 0,
          message: finalMessage,
          finish_reason: finishReason,
          logprobs: null
        }
      ]
    }

    if (this.data.usage) {
      finalResponse.usage = this.data.usage
    }

    if (this.data.system_fingerprint) {
      finalResponse.system_fingerprint = this.data.system_fingerprint
    }

    return finalResponse
  }
}
