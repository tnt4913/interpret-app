# 🎧 面试同声传译助手

> 实时将英文面试翻译为中文，并自动生成英文参考回答的微信小程序

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🎙️ 实时语音识别 | 边说边转写，毫秒级响应 |
| 🌐 中英翻译 | 英文自动翻译为中文，确保完全理解对方意思 |
| 💡 AI 回答生成 | 根据对方问题自动生成简洁有条理的英文参考回答 |
| 💾 全程录音 | 自动录音保存，面试后可回放复盘 |
| 📋 一键复制 | 参考回答可快速复制使用 |

## 📁 项目结构

```
interpret-app/
├── miniprogram/              # 微信小程序前端
│   ├── app.js                # 小程序入口
│   ├── app.json              # 全局配置
│   ├── app.wxss              # 全局样式
│   ├── pages/
│   │   ├── index/            # 首页（功能介绍 + 使用指南）
│   │   │   ├── index.wxml
│   │   │   ├── index.wxss
│   │   │   ├── index.js
│   │   │   └── index.json
│   │   └── call/             # 通话同传页（核心功能）
│   │       ├── call.wxml     # 界面：翻译显示 + AI回答 + 控制栏
│   │       ├── call.wxss     # 暗色主题样式
│   │       ├── call.js       # 录音 + WebSocket + 消息处理
│   │       └── call.json
│   └── sitemap.json
├── server/                   # Node.js 后端服务
│   ├── server.js             # 主入口（Express + WebSocket）
│   ├── package.json
│   ├── .env.example          # 环境变量模板
│   ├── config/
│   │   └── index.js          # 配置管理
│   ├── routes/
│   │   └── interpret.js      # WebSocket 同传会话处理
│   └── services/
│       ├── asr.js            # 语音识别服务（阿里云/腾讯云）
│       ├── translate.js      # 翻译服务（百度/阿里云）
│       └── llm.js            # AI 回答生成（DeepSeek/OpenAI/智谱/Kimi）
└── README.md                 # 本文档
```

## 🚀 快速部署（面试前 30 分钟搞定）

### 第一步：申请 2 个免费 API 密钥（预计 5 分钟）

> 💰 **总费用 ¥0**，全部使用免费方案，详见 [申请指南.md](申请指南.md)

#### 1. AI 回答生成 —— 智谱 GLM-4-Flash（永久免费，不收费！）
- 登录 [智谱开放平台](https://open.bigmodel.cn/)
- 注册后在「API Keys」页面创建 Key
- **永久免费**，无需充值，不扣费

#### 2. 翻译 API —— 百度翻译（每月免费 5 万字）
- 登录 [百度翻译开放平台](https://fanyi-api.baidu.com/)
- 开通「通用翻译 API（标准版）」
- 获取 APP ID 和密钥
- 一场面试约用 2000 字，免费额度完全够用

#### 3.（可选）语音识别 ASR —— 默认模拟模式，无需申请
- 默认 `mock` 模式，不申请 Key 也能看到完整流程
- 如需真实语音识别：[阿里云语音识别](https://nls-portal.console.aliyun.com/)，每月免费 15 小时

### 第二步：部署后端服务（预计 10 分钟）

```bash
# 1. 进入服务端目录
cd server/

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API 密钥

# 4. 启动服务
npm start
# 看到 "面试同传助手后端服务已启动" 即成功
```

#### 部署到云服务器（让小程序能访问）

微信小程序要求后端必须是 HTTPS + WSS，推荐部署方式：

| 平台 | 优势 | 参考费用 |
|------|------|---------|
| [微信云托管](https://cloud.weixin.qq.com/) | 免域名备案，自动 HTTPS | 免费额度 |
| 阿里云轻量服务器 | 稳定可靠 | ¥24/月起 |
| 腾讯云 CloudBase | Serverless，按量计费 | 免费额度 |

**最快方案**：使用微信云托管，无需域名备案，一键部署。

### 第三步：导入小程序到微信开发者工具（预计 5 分钟）

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开后选择「导入项目」
3. 项目目录选择 `interpret-app` 文件夹
4. AppID 填写你的小程序 AppID（或在「测试号」模式下使用）
5. 修改 `miniprogram/app.js` 中的 `serverUrl` 和 `httpUrl` 为你的后端地址

```javascript
// app.js 中修改
globalData: {
  serverUrl: 'wss://你的域名/ws/interpret',  // 注意是 wss://
  httpUrl: 'https://你的域名',
}
```

6. 点击「编译」预览效果
7. 点击「预览」扫码在手机上体验

## 📖 使用方法

### 面试时

1. **接通面试电话**（建议用耳机，手机话筒朝向音源）
2. **打开微信小程序**，点击「🚀 开始同传」
3. **点击「开始」按钮**，授权录音权限
4. 面试官说话时：
   - 屏幕上方实时显示 **英文原文** 和 **中文翻译**
   - 对方说完一个完整问题后，下方自动出现 **英文参考回答**
5. 参考 `💡 参考回答` 区域的英文，组织你的回答
6. 点击「📋 复制」可快速复制参考回答
7. 面试结束后点击「⏹ 结束」，然后「💾 保存」录音

### 收音建议

| 场景 | 建议 |
|------|------|
| 手机通话 | 开启免提，话筒朝向自己，确保能收到对方声音 |
| 电脑视频面试 | 手机放在电脑旁，音量调大 |
| 耳机 | 使用带麦克风的耳机效果最佳 |

## ⚙️ 配置选项

### 切换 AI 服务商

编辑 `server/.env`：

```bash
# 使用 DeepSeek（推荐，便宜好用）
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxx

# 或使用 OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxx

# 或使用智谱 GLM
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=xxxxx
```

### 切换翻译服务

```bash
# 百度翻译（推荐，免费额度大）
TRANSLATE_PROVIDER=baidu
BAIDU_TRANSLATE_APPID=xxxxx
BAIDU_TRANSLATE_KEY=xxxxx

# 阿里云翻译
TRANSLATE_PROVIDER=aliyun
ALIYUN_TRANSLATE_KEY=xxxxx
ALIYUN_TRANSLATE_SECRET=xxxxx
```

## 🔧 开发调试

### 模拟模式

后端支持模拟模式，不配置任何 API 也能运行：
- ASR 模拟模式会自动生成模拟面试问题
- 翻译模拟模式会返回标记原文
- LLM 模拟模式会返回预设回答模板

这样可以先看到完整的交互流程，再逐步接入真实 API。

### 前端调试

在微信开发者工具中：
1. 勾选「不校验合法域名」（设置 → 项目设置）
2. 确保后端服务已启动
3. 使用真机调试获得最佳效果（模拟器无法录音）

## ⚠️ 注意事项

1. **微信小程序录音限制**：单次最长 10 分钟，代码已实现自动续录
2. **网络要求**：实时同传需要稳定网络，建议 WiFi 或 4G+
3. **隐私保护**：录音数据仅在服务端临时处理，不会永久存储
4. **延迟预期**：从说话到翻译显示约 1-3 秒，属正常范围
5. **参考回答使用**：AI 生成的回答仅供参考，请根据实际情况调整后使用

## 🆘 常见问题

**Q: 可以不用后端服务器吗？**
A: 微信小程序的安全限制较多，实时语音识别和 AI 调用需要后端中转。如果不想自己部署，可以使用微信云开发。

**Q: 面试官口音很重怎么办？**
A: 阿里云 ASR 支持多种英语口音识别，可在 ASR 配置中指定口音模型。

**Q: 可以同时翻译我说的中文为英文吗？**
A: 可以。当前架构已支持双向翻译，只需在 ASR 中检测语言并调用中→英翻译即可。可根据需要扩展。

**Q: 费用大概多少？**
A: **¥0**。使用智谱GLM-4-Flash（永久免费）+ 百度翻译（免费5万字/月）+ 模拟ASR（免费），整场面试零成本。如接入阿里云真实ASR，每月也有15小时免费额度。

## 📝 技术栈

- **前端**：微信小程序原生开发
- **后端**：Node.js + Express + WebSocket
- **ASR**：阿里云智能语音交互 / 腾讯云
- **翻译**：百度翻译 / 阿里云翻译
- **AI**：DeepSeek / OpenAI / 智谱 GLM / Moonshot

---

祝面试顺利！💪
