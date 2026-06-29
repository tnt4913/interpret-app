// pages/call/call.js
const app = getApp()

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
    networkOk: true,  // 网络是否正常
  },

  recorderManager: null,
  timer: null,
  uploadInterval: null,

  onLoad() {
    this.initRecorder()
    this.checkNetwork()
  },

  onUnload() {
    this.stopAll()
  },

  // ===== 检查网络 =====
  checkNetwork() {
    wx.getNetworkType({
      success: (res) => {
        this.setData({ networkOk: res.networkType !== 'none' })
        if (res.networkType === 'none') {
          wx.showToast({ title: '网络不可用，使用本地模式', icon: 'none' })
        }
      }
    })
  },

  // ===== 初始化录音 =====
  initRecorder() {
    this.recorderManager = wx.getRecorderManager()

    this.recorderManager.onStop((res) => {
      this.currentTempFile = res.tempFilePath
      if (this.data.recording) {
        this.startRecorder()
      }
    })

    this.recorderManager.onError((err) => {
      console.error('录音错误:', err)
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

  // ===== 开始 =====
  startSession() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.setData({ recording: true, statusText: '同传中' })
        this.startRecorder()
        this.startTimer()
        this.startMockMode()  // 用模拟模式（不依赖网络）
        wx.showToast({ title: '同传已启动（模拟模式）', icon: 'none' })
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '请开启麦克风权限',
          confirmText: '去设置',
          success: (res) => { if (res.confirm) wx.openSetting() }
        })
      }
    })
  },

  // ===== 模拟模式（不依赖网络，完全本地运行）=====
  startMockMode() {
    const mockQuestions = [
      { text: "Could you please introduce yourself briefly?", translated: "请简单介绍一下你自己。" },
      { text: "What are your greatest strengths?", translated: "你最大的优势是什么？" },
      { text: "Why do you want to work for our company?", translated: "你为什么想加入我们公司？" },
      { text: "Can you describe a challenging project you worked on?", translated: "描述一个你做过的挑战性项目。" },
      { text: "Where do you see yourself in five years?", translated: "你五年后的职业规划是什么？" },
      { text: "Tell me about a time you faced a challenge.", translated: "说说你遇到挑战的一次经历。" },
      { text: "How do you handle stress and pressure?", translated: "你如何应对压力和紧张？" },
      { text: "What is your expected salary range?", translated: "你期望的薪资范围是多少？" },
      { text: "Do you have any questions for us?", translated: "你有什么问题想问我们吗？" },
      { text: "Why should we hire you?", translated: "我们为什么要录用你？" },
    ]

    // 每8秒模拟一次面试官提问
    this.mockInterval = setInterval(() => {
      if (!this.data.recording) {
        clearInterval(this.mockInterval)
        return
      }

      const q = mockQuestions[this.data.msgIdCounter % mockQuestions.length]
      const msgId = ++this.data.msgIdCounter

      const messages = this.data.messages
      messages.push({
        id: msgId,
        role: 'other',
        original: q.text,
        translated: q.translated
      })

      this.setData({
        messages: messages,
        scrollToView: 'msg-' + msgId
      })

      // 生成AI参考回答
      this.requestAnswer(q.text)

    }, 8000)  // 每8秒问一个问题

    // 先立即显示第一个问题
    setTimeout(() => {
      if (this.data.recording) {
        const q = mockQuestions[0]
        const msgId = ++this.data.msgIdCounter
        const messages = this.data.messages
        messages.push({
          id: msgId,
          role: 'other',
          original: q.text,
          translated: q.translated
        })
        this.setData({
          messages: messages,
          scrollToView: 'msg-' + msgId
        })
        this.requestAnswer(q.text)
      }
    }, 1000)
  },

  // ===== 请求AI回答（优先用网络，失败则用本地模板）=====
  requestAnswer(question) {
    if (this.data.answerLoading) return
    this.setData({ answerLoading: true, currentAnswer: '' })

    // 先尝试网络请求
    if (this.data.networkOk) {
      const httpUrl = app.globalData.httpUrl

      wx.request({
        url: httpUrl + '/api/answer',
        method: 'POST',
        data: { question: question },
        timeout: 5000,
        success: (res) => {
          if (res.data && res.data.answer) {
            this.setData({
              currentAnswer: res.data.answer,
              answerLoading: false
            })
          } else {
            this.useFallbackAnswer(question)
          }
        },
        fail: () => {
          console.log('网络请求失败，使用本地模板')
          this.useFallbackAnswer(question)
        }
      })
    } else {
      // 网络不可用，直接用本地模板
      this.useFallbackAnswer(question)
    }
  },

  // ===== 本地回答模板 =====
  useFallbackAnswer(question) {
    this.setData({
      currentAnswer: this.getFallbackAnswer(question),
      answerLoading: false
    })
  },

  getFallbackAnswer(question) {
    const q = (question || '').toLowerCase()
    if (q.includes('introduce') || q.includes('yourself')) {
      return `I have a strong background in this field with several years of experience.\n\n• I specialize in [your key skill], having worked on multiple projects\n• I'm passionate about solving complex problems and delivering results\n• I'm excited about this opportunity to contribute to your team`
    }
    if (q.includes('strength')) {
      return `My greatest strengths are:\n\n• Problem-solving ability — I enjoy breaking down complex challenges\n• Adaptability — I learn quickly and adjust to new situations\n• Teamwork — I collaborate effectively with diverse teams`
    }
    if (q.includes('weakness')) {
      return `I sometimes focus too much on details, but I've learned to:\n\n• Set clear priorities and deadlines\n• Use checklists to ensure efficiency\n• Trust team members with appropriate tasks`
    }
    if (q.includes('why') && q.includes('company')) {
      return `I'm drawn to your company because:\n\n• Your innovative approach aligns with my career goals\n• I admire your company culture and core values\n• I see great potential to contribute and grow here`
    }
    if (q.includes('project') || q.includes('challenge') || q.includes('experience')) {
      return `Let me share a relevant experience using the STAR method:\n\n• Situation: I worked on a challenging project that required [skill]\n• Task: My goal was to [objective within timeline]\n• Action: I took initiative by [specific action I led]\n• Result: We achieved [positive measurable outcome]`
    }
    if (q.includes('five years') || q.includes('future')) {
      return `In five years, I see myself:\n\n• Growing professionally in this field with increased expertise\n• Taking on more leadership responsibilities in [area]\n• Making meaningful impact on the team and company goals`
    }
    if (q.includes('salary') || q.includes('expect')) {
      return `Based on my research and experience level:\n\n• I'm looking for a competitive package in the range of [your range]\n• But I'm more interested in the role and growth opportunities\n• I'm open to discussion based on the total compensation`
    }
    if (q.includes('question') || q.includes('ask')) {
      return `Yes, I do have a few questions:\n\n• What does a typical day look like for this role?\n• How does the team collaborate on projects?\n• What are the next steps in the interview process?`
    }
    if (q.includes('hire') || q.includes('why you')) {
      return `You should hire me because:\n\n• I have the right skills and experience for this role\n• I'm a quick learner who adapts well to new challenges\n• I'm genuinely excited about this opportunity and committed to delivering results`
    }
    return `That's a great question! Let me answer:\n\n• Based on my understanding, the key point is [main idea]\n• In my experience, [relevant insight or example]\n• I'm confident I can contribute effectively to this area`
  },

  // ===== 复制 =====
  copyAnswer() {
    if (!this.data.currentAnswer) return
    wx.setClipboardData({
      data: this.data.currentAnswer,
      success: () => { wx.showToast({ title: '已复制', icon: 'success' }) }
    })
  },

  dismissAnswer() {
    this.setData({ currentAnswer: '' })
  },

  // ===== 计时器 =====
  startTimer() {
    this.setData({ duration: 0, formatTime: '00:00' })
    this.timer = setInterval(() => {
      this.setData({
        duration: this.data.duration + 1,
        formatTime: formatDuration(this.data.duration + 1)
      })
    }, 1000)
  },

  // ===== 停止 =====
  stopAll() {
    if (this.recorderManager) this.recorderManager.stop()
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    if (this.mockInterval) { clearInterval(this.mockInterval); this.mockInterval = null }
    this.setData({
      recording: false,
      statusText: '已停止',
      hasRecording: this.data.audioPaths.length > 0
    })
  },

  // ===== 保存 =====
  saveRecording() {
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

  clearMessages() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ messages: [], currentAnswer: '', msgIdCounter: 0 })
        }
      }
    })
  }
})
