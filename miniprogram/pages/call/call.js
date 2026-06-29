// miniprogram/pages/call/call.js
const app = getApp()

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return m + ':' + s
}

const MOCK_QUESTIONS = [
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

Page({
  data: {
    recording: false,
    hasRecording: false,
    statusText: '待机中，点击开始',
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
  mockTimer: null,

  onLoad() {
    this.recorderManager = wx.getRecorderManager()
    this.recorderManager.onStop((res) => {
      this.currentTempFile = res.tempFilePath
      if (this.data.recording) this.startRecorder()
    })
    this.recorderManager.onError(() => {})
  },

  onUnload() { this.stopAll() },

  toggleRecording() {
    if (this.data.recording) {
      this.stopAll()
    } else {
      this.startSession()
    }
  },

  startSession() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.setData({ recording: true, statusText: '同传中 — 8秒后显示模拟问题' })
        this.startRecorder()
        this.startTimer()
        this.startMockQA()
      },
      fail: () => {
        wx.showModal({ title: '需要麦克风权限', content: '请在设置中开启麦克风权限', confirmText: '去设置', success: (r) => { if (r.confirm) wx.openSetting() } })
      }
    })
  },

  startRecorder() {
    this.recorderManager.start({ duration: 8000, sampleRate: 16000, numberOfChannels: 1, format: 'mp3' })
  },

  // ===== 核心：每8秒触发一次模拟提问 =====
  startMockQA() {
    var that = this
    var qIndex = 0

    // 先立即显示第一条
    that.showOneQuestion(qIndex)
    qIndex++

    // 每8秒显示下一条
    that.mockTimer = setInterval(function () {
      if (!that.data.recording) {
        clearInterval(that.mockTimer)
        that.mockTimer = null
        return
      }
      that.showOneQuestion(qIndex % MOCK_QUESTIONS.length)
      qIndex++
    }, 8000)
  },

  showOneQuestion(idx) {
    var q = MOCK_QUESTIONS[idx]
    var msgId = this.data.msgIdCounter + 1
    this.setData({ msgIdCounter: msgId })

    var newMsg = {
      id: msgId,
      role: 'other',
      original: q.text,
      translated: q.translated
    }

    var msgs = this.data.messages.concat([newMsg])
    this.setData({
      messages: msgs,
      scrollToView: 'msg-' + msgId,
      statusText: '同传中'
    })

    // 生成AI参考回答
    this.requestAnswer(q.text)
  },

  requestAnswer(question) {
    if (this.data.answerLoading) return
    this.setData({ answerLoading: true, currentAnswer: '' })

    var that = this
    var httpUrl = (app.globalData && app.globalData.httpUrl) || 'https://interpret-app.onrender.com'

    wx.request({
      url: httpUrl + '/api/answer',
      method: 'POST',
      data: { question: question },
      timeout: 8000,
      success: function (res) {
        if (res.data && res.data.answer) {
          that.setData({ currentAnswer: res.data.answer, answerLoading: false })
        } else {
          that.setData({ currentAnswer: that.getFallbackAnswer(question), answerLoading: false })
        }
      },
      fail: function () {
        that.setData({ currentAnswer: that.getFallbackAnswer(question), answerLoading: false })
      }
    })
  },

  getFallbackAnswer: function (question) {
    var q = (question || '').toLowerCase()
    if (q.indexOf('introduce') >= 0 || q.indexOf('yourself') >= 0) {
      return 'I have a strong background in this field with several years of experience.\n\n• I specialize in [your key skill], having worked on multiple projects\n• I\'m passionate about solving complex problems and delivering results\n• I\'m excited about this opportunity to contribute to your team'
    }
    if (q.indexOf('strength') >= 0) {
      return 'My greatest strengths are:\n\n• Problem-solving ability — I enjoy breaking down complex challenges\n• Adaptability — I learn quickly and adjust to new situations\n• Teamwork — I collaborate effectively with diverse teams'
    }
    if (q.indexOf('weakness') >= 0) {
      return 'I sometimes focus too much on details, but I\'ve learned to:\n\n• Set clear priorities and deadlines\n• Use checklists to ensure efficiency\n• Trust team members with appropriate tasks'
    }
    if (q.indexOf('why') >= 0 && q.indexOf('company') >= 0) {
      return 'I\'m drawn to your company because:\n\n• Your innovative approach aligns with my career goals\n• I admire your company culture and core values\n• I see great potential to contribute and grow here'
    }
    if (q.indexOf('project') >= 0 || q.indexOf('challenge') >= 0 || q.indexOf('experience') >= 0) {
      return 'Let me share a relevant experience using the STAR method:\n\n• Situation: I worked on a challenging project that required [skill]\n• Task: My goal was to [objective within timeline]\n• Action: I took initiative by [specific action I led]\n• Result: We achieved [positive measurable outcome]'
    }
    if (q.indexOf('five years') >= 0 || q.indexOf('future') >= 0) {
      return 'In five years, I see myself:\n\n• Growing professionally in this field with increased expertise\n• Taking on more leadership responsibilities in [area]\n• Making meaningful impact on the team and company goals'
    }
    if (q.indexOf('salary') >= 0 || q.indexOf('expect') >= 0) {
      return 'Based on my research and experience level:\n\n• I\'m looking for a competitive package in the range of [your range]\n• But I\'m more interested in the role and growth opportunities\n• I\'m open to discussion based on the total compensation'
    }
    if (q.indexOf('question') >= 0 || q.indexOf('ask') >= 0) {
      return 'Yes, I do have a few questions:\n\n• What does a typical day look like for this role?\n• How does the team collaborate on projects?\n• What are the next steps in the interview process?'
    }
    if (q.indexOf('hire') >= 0 || q.indexOf('why you') >= 0) {
      return 'You should hire me because:\n\n• I have the right skills and experience for this role\n• I\'m a quick learner who adapts well to new challenges\n• I\'m genuinely excited about this opportunity and committed to delivering results'
    }
    return 'That\'s a great question! Let me answer:\n\n• Based on my understanding, the key point is [main idea]\n• In my experience, [relevant insight or example]\n• I\'m confident I can contribute effectively to this area'
  },

  copyAnswer() {
    if (!this.data.currentAnswer) return
    wx.setClipboardData({ data: this.data.currentAnswer, success: function () { wx.showToast({ title: '已复制', icon: 'success' }) } })
  },

  dismissAnswer() { this.setData({ currentAnswer: '' }) },

  startTimer() {
    this.setData({ duration: 0, formatTime: '00:00' })
    var that = this
    that.timer = setInterval(function () {
      var d = that.data.duration + 1
      that.setData({ duration: d, formatTime: formatDuration(d) })
    }, 1000)
  },

  stopAll() {
    if (this.recorderManager) this.recorderManager.stop()
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    if (this.mockTimer) { clearInterval(this.mockTimer); this.mockTimer = null }
    this.setData({ recording: false, statusText: '已停止', hasRecording: this.data.audioPaths.length > 0 })
  },

  saveRecording() {
    var ts = new Date().getTime()
    var transcript = this.data.messages.map(function (m) {
      var role = m.role === 'other' ? '对方' : '我'
      return '[' + role + ']\n' + m.original + '\n' + (m.translated ? '中文：' + m.translated : '')
    }).join('\n\n---\n\n')
    try {
      wx.setStorageSync('transcript_' + ts, transcript)
      wx.showToast({ title: '文字记录已保存', icon: 'success' })
    } catch (e) { wx.showToast({ title: '保存失败', icon: 'none' }) }
  },

  clearMessages() {
    var that = this
    wx.showModal({ title: '确认清空', content: '确定要清空所有记录吗？', success: function (res) { if (res.confirm) that.setData({ messages: [], currentAnswer: '', msgIdCounter: 0 }) } })
  }
})
