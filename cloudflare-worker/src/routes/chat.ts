import type { Context } from 'hono'
import type { Env } from '../types'
import { apiAuth } from '../middleware/auth'
import { CredentialManager } from '../services/credential-manager'
import { convertOpenAIToCodeBuddyMessages, generateCodeBuddyHeaders } from '../services/message-converter'
import { StreamResponseAggregator } from '../services/stream-aggregator'
import { parseSSELine, convertSSEChunkToOpenAIFormat } from '../utils/openai-compat'

/**
 * 聊天完成接口
 */
export async function chatCompletions(c: Context<{ Bindings: Env }>) {
  try {
    // 解析请求体
    const requestBody = await c.req.json()

    console.log('Received request with model:', requestBody.model)

    // 验证请求参数
    if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
      return c.json({ error: 'Messages field is required and must be an array' }, 400)
    }

    if (requestBody.messages.length === 0) {
      return c.json({ error: 'At least one message is required' }, 400)
    }

    // 获取凭证
    const credentialManager = new CredentialManager(c.env)
    const credential = await credentialManager.getNextCredential()

    if (!credential) {
      return c.json({ error: 'No valid CodeBuddy credentials available' }, 401)
    }

    // 转换消息格式
    const codebuddyMessages = convertOpenAIToCodeBuddyMessages(requestBody.messages)

    // 准备请求载荷（CodeBuddy 只支持流式）
    // 注意：直接传递模型名称，让 CodeBuddy API 处理
    const payload = {
      ...requestBody,
      messages: codebuddyMessages,
      stream: true
    }

    console.log('Sending to CodeBuddy with model:', payload.model)

    // 生成请求头
    const headers = generateCodeBuddyHeaders(
      credential.bearer_token,
      credential.user_id,
      c.req.header('X-Conversation-ID'),
      c.req.header('X-Conversation-Request-ID'),
      c.req.header('X-Conversation-Message-ID'),
      c.req.header('X-Request-ID')
    )

    // 发起请求到 CodeBuddy API
    const apiUrl = `${c.env.CODEBUDDY_API_ENDPOINT}/v2/chat/completions`
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`CodeBuddy API error: ${response.status} - ${errorText}`)
      console.error(`Request model: ${payload.model}`)
      console.error(`API URL: ${apiUrl}`)
      return c.json(
        {
          error: `CodeBuddy API error: ${response.status}`,
          details: errorText,
          model: payload.model,
          hint: 'Model may not be supported by CodeBuddy API'
        },
        response.status
      )
    }

    // 判断客户端是否需要流式响应
    const clientWantsStream = requestBody.stream === true

    if (clientWantsStream) {
      // 流式响应：直接转发并转换格式
      return streamResponse(c, response)
    } else {
      // 非流式响应：聚合所有块
      return await nonStreamResponse(c, response)
    }
  } catch (error: any) {
    console.error('Chat completions error:', error)
    return c.json({ error: 'Internal server error', message: error.message }, 500)
  }
}

/**
 * 处理流式响应
 */
function streamResponse(c: Context<{ Bindings: Env }>, response: Response) {
  const toolCallIndexMap = new Map<string, number>()

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // 异步处理流
  ;(async () => {
    try {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 处理完整的 SSE 行
        while (buffer.includes('\n')) {
          const newlineIndex = buffer.indexOf('\n')
          const line = buffer.slice(0, newlineIndex)
          buffer = buffer.slice(newlineIndex + 1)

          if (!line.trim() || line.startsWith(':')) {
            continue
          }

          if (line.includes('[DONE]')) {
            await writer.write(encoder.encode('data: [DONE]\n\n'))
            break
          }

          // 解析 SSE 数据
          const chunkData = parseSSELine(line)
          if (chunkData) {
            // 转换为 OpenAI 格式
            const converted = convertSSEChunkToOpenAIFormat(chunkData, toolCallIndexMap)
            const convertedLine = `data: ${JSON.stringify(converted)}\n\n`
            await writer.write(encoder.encode(convertedLine))
          } else if (line.trim()) {
            // 如果不是标准 SSE 格式，尝试直接解析 JSON
            try {
              const jsonData = JSON.parse(line.startsWith('data:') ? line.substring(5).trim() : line.trim())
              const converted = convertSSEChunkToOpenAIFormat(jsonData, toolCallIndexMap)
              const convertedLine = `data: ${JSON.stringify(converted)}\n\n`
              await writer.write(encoder.encode(convertedLine))
            } catch {
              // 如果解析失败，确保有 data: 前缀
              const outputLine = line.startsWith('data:') ? line : `data: ${line}`
              await writer.write(encoder.encode(outputLine + '\n\n'))
            }
          }
        }
      }

      // 处理缓冲区剩余数据
      if (buffer.trim()) {
        const chunkData = parseSSELine(buffer.trim())
        if (chunkData) {
          const converted = convertSSEChunkToOpenAIFormat(chunkData, toolCallIndexMap)
          const convertedLine = `data: ${JSON.stringify(converted)}\n\n`
          await writer.write(encoder.encode(convertedLine))
        } else {
          // 尝试直接解析 JSON
          try {
            const jsonData = JSON.parse(buffer.trim().startsWith('data:') ? buffer.trim().substring(5).trim() : buffer.trim())
            const converted = convertSSEChunkToOpenAIFormat(jsonData, toolCallIndexMap)
            const convertedLine = `data: ${JSON.stringify(converted)}\n\n`
            await writer.write(encoder.encode(convertedLine))
          } catch {
            // 忽略无法解析的数据
          }
        }
      }

      // 发送 [DONE] 标记
      await writer.write(encoder.encode('data: [DONE]\n\n'))
    } catch (error) {
      console.error('Stream error:', error)
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

/**
 * 处理非流式响应
 */
async function nonStreamResponse(c: Context<{ Bindings: Env }>, response: Response) {
  try {
    const aggregator = new StreamResponseAggregator()
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      while (buffer.includes('\n')) {
        const newlineIndex = buffer.indexOf('\n')
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)

        const obj = parseSSELine(line)
        if (obj) {
          aggregator.processChunk(obj)
        }
      }
    }

    // 处理缓冲区剩余数据
    if (buffer.trim()) {
      const obj = parseSSELine(buffer.trim())
      if (obj) {
        aggregator.processChunk(obj)
      }
    }

    return c.json(aggregator.finalize())
  } catch (error: any) {
    console.error('Non-stream response error:', error)
    return c.json({ error: 'Failed to process response', message: error.message }, 500)
  }
}
