// server.js - 主入口
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const http = require('http')
const { WebSocketServer } = require('ws')
const path = require('path')

const config = require('./config')
const { handleInterpretSession } = require('./routes/interpret')

const app = express()
const server = http.createServer(app)

// 中间件
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// ============ WebSocket 服务 ============
const wss = new WebSocketServer({ server, path: '/ws/interpret' })

wss.on('connection', (ws, req) => {
  console.log(`[WS] 新连接 ${req.socket.remoteAddress}`)
  handleInterpretSession(ws)
})

// ============ 启动服务 ============
const PORT = config.port || 3000
server.listen(PORT, () => {
  console.log('========================================')
  console.log(`  面试同传助手后端服务已启动`)
  console.log(`  HTTP:  http://localhost:${PORT}`)
  console.log(`  WS:    ws://localhost:${PORT}/ws/interpret`)
  console.log('========================================')
  console.log(`  ASR 服务商:  ${config.asr.provider}`)
  console.log(`  翻译服务商: ${config.translate.provider}`)
  console.log(`  LLM 服务商: ${config.llm.provider}`)
  console.log('========================================')
})
