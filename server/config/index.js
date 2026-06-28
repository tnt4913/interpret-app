// config/index.js - 配置管理
const env = process.env

const config = {
  port: env.PORT || 3000,
  corsOrigin: env.CORS_ORIGIN || '*',

  // 语音识别配置
  // 默认 mock（模拟模式，无需申请Key即可看到完整流程）
  // 如需真实识别，设为 'aliyun' 并填写下方配置
  asr: {
    provider: env.ASR_PROVIDER || 'mock',
    aliyun: {
      appkey: env.ALIYUN_ASR_APPKEY,
      token: env.ALIYUN_ASR_TOKEN,
      url: env.ALIYUN_ASR_URL || 'wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1'
    },
    tencent: {
      secretId: env.TENCENT_SECRET_ID,
      secretKey: env.TENCENT_SECRET_KEY,
      appid: env.TENCENT_ASR_APPID
    }
  },

  // 翻译配置
  // 默认 baidu（百度翻译，每月免费5万字，注册即送）
  translate: {
    provider: env.TRANSLATE_PROVIDER || 'baidu',
    aliyun: {
      key: env.ALIYUN_TRANSLATE_KEY,
      secret: env.ALIYUN_TRANSLATE_SECRET,
      region: env.ALIYUN_TRANSLATE_REGION || 'cn-hangzhou'
    },
    baidu: {
      appid: env.BAIDU_TRANSLATE_APPID,
      key: env.BAIDU_TRANSLATE_KEY
    }
  },

  // LLM 配置
  // 默认 zhipu（智谱GLM-4-Flash，永久免费，无需充值）
  llm: {
    provider: env.LLM_PROVIDER || 'zhipu',
    deepseek: {
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
    },
    openai: {
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    },
    zhipu: {
      apiKey: env.ZHIPU_API_KEY,
      baseUrl: env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
    },
    moonshot: {
      apiKey: env.MOONSHOT_API_KEY,
      baseUrl: env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'
    }
  }
}

module.exports = config
