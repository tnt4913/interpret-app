// server.js - 主入口（支持 HTTP API 模式）
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const http = require('http')
const path = require('path')

const config = require('./config')
const { translateText } = require('./services/translate')
const { generateAnswer } = require('./services/llm')

const app = express()
const server = http.createServer(app)

// 中间件
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// ============ HTTP API 接口 ============

/**
 * POST /api/recognize
 * 上传音频文件，返回识别结果+翻译+回答
 */
app.post('/api/recognize', async (req, res) => {
  try {
    // 由于是 HTTP 模式，我们无法直接处理实时音频流
    // 返回模拟的面试问题用于演示
    const mockQuestions = [
      { text: "Could you please introduce yourself briefly?", translated: "请简单介绍一下你自己。" },
      { text: "What are your greatest strengths?", translated: "你最大的优势是什么？" },
      { text: "Why do you want to work for our company?", translated: "你为什么想加入我们公司？" },
      { text: "Can you describe a challenging project you worked on?", translated: "你能描述一个你做过的有挑战的项目吗？" },
      { text: "Where do you see yourself in five years?", translated: "你五年后的职业规划是什么？" },
      { text: "Tell me about a time when you faced a challenge.", translated: "说说你遇到挑战的一次经历。" },
      { text: "How do you handle stress and pressure?", translated: "你如何处理压力？" },
      { text: "What is your expected salary range?", translated: "你期望的薪资范围是多少？" },
    ]

    // 随机返回一个模拟问题（实际ASR需要真实音频流）
    const randomQ = mockQuestions[Math.floor(Math.random() * mockQuestions.length)]

    // 尝试翻译
    let translated = ''
    try {
      translated = await translateText(randomQ.text, 'en', 'zh')
    } catch (e) {
      translated = randomQ.translated  // 使用预设翻译
    }

    res.json({
      success: true,
      text: randomQ.text,
      translated: translated,
      role: 'other'
    })

  } catch (err) {
    console.error('[API] recognize 错误:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/translate
 * 翻译文本
 */
app.post('/api/translate', async (req, res) => {
  try {
    const { text, from = 'en', to = 'zh' } = req.body

    if (!text) {
      return res.status(400).json({ error: '缺少文本参数' })
    }

    const translated = await translateText(text, from, to)
    res.json({ success: true, translated })

  } catch (err) {
    console.error('[API] translate 错误:', err.message)
    res.status(500).json({ error: err.message, translated: text })
  }
})

/**
 * POST /api/answer
 * 根据问题生成AI参考回答
 */
app.post('/api/answer', async (req, res) => {
  try {
    const { question } = req.body

    if (!question || question.length < 3) {
      return res.status(400).json({ error: '缺少有效的问题' })
    }

    console.log('[API] 生成回答:', question.substring(0, 50))
    const answer = await generateAnswer(question)

    res.json({ success: true, answer })

  } catch (err) {
    console.error('[API] answer 错误:', err.message)
    res.status(500).json({
      error: err.message,
      answer: getFallbackAnswer(question)
    })
  }
})

function getFallbackAnswer(question) {
  const q = (question || '').toLowerCase()
  if (q.includes('introduce') || q.includes('yourself')) {
    return `I have a strong background in this field with several years of experience.\n\n• I specialize in [your key skill], having worked on multiple projects\n• I'm passionate about solving complex problems and delivering results`
  }
  if (q.includes('strength')) {
    return `My greatest strengths are:\n\n• Problem-solving ability — I enjoy breaking down complex challenges\n• Adaptability — I learn quickly and adjust to new situations`
  }
  if (q.includes('weakness')) {
    return `I sometimes focus too much on details, but I've learned to:\n\n• Set clear priorities and deadlines\n• Use checklists to ensure efficiency`
  }
  if (q.includes('why') && q.includes('company')) {
    return `I'm drawn to your company because:\n\n• Your innovative approach aligns with my goals\n• I admire your company culture and values`
  }
  if (q.includes('experience') || q.includes('project')) {
    return `Let me share a relevant experience:\n\n• Situation: I worked on a challenging project that required [skill]\n• Task: My goal was to [objective]\n• Action: I took initiative by [specific action]\n• Result: We achieved [positive outcome]`
  }
  return `That's a great question! Let me share:\n\n• Based on my understanding, the key point is [main idea]\n• In my experience, [relevant insight]\n• I'm confident I can contribute effectively`
}

// 首页路由
app.get('/', (req, res) => {
  res.json({ service: '面试同传助手后端', status: 'running' })
})

// ============ 启动服务 ============
const PORT = config.port || 3000
server.listen(PORT, () => {
  console.log('========================================')
  console.log(`  面试同传助手后端服务已启动`)
  console.log(`  HTTP:  http://localhost:${PORT}`)
  console.log(`  API:   http://localhost:${PORT}/health`)
  console.log('========================================')
})
