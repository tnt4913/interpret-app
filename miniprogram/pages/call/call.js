// pages/call/call.js
const app = getApp()

// 工具函数：格式化时间
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

Page({
  data: {
    recording: false,          // 是否正在录音同传
    hasRecording: false,       // 是否有已保存的录音
    statusText: '待机中',
    duration: 0,               // 录音时长（秒）
    formatTime: '00:00',
    messages: [],              // 消息列表 [{id, role, original, translated}]
    currentAnswer: '',         // 当前 AI 参考回答
    answerLoading: false,      // 回答生成中
    scrollToView: '',          // 滚动锚点
    msgIdCounter: 0,           // 消息 ID 计数器
    audioPaths: [],            // 录音文件路径列表
  },

  // 全局变量（不写入 data）
  recorderManager: null,
  socketTask: null,
  timer: null,
  currentTempFile: '',
  chunkIndex: 0,

  onLoad() {
    this.initRecorder()
  },

  onUnload() {
    this.stopAll()
  },

  // ===== 初始化录音管理器 =====
  initRecorder() {
    this.recorderManager = wx.getRecorderManager()

    // 录音帧数据回调 —— 实时推送给后端进行语音识别
    this.recorderManager.onFrameRecorded((res) => {
      if (this.socketTask && this.socketTask.readyState === 1) {
        // 将音频帧通过 WebSocket 发送到后端
        this.socketTask.send({
          data: res.frameBuffer,
          fail: (err) => {
            console.error('WebSocket 发送失败:', err)
          }
        })
      }
    })

    // 录音结束回调
    this.recorderManager.onStop((res) => {
      console.log('录音结束:', res)
      this.currentTempFile = res.tempFilePath

      if (this.data.recording) {
        // 如果还在同传状态，说明是分片录音结束，重新开始
        this.startRecorder()
      }
    })

    // 错误处理
    this.recorderManager.onError((err) => {
      console.error('录音错误:', err)
      wx.showToast({ title: '录音异常，请重试', icon: 'none' })
    })
  },

  // ===== 开始/停止录音同传 =====
  toggleRecording() {
    if (this.data.recording) {
      this.stopAll()
    } else {
      this.startSession()
    }
  },

  // ===== 开始一次同传会话 =====
  startSession() {
    // 请求录音权限
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.connectWebSocket()
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '同传功能需要录音权限，请在设置中开启',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) wx.openSetting()
          }
        })
      }
    })
  },

  // ===== 连接 WebSocket =====
  connectWebSocket() {
    wx.showLoading({ title: '连接服务中...' })

    const serverUrl = app.globalData.serverUrl + '/ws/interpret'

    this.socketTask = wx.connectSocket({
      url: serverUrl,
      success: () => {
        console.log('WebSocket 连接中...')
      }
    })

    this.socketTask.onOpen(() => {
      wx.hideLoading()
      console.log('WebSocket 已连接')

      // 发送初始化消息
      this.socketTask.send({
        data: JSON.stringify({
          type: 'init',
          config: {
            fromLang: 'en',    // 源语言：英文
            toLang: 'zh',      // 目标语言：中文
            sampleRate: 16000
          }
        })
      })

      // 开始录音
      this.startRecorder()
      this.startTimer()

      this.setData({
        recording: true,
        statusText: '同传中'
      })
    })

    // 接收后端消息
    this.socketTask.onMessage((res) => {
      try {
        const msg = JSON.parse(res.data)
        this.handleServerMessage(msg)
      } catch (e) {
        console.error('解析消息失败:', e)
      }
    })

    this.socketTask.onError((err) => {
      console.error('WebSocket 错误:', err)
      wx.hideLoading()
      wx.showToast({ title: '连接失败，请检查网络', icon: 'none' })
    })

    this.socketTask.onClose(() => {
      console.log('WebSocket 已关闭')
      this.setData({ statusText: '已断开' })
    })
  },

  // ===== 开始录音（分片模式，持续录制） =====
  startRecorder() {
    this.recorderManager.start({
      duration: 600000,          // 最长 10 分钟（会循环重启）
      sampleRate: 16000,         // 16kHz 采样率
      numberOfChannels: 1,       // 单声道
      encodeBitRate: 48000,      // 编码码率
      format: 'pcm',             // PCM 格式（便于实时流式识别）
      frameSize: 8               // 每帧大小（KB），触发 onFrameRecorded
    })
  },

  // ===== 处理后端返回的消息 =====
  handleServerMessage(msg) {
    switch (msg.type) {
      // 实时识别结果（英文原文）
      case 'asr_result':
        this.handleAsrResult(msg.data)
        break

      // 翻译结果
      case 'translation':
        this.handleTranslation(msg.data)
        break

      // AI 参考回答
      case 'answer':
        this.handleAnswer(msg.data)
        break

      // 错误
      case 'error':
        console.error('服务端错误:', msg.message)
        wx.showToast({ title: msg.message || '服务异常', icon: 'none' })
        break
    }
  },

  // ===== 处理语音识别结果 =====
  handleAsrResult(data) {
    const { text, role, isFinal, messageId } = data
    const messages = this.data.messages

    // 尝试找到已有消息（流式识别会不断更新同一条消息）
    let existing = messages.find(m => m.id === messageId)

    if (existing) {
      // 更新已有消息
      existing.original = text
    } else {
      // 新消息
      const newMsg = {
        id: messageId || ++this.data.msgIdCounter,
        role: role || 'other',   // 默认为对方发言
        original: text,
        translated: ''
      }
      messages.push(newMsg)
    }

    this.setData({
      messages: messages,
      scrollToView: 'msg-' + (messages[messages.length - 1].id)
    })

    // 如果是完整句子，请求生成参考回答（仅对对方的问题）
    if (isFinal && (role === 'other' || !role) && text.length > 5) {
      this.requestAnswer(text)
    }
  },

  // ===== 处理翻译结果 =====
  handleTranslation(data) {
    const { messageId, translated } = data
    const messages = this.data.messages
    const target = messages.find(m => m.id === messageId)

    if (target) {
      target.translated = translated
      this.setData({ messages: messages })
    }
  },

  // ===== 处理 AI 回答 =====
  handleAnswer(data) {
    this.setData({
      currentAnswer: data.answer,
      answerLoading: false
    })
  },

  // ===== 请求 AI 生成参考回答 =====
  requestAnswer(question) {
    if (this.data.answerLoading) return

    this.setData({ answerLoading: true })

    // 通过 WebSocket 请求回答
    if (this.socketTask && this.socketTask.readyState === 1) {
      this.socketTask.send({
        data: JSON.stringify({
          type: 'request_answer',
          question: question
        })
      })
    }
  },

  // ===== 复制参考回答 =====
  copyAnswer() {
    wx.setClipboardData({
      data: this.data.currentAnswer,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
      }
    })
  },

  // ===== 关闭参考回答 =====
  dismissAnswer() {
    this.setData({ currentAnswer: '' })
  },

  // ===== 计时器 =====
  startTimer() {
    this.setData({ duration: 0, formatTime: '00:00' })
    this.timer = setInterval(() => {
      const dur = this.data.duration + 1
      this.setData({
        duration: dur,
        formatTime: formatDuration(dur)
      })
    }, 1000)
  },

  // ===== 停止所有 =====
  stopAll() {
    // 停止录音
    if (this.recorderManager) {
      this.recorderManager.stop()
    }

    // 停止计时
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    // 关闭 WebSocket
    if (this.socketTask) {
      this.socketTask.send({
        data: JSON.stringify({ type: 'end' })
      })
      this.socketTask.close()
      this.socketTask = null
    }

    // 保存录音路径
    if (this.currentTempFile) {
      const paths = this.data.audioPaths
      paths.push(this.currentTempFile)
      this.currentTempFile = ''
    }

    this.setData({
      recording: false,
      statusText: '已停止',
      hasRecording: this.data.audioPaths.length > 0
    })
  },

  // ===== 保存录音 =====
  saveRecording() {
    if (this.data.audioPaths.length === 0) {
      wx.showToast({ title: '暂无录音', icon: 'none' })
      return
    }

    // 将录音文件保存到本地
    const timestamp = new Date().getTime()
    const savePath = `${wx.env.USER_DATA_PATH}/interview_${timestamp}.pcm`

    wx.saveFile({
      tempFilePath: this.data.audioPaths[0],
      filePath: savePath,
      success: () => {
        wx.showToast({ title: '录音已保存', icon: 'success' })
        this.setData({ hasRecording: true })
      },
      fail: () => {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    })

    // 同时保存文字记录
    const transcript = this.data.messages.map(m => {
      const role = m.role === 'other' ? '对方' : '我'
      return `[${role}]\n${m.original}\n${m.translated ? '中文：' + m.translated : ''}`
    }).join('\n\n---\n\n')

    wx.setStorageSync(`transcript_${timestamp}`, transcript)
  },

  // ===== 清空消息 =====
  clearMessages() {
    wx.showModal({
      title: '确认清空',
      content: '清空后无法恢复，确定要清空所有翻译记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            messages: [],
            currentAnswer: '',
            msgIdCounter: 0
          })
        }
      }
    })
  }
})
