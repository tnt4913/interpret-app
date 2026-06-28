// services/asr.js - 语音识别服务
// 支持阿里云、腾讯云实时语音识别
const config = require('../config')
const WebSocket = require('ws')

/**
 * 创建实时语音识别会话
 * @param {Object} options - { sampleRate, onResult, onError, onClose }
 * @returns {Object} 会话控制器 { sendAudio, stop }
 */
function createASRSession(options = {}) {
  const { onResult, onError, onClose, sampleRate = 16000 } = options
  const provider = config.asr.provider

  if (provider === 'mock' || !provider) {
    console.warn('[ASR] 模拟模式：不连接真实ASR，自动生成模拟面试问题用于测试')
    return createMockASR({ onResult, onError, onClose })
  } else if (provider === 'aliyun') {
    return createAliyunASR({ onResult, onError, onClose, sampleRate })
  } else if (provider === 'tencent') {
    return createTencentASR({ onResult, onError, onClose, sampleRate })
  } else {
    console.warn('[ASR] 未知 ASR 服务商:', provider, '，使用模拟模式')
    return createMockASR({ onResult, onError, onClose })
  }
}

// ============ 阿里云实时语音识别 ============
function createAliyunASR({ onResult, onError, onClose, sampleRate }) {
  const { appkey, token, url } = config.asr.aliyun

  if (!appkey || !token) {
    console.warn('[ASR] 阿里云 ASR 未配置完整，使用模拟模式')
    return createMockASR({ onResult, onError, onClose })
  }

  const wsUrl = `${url}?token=${token}`
  const ws = new WebSocket(wsUrl)

  let started = false

  ws.on('open', () => {
    console.log('[ASR] 阿里云 ASR 连接成功')

    // 发送开始识别指令
    const startMsg = {
      header: {
        namespace: 'SpeechTranscriber',
        name: 'StartTranscription',
        appkey: appkey,
        message_id: crypto.randomUUID().replace(/-/g, ''),
        task_id: crypto.randomUUID().replace(/-/g, ''),
        attributes: {}
      },
      payload: {
        format: 'pcm',
        sample_rate: sampleRate,
        enable_intermediate_result: true,
        enable_punctuation_prediction: true,
        enable_inverse_text_normalization: true
      }
    }

    ws.send(JSON.stringify(startMsg))
    started = true
  })

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      const header = msg.header
      const payload = msg.payload || {}

      if (header.name === 'TranscriptionResultChanged') {
        // 中间结果
        onResult({
          text: payload.result,
          isFinal: false
        })
      } else if (header.name === 'TranscriptionCompleted') {
        // 最终结果
        onResult({
          text: payload.result,
          isFinal: true
        })
      } else if (header.name === 'TaskFailed') {
        onError(new Error(payload.message || 'ASR 任务失败'))
      }
    } catch (e) {
      console.error('[ASR] 解析消息失败:', e)
    }
  })

  ws.on('error', (err) => {
    console.error('[ASR] 连接错误:', err)
    onError(err)
  })

  ws.on('close', () => {
    console.log('[ASR] 连接关闭')
    if (onClose) onClose()
  })

  return {
    sendAudio(buffer) {
      if (started && ws.readyState === WebSocket.OPEN) {
        ws.send(buffer)
      }
    },
    stop() {
      if (ws.readyState === WebSocket.OPEN) {
        // 发送停止指令
        ws.send(JSON.stringify({
          header: {
            namespace: 'SpeechTranscriber',
            name: 'StopTranscription',
            appkey: appkey,
            message_id: crypto.randomUUID().replace(/-/g, ''),
            task_id: crypto.randomUUID().replace(/-/g, ''),
            attributes: {}
          },
          payload: {},
          context: {}
        }))
        setTimeout(() => ws.close(), 500)
      }
    }
  }
}

// ============ 腾讯云实时语音识别 ============
function createTencentASR({ onResult, onError, onClose, sampleRate }) {
  // 腾讯云 ASR 需要签名鉴权，这里提供基本框架
  // 实际使用时请参考腾讯云实时语音识别 SDK
  console.warn('[ASR] 腾讯云 ASR 需要额外配置签名，请参考官方 SDK')
  return createMockASR({ onResult, onError, onClose })
}

// ============ 模拟模式（开发测试用） ============
function createMockASR({ onResult, onError }) {
  console.log('[ASR] 模拟模式已启动')

  const mockTexts = [
    'Could you please introduce yourself briefly?',
    'What are your greatest strengths?',
    'Why do you want to work for our company?',
    'Can you describe a challenging project you worked on?',
    'Where do you see yourself in five years?'
  ]

  let textIndex = 0
  let buffer = Buffer.alloc(0)
  let interval = null
  let accumulated = ''

  return {
    sendAudio(bufferData) {
      buffer = Buffer.concat([buffer, bufferData])
      // 累积一定量后模拟返回结果
      if (buffer.length > 32000 && textIndex < mockTexts.length) {
        const text = mockTexts[textIndex]
        accumulated = text.substring(0, Math.ceil(text.length * 0.6))

        onResult({ text: accumulated, isFinal: false })

        setTimeout(() => {
          onResult({ text: text, isFinal: true })
          textIndex++
          accumulated = ''
        }, 1500)

        buffer = Buffer.alloc(0)
      }
    },
    stop() {
      if (interval) clearInterval(interval)
      console.log('[ASR] 模拟模式已停止')
    }
  }
}

module.exports = { createASRSession }
