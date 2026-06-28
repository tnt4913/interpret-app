// routes/interpret.js - WebSocket 同传会话处理
const { createASRSession } = require('../services/asr')
const { translateText } = require('../services/translate')
const { generateAnswer } = require('../services/llm')

/**
 * 处理一个完整的同传 WebSocket 会话
 * 流程：前端音频帧 → ASR 实时转写 → 翻译 → 返回前端
 *       前端请求回答 → LLM 生成 → 返回前端
 */
function handleInterpretSession(ws) {
  let asrSession = null
  let sessionConfig = { fromLang: 'en', toLang: 'zh' }
  let msgIdCounter = 0
  let currentMsgId = null
  let contextHistory = []  // 上下文历史，用于回答生成

  // 发送 JSON 消息给前端
  function sendToClient(data) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data))
    }
  }

  // ===== 处理接收到的消息 =====
  ws.on('message', async (rawData) => {
    // 尝试解析 JSON（控制消息），如果是二进制则为音频数据
    let isJson = false
    let msg = null

    try {
      const str = rawData.toString()
      if (str.startsWith('{')) {
        msg = JSON.parse(str)
        isJson = true
      }
    } catch (e) {
      // 非 JSON，是二进制音频数据
    }

    if (isJson) {
      // ===== 处理控制消息 =====
      switch (msg.type) {
        case 'init':
          sessionConfig = msg.config || sessionConfig
          console.log('[Session] 初始化配置:', sessionConfig)
          startASR()
          break

        case 'request_answer':
          await handleAnswerRequest(msg.question)
          break

        case 'end':
          console.log('[Session] 客户端请求结束')
          stopSession()
          break
      }
    } else {
      // ===== 二进制音频数据 → 发送到 ASR =====
      if (asrSession) {
        asrSession.sendAudio(rawData)
      }
    }
  })

  // ===== 启动 ASR 会话 =====
  function startASR() {
    asrSession = createASRSession({
      sampleRate: 16000,
      onResult: async (result) => {
        const { text, isFinal } = result

        if (!isFinal) {
          // 中间结果：更新当前消息
          if (!currentMsgId) {
            currentMsgId = ++msgIdCounter
          }

          sendToClient({
            type: 'asr_result',
            data: {
              text: text,
              role: 'other',
              isFinal: false,
              messageId: currentMsgId
            }
          })
        } else {
          // 最终结果
          const msgId = currentMsgId || ++msgIdCounter
          currentMsgId = null

          sendToClient({
            type: 'asr_result',
            data: {
              text: text,
              role: 'other',
              isFinal: true,
              messageId: msgId
            }
          })

          // 异步翻译
          try {
            const translated = await translateText(text, sessionConfig.fromLang, sessionConfig.toLang)
            sendToClient({
              type: 'translation',
              data: {
                messageId: msgId,
                translated: translated
              }
            })

            // 保存上下文
            contextHistory.push({ role: 'interviewer', text })
            if (contextHistory.length > 10) contextHistory.shift()
          } catch (err) {
            console.error('[Session] 翻译失败:', err.message)
          }
        }
      },
      onError: (err) => {
        console.error('[Session] ASR 错误:', err.message)
        sendToClient({
          type: 'error',
          message: '语音识别异常: ' + err.message
        })
      },
      onClose: () => {
        console.log('[Session] ASR 会话关闭')
      }
    })
  }

  // ===== 处理回答请求 =====
  async function handleAnswerRequest(question) {
    console.log('[Session] 请求生成回答:', question.substring(0, 50) + '...')

    const context = contextHistory
      .slice(-5)
      .map(h => `${h.role}: ${h.text}`)
      .join('\n')

    try {
      const answer = await generateAnswer(question, context)
      sendToClient({
        type: 'answer',
        data: { answer: answer }
      })

      // 保存上下文
      contextHistory.push({ role: 'candidate', text: answer })
    } catch (err) {
      console.error('[Session] 回答生成失败:', err.message)
      sendToClient({
        type: 'answer',
        data: { answer: '抱歉，回答生成暂时不可用。请根据翻译内容自行组织回答。' }
      })
    }
  }

  // ===== 停止会话 =====
  function stopSession() {
    if (asrSession) {
      asrSession.stop()
      asrSession = null
    }
  }

  ws.on('close', () => {
    console.log('[Session] WebSocket 关闭，清理资源')
    stopSession()
  })

  ws.on('error', (err) => {
    console.error('[Session] WebSocket 错误:', err.message)
    stopSession()
  })
}

module.exports = { handleInterpretSession }
