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
    recording: false,
    hasRecording: false,
    statusText: '待机中',
    duration: 0,
    formatTime: '00:00',
    messages: [],
    currentAnswer: '',
    answerLoading: false,
    scrollToView: '',
    msgIdCounter: 0,
    audioPaths: [],
  },

  recorderManager: null,
  timer: null,
  currentTempFile: '',
  uploadInterval: null,

  onLoad() {
    this.initRecorder()
  },

  onUnload() {
    this.stopAll()
  },

  // ===== 初始化录音管理器 =====
  initRecorder() {
    this.recorderManager = wx.getRecorderManager()

    this.recorderManager.onStop((res) => {
      console.log('录音结束:', res)
      this.currentTempFile = res.tempFilePath

      if (this.data.recording) {
        // 如果还在同传状态，重新开始录音
        this.startRecorder()
      }
    })

    this.recorderManager.onError((err) => {
      console.error('录音错误:', err)
      wx.showToast({ title: '录音异常', icon: 'none' })
    })
  },

  // ===== 开始/停止 =====
  toggleRecording() {
    if (this.data.recording) {
      this.stopAll()
    } else {
      this.startSession()
    }
  },

  // ===== 开始同传会话 =====
  startSession() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.setData({
          recording: true,
          statusText: '同传中'
        })

        this.startRecorder()
        this.startTimer()

        // 启动定时上传（每5秒上传一次音频进行识别）
        this.uploadInterval = setInterval(() => {
          if (this.currentTempFile) {
            this.uploadAndRecognize(this.currentTempFile)
            this.currentTempFile = ''
          }
        }, 5000)

        wx.showToast({ title: '同传已启动', icon: 'success' })
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '请开启麦克风权限',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) wx.openSetting()
          }
        })
      }
    })
  },

  // ===== 开始录音 =====
  startRecorder() {
    this.recorderManager.start({
      duration: 5000,           // 每5秒一个片段
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
    })
  },

  // ===== 上传音频并获取识别+翻译+回答 =====
  uploadAndRecognize(filePath) {
    const httpUrl = app.globalData.httpUrl || 'https://interpret-app.onrender.com'

    wx.showLoading({ title: '识别中...', mask: true })

    wx.uploadFile({
      url: httpUrl + '/api/recognize',
      filePath: filePath,
      name: 'audio',
      formData: { role: 'other' },
      header: { 'Content-Type': 'multipart/form-data' },
      success: (res) => {
        wx.hideLoading()

        try {
          const result = JSON.parse(res.data)
          if (result.success && result.text) {
            this.handleRecognitionResult(result)
          } else if (result.error) {
            console.error('识别错误:', result.error)
            // 显示模拟数据用于测试
            this.showMockData()
          }
        } catch (e) {
          console.error('解析失败:', e)
          // 网络问题时显示模拟数据
          this.showMockData()
        }
      },
      fail: () => {
        wx.hideLoading()
        console.warn('上传失败，显示模拟数据')
        // 上传失败时用本地模拟模式
        this.showMockData()
      }
    })
  },

  // ===== 处理识别结果 =====
  handleRecognitionResult(result) {
    const msgId = ++this.data.msgIdCounter
    const messages = this.data.messages

    messages.push({
      id: msgId,
      role: 'other',
      original: result.text,
      translated: result.translated || ''
    })

    this.setData({
      messages: messages,
      scrollToView: 'msg-' + msgId
    })

    // 请求AI回答
    if (result.text.length > 5) {
      this.requestAnswer(result.text)
    }

    // 异步翻译（如果还没有翻译）
    if (!result.translated && result.text) {
      this.translateMessage(msgId, result.text)
    }
  },

  // ===== 显示模拟数据（网络不可用时） =====
  showMockData() {
    const mockQuestions = [
      { text: "Could you please introduce yourself briefly?", translated: "请简单介绍一下你自己。" },
      { text: "What are your greatest strengths?", translated: "你最大的优势是什么？" },
      { text: "Why do you want to work for our company?", translated: "你为什么想加入我们公司？" },
      { text: "Can you describe a challenging project you worked on?", translated: "你能描述一个你做过的有挑战的项目吗？" },
      { text: "Where do you see yourself in five years?", translated: "你五年后的职业规划是什么？" },
    ]

    const mockQ = mockQuestions[this.data.msgIdCounter % mockQuestions.length]
    const msgId = ++this.data.msgIdCounter

    const messages = this.data.messages
    messages.push({
      id: msgId,
      role: 'other',
      original: mockQ.text,
      translated: mockQ.translated
    })

    this.setData({
      messages: messages,
      scrollToView: 'msg-' + msgId
    })

    // 生成AI参考回答
    this.requestAnswer(mockQ.text)

    wx.showToast({ title: '已加载演示内容', icon: 'none' })
  },

  // ===== 翻译消息 =====
  translateMessage(msgId, text) {
    const httpUrl = app.globalData.httpUrl || 'https://interpret-app.onrender.com'

    wx.request({
      url: httpUrl + '/api/translate',
      method: 'POST',
      data: { text: text, from: 'en', to: 'zh' },
      success: (res) => {
        if (res.data && res.data.translated) {
          const messages = this.data.messages
          const target = messages.find(m => m.id === msgId)
          if (target) {
            target.translated = res.data.translated
            this.setData({ messages: messages })
          }
        }
      }
    })
  },

  // ===== 请求AI回答 =====
  requestAnswer(question) {
    if (this.data.answerLoading) return
    this.setData({ answerLoading: true, currentAnswer: '' })

    const httpUrl = app.globalData.httpUrl || 'https://interpret-app.onrender.com'

    wx.request({
      url: httpUrl + '/api/answer',
      method: 'POST',
      data: { question: question },
      success: (res) => {
        if (res.data && res.data.answer) {
          this.setData({
            currentAnswer: res.data.answer,
            answerLoading: false
          })
        } else {
          // 使用内置模板作为备用
          this.setData({
            currentAnswer: this.getFallbackAnswer(question),
            answerLoading: false
          })
        }
      },
      fail: () => {
        this.setData({
          currentAnswer: this.getFallbackAnswer(question),
          answerLoading: false
        })
      }
    })
  },

  // ===== 备用回答模板 =====
  getFallbackAnswer(question) {
    const q = (question || '').toLowerCase()
    if (q.includes('introduce') || q.includes('yourself')) {
      return `I have a strong background in this field with several years of experience.\n\n• I specialize in [your key skill], having worked on multiple projects\n• I'm passionate about solving complex problems and delivering results\n• I'm excited about this opportunity to contribute to your team`
    }
    if (q.includes('strength')) {
      return `My greatest strengths are:\n\n• Problem-solving ability — I enjoy breaking down complex challenges\n• Adaptability — I learn quickly and adjust to new situations\n• Teamwork — I collaborate effectively with diverse teams`
    }
    if (q.includes('weakness')) {
      return `I sometimes focus too much on details, but I've learned to:\n\n• Set clear priorities and deadlines\n• Use checklists to ensure efficiency\n• Trust team members with tasks`
    }
    if (q.includes('why') && q.includes('company')) {
      return `I'm drawn to your company because:\n\n• Your innovative approach aligns with my goals\n• I admire your company culture and values\n• I see great potential to contribute and grow here`
    }
    return `That's a great question! Let me share my thoughts:\n\n• Based on my understanding, the key point is [main idea]\n• In my experience, [relevant insight]\n• I'm confident I can contribute effectively`
  },

  // ===== 复制回答 =====
  copyAnswer() {
    wx.setClipboardData({
      data: this.data.currentAnswer,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  // ===== 关闭回答 =====
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
    if (this.recorderManager) {
      this.recorderManager.stop()
    }
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.uploadInterval) {
      clearInterval(this.uploadInterval)
      this.uploadInterval = null
    }
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
    if (!this.data.hasRecording) {
      wx.showToast({ title: '暂无录音', icon: 'none' })
      return
    }

    const timestamp = new Date().getTime()
    const transcript = this.data.messages.map(m => {
      const role = m.role === 'other' ? '对方' : '我'
      return `[${role}]\n${m.original}\n${m.translated ? '中文：' + m.translated : ''}`
    }).join('\n\n---\n\n')

    try {
      wx.setStorageSync(`transcript_${timestamp}`, transcript)
      wx.showToast({ title: '文字记录已保存', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // ===== 清空消息 =====
  clearMessages() {
    wx.showModal({
      title: '确认清空',
      content: '清空后无法恢复，确定吗？',
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
