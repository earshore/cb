/**
 * Cloudflare Worker 环境类型定义
 */
export interface Env {
  CREDENTIALS_KV: KVNamespace
  WEB_PASSWORD: string
  API_KEY: string
  CODEBUDDY_API_ENDPOINT: string
  ROTATION_COUNT: string
  MODELS: string
}

/**
 * CodeBuddy 凭证数据结构
 */
export interface Credential {
  bearer_token: string
  user_id: string
  created_at: number
  expires_in?: number
  user_info?: {
    email?: string
    name?: string
  }
  refresh_token?: string
  token_type?: string
  scope?: string
  domain?: string
  session_state?: string
}

/**
 * 凭证轮换状态
 */
export interface RotationState {
  currentIndex: number
  usageCount: number
  lastSaved: number
  manualSelectedIndex?: number
  autoRotationEnabled: boolean
}

/**
 * OpenAI 格式的消息
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentBlock[]
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

/**
 * 内容块（支持结构化内容）
 */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, any>
}

export interface ToolResultBlock {
  type: 'tool_result'
  toolUseId: string
  content: string
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

/**
 * CodeBuddy 格式的消息
 */
export interface CodeBuddyMessage {
  role: string
  content: string | ContentBlock[]
}

/**
 * OpenAI 聊天完成请求
 */
export interface ChatCompletionRequest {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  tools?: any[]
}

/**
 * OpenAI 聊天完成响应
 */
export interface ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: {
    index: number
    message: {
      role: string
      content: string
      tool_calls?: ToolCall[]
    }
    finish_reason: string
    logprobs: null
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  system_fingerprint?: string
}

/**
 * SSE 数据块
 */
export interface SSEChunk {
  id?: string
  object?: string
  created?: number
  model?: string
  choices?: {
    index: number
    delta: {
      role?: string
      content?: string
      tool_calls?: ToolCall[]
    }
    finish_reason?: string | null
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  system_fingerprint?: string
}
