import type { Env, Credential, RotationState } from '../types'

/**
 * 凭证管理器
 * 负责从 KV 加载凭证、轮换、过期检查
 * 优化写入频率以符合 Cloudflare KV 免费限额
 */
export class CredentialManager {
  private env: Env
  private credentials: Credential[] = []
  private rotationState: RotationState = {
    currentIndex: 0,
    usageCount: 0,
    lastSaved: 0,
    autoRotationEnabled: true
  }
  private initialized = false
  private saveThreshold = 100 // 每 100 次请求才写入一次 KV

  constructor(env: Env) {
    this.env = env
  }

  /**
   * 初始化：从 KV 加载所有凭证和轮换状态
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // 加载所有凭证
    await this.loadAllCredentials()

    // 加载轮换状态
    await this.loadRotationState()

    this.initialized = true
  }

  /**
   * 从 KV 加载所有凭证
   */
  private async loadAllCredentials(): Promise<void> {
    try {
      const list = await this.env.CREDENTIALS_KV.list({ prefix: 'cred:' })
      const credentials: Credential[] = []

      for (const key of list.keys) {
        const value = await this.env.CREDENTIALS_KV.get(key.name, 'json')
        if (value && typeof value === 'object' && 'bearer_token' in value) {
          credentials.push(value as Credential)
        }
      }

      this.credentials = credentials
      console.log(`Loaded ${credentials.length} credentials from KV`)
    } catch (error) {
      console.error('Failed to load credentials:', error)
      this.credentials = []
    }
  }

  /**
   * 从 KV 加载轮换状态
   */
  private async loadRotationState(): Promise<void> {
    try {
      const state = await this.env.CREDENTIALS_KV.get('rotation_state', 'json')
      if (state && typeof state === 'object') {
        this.rotationState = {
          currentIndex: (state as any).currentIndex || 0,
          usageCount: (state as any).usageCount || 0,
          lastSaved: (state as any).lastSaved || 0,
          manualSelectedIndex: (state as any).manualSelectedIndex,
          autoRotationEnabled: (state as any).autoRotationEnabled !== false
        }
        console.log('Loaded rotation state from KV')
      }
    } catch (error) {
      console.error('Failed to load rotation state:', error)
    }
  }

  /**
   * 保存轮换状态到 KV（优化写入频率）
   */
  private async saveRotationState(force = false): Promise<void> {
    const now = Date.now()
    const timeSinceLastSave = now - this.rotationState.lastSaved

    // 只在以下情况写入：
    // 1. 强制保存（手动选择、切换自动轮换等）
    // 2. 使用次数达到阈值
    // 3. 距离上次保存超过 1 小时
    if (
      force ||
      this.rotationState.usageCount % this.saveThreshold === 0 ||
      timeSinceLastSave > 3600000
    ) {
      try {
        this.rotationState.lastSaved = now
        await this.env.CREDENTIALS_KV.put('rotation_state', JSON.stringify(this.rotationState))
        console.log('Saved rotation state to KV')
      } catch (error) {
        console.error('Failed to save rotation state:', error)
      }
    }
  }

  /**
   * 检查 token 是否过期
   */
  private isTokenExpired(credential: Credential): boolean {
    try {
      const createdAt = credential.created_at
      const expiresIn = credential.expires_in

      if (!createdAt || !expiresIn) {
        return false // 没有过期信息，假设未过期
      }

      const currentTime = Math.floor(Date.now() / 1000)
      const expiryTime = createdAt + expiresIn
      const bufferTime = 300 // 提前 5 分钟认为过期

      return currentTime >= expiryTime - bufferTime
    } catch {
      return false
    }
  }

  /**
   * 获取下一个可用的凭证
   */
  async getNextCredential(): Promise<Credential | null> {
    await this.initialize()

    if (this.credentials.length === 0) {
      return null
    }

    // 过滤掉过期的凭证
    const validCredentials = this.credentials
      .map((cred, index) => ({ cred, index }))
      .filter(({ cred }) => !this.isTokenExpired(cred))

    if (validCredentials.length === 0) {
      console.error('No valid (non-expired) credentials available')
      return null
    }

    const validIndices = validCredentials.map(v => v.index)

    // 如果当前索引无效，重置到第一个有效凭证
    if (!validIndices.includes(this.rotationState.currentIndex)) {
      this.rotationState.currentIndex = validIndices[0]
      this.rotationState.usageCount = 0
    }

    const rotationCount = parseInt(this.env.ROTATION_COUNT || '1', 10)

    // 如果有手动选择的凭证，优先使用
    if (
      this.rotationState.manualSelectedIndex !== undefined &&
      this.rotationState.manualSelectedIndex >= 0 &&
      this.rotationState.manualSelectedIndex < this.credentials.length
    ) {
      const manualCred = this.credentials[this.rotationState.manualSelectedIndex]
      if (!this.isTokenExpired(manualCred)) {
        return manualCred
      } else {
        console.warn('Manually selected credential is expired, falling back to automatic rotation')
        this.rotationState.manualSelectedIndex = undefined
        await this.saveRotationState(true)
      }
    }

    // 检查是否需要轮换
    const shouldRotate = this.rotationState.autoRotationEnabled && rotationCount > 0

    if (!shouldRotate) {
      // 不轮换：固定使用当前凭证
      return this.credentials[this.rotationState.currentIndex]
    }

    // 自动轮换逻辑
    if (this.rotationState.usageCount >= rotationCount) {
      // 轮换到下一个有效凭证
      const currentValidPosition = validIndices.indexOf(this.rotationState.currentIndex)
      const nextValidPosition = (currentValidPosition + 1) % validIndices.length
      this.rotationState.currentIndex = validIndices[nextValidPosition]
      this.rotationState.usageCount = 0
      console.log('Credential rotation triggered')
    }

    const credential = this.credentials[this.rotationState.currentIndex]
    this.rotationState.usageCount++

    // 异步保存状态（不阻塞请求）
    this.saveRotationState().catch(err => console.error('Failed to save rotation state:', err))

    return credential
  }

  /**
   * 获取所有凭证
   */
  async getAllCredentials(): Promise<Credential[]> {
    await this.initialize()
    return this.credentials
  }

  /**
   * 获取凭证详细信息
   */
  async getCredentialsInfo(): Promise<any[]> {
    await this.initialize()

    return this.credentials.map((cred, index) => {
      const isExpired = this.isTokenExpired(cred)
      let expiresAt: number | null = null
      let timeRemaining: number | null = null

      if (cred.created_at && cred.expires_in) {
        expiresAt = cred.created_at + cred.expires_in
        timeRemaining = expiresAt - Math.floor(Date.now() / 1000)
      }

      return {
        index,
        user_id: cred.user_id || 'unknown',
        email: cred.user_info?.email || cred.user_id,
        name: cred.user_info?.name,
        created_at: cred.created_at,
        expires_in: cred.expires_in,
        expires_at: expiresAt,
        time_remaining: timeRemaining,
        is_expired: isExpired,
        token_type: cred.token_type || 'Bearer',
        has_refresh_token: !!cred.refresh_token
      }
    })
  }

  /**
   * 添加新凭证
   */
  async addCredential(credential: Credential): Promise<boolean> {
    try {
      const userId = credential.user_id || 'unknown'
      const timestamp = credential.created_at || Math.floor(Date.now() / 1000)
      const safeUserId = userId.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 20)
      const key = `cred:${safeUserId}_${timestamp}`

      await this.env.CREDENTIALS_KV.put(key, JSON.stringify(credential))
      console.log(`Added new credential: ${key}`)

      // 重新加载凭证列表
      await this.loadAllCredentials()
      return true
    } catch (error) {
      console.error('Failed to add credential:', error)
      return false
    }
  }

  /**
   * 删除凭证
   */
  async deleteCredential(index: number): Promise<boolean> {
    await this.initialize()

    if (index < 0 || index >= this.credentials.length) {
      return false
    }

    try {
      // 找到对应的 KV key
      const list = await this.env.CREDENTIALS_KV.list({ prefix: 'cred:' })
      if (index < list.keys.length) {
        await this.env.CREDENTIALS_KV.delete(list.keys[index].name)
        console.log(`Deleted credential at index ${index}`)

        // 重新加载凭证列表
        await this.loadAllCredentials()

        // 清理手动选择
        if (this.rotationState.manualSelectedIndex === index) {
          this.rotationState.manualSelectedIndex = undefined
          await this.saveRotationState(true)
        }

        return true
      }
      return false
    } catch (error) {
      console.error('Failed to delete credential:', error)
      return false
    }
  }

  /**
   * 手动选择凭证
   */
  async setManualCredential(index: number): Promise<boolean> {
    await this.initialize()

    if (index >= 0 && index < this.credentials.length) {
      this.rotationState.manualSelectedIndex = index
      this.rotationState.currentIndex = index
      await this.saveRotationState(true)
      console.log(`Manually selected credential at index ${index}`)
      return true
    }
    return false
  }

  /**
   * 清除手动选择
   */
  async clearManualSelection(): Promise<void> {
    this.rotationState.manualSelectedIndex = undefined
    await this.saveRotationState(true)
    console.log('Cleared manual credential selection')
  }

  /**
   * 切换自动轮换
   */
  async toggleAutoRotation(): Promise<boolean> {
    this.rotationState.autoRotationEnabled = !this.rotationState.autoRotationEnabled
    await this.saveRotationState(true)
    console.log(`Auto rotation toggled: ${this.rotationState.autoRotationEnabled}`)
    return this.rotationState.autoRotationEnabled
  }

  /**
   * 获取当前凭证信息
   */
  async getCurrentCredentialInfo(): Promise<any> {
    await this.initialize()

    if (this.credentials.length === 0) {
      return { status: 'no_credentials' }
    }

    const rotationCount = parseInt(this.env.ROTATION_COUNT || '1', 10)

    if (this.rotationState.manualSelectedIndex !== undefined) {
      return {
        status: 'manual_selected',
        index: this.rotationState.manualSelectedIndex,
        user_id: this.credentials[this.rotationState.manualSelectedIndex]?.user_id || 'unknown'
      }
    } else if (!this.rotationState.autoRotationEnabled) {
      return {
        status: 'auto_rotation_disabled',
        index: this.rotationState.currentIndex,
        user_id: this.credentials[this.rotationState.currentIndex]?.user_id || 'unknown',
        rotation_count: rotationCount,
        auto_rotation_enabled: false
      }
    } else if (rotationCount === 0) {
      return {
        status: 'rotation_count_zero',
        index: this.rotationState.currentIndex,
        user_id: this.credentials[this.rotationState.currentIndex]?.user_id || 'unknown',
        rotation_count: rotationCount,
        auto_rotation_enabled: true
      }
    } else {
      return {
        status: 'auto_rotation',
        index: this.rotationState.currentIndex,
        user_id: this.credentials[this.rotationState.currentIndex]?.user_id || 'unknown',
        usage_count: this.rotationState.usageCount,
        rotation_count: rotationCount,
        auto_rotation_enabled: true
      }
    }
  }
}
