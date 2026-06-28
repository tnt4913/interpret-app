// services/translate.js - 翻译服务
// 支持阿里云、百度等翻译 API
const config = require('../config')
const axios = require('axios')
const crypto = require('crypto')

/**
 * 翻译文本（英→中 或 中→英自动检测）
 * @param {string} text - 待翻译文本
 * @param {string} from - 源语言（en/zh/auto）
 * @param {string} to - 目标语言（en/zh）
 * @returns {Promise<string>} 翻译结果
 */
async function translateText(text, from = 'en', to = 'zh') {
  if (!text || text.trim().length === 0) return ''

  const provider = config.translate.provider

  try {
    switch (provider) {
      case 'baidu':
        return await translateByBaidu(text, from, to)
      case 'aliyun':
        return await translateByAliyun(text, from, to)
      default:
        return await translateByBaidu(text, from, to)
    }
  } catch (err) {
    console.error('[翻译] 错误:', err.message)
    return text  // 翻译失败时返回原文
  }
}

// ============ 百度翻译（推荐，免费额度大） ============
async function translateByBaidu(text, from, to) {
  const { appid, key } = config.translate.baidu

  if (!appid || !key) {
    console.warn('[翻译] 百度翻译未配置，返回原文')
    return `[未配置翻译] ${text}`
  }

  const salt = Date.now().toString()
  const sign = crypto.createHash('md5').update(appid + text + salt + key).digest('hex')

  const url = 'https://fanyi-api.baidu.com/api/trans/vip/translate'
  const params = {
    q: text,
    from: from === 'en' ? 'en' : (from === 'zh' ? 'zh' : 'auto'),
    to: to === 'zh' ? 'zh' : 'en',
    appid: appid,
    salt: salt,
    sign: sign
  }

  const res = await axios.get(url, { params, timeout: 5000 })
  const result = res.data

  if (result.error_code) {
    throw new Error(`百度翻译错误: ${result.error_code} ${result.error_msg}`)
  }

  // 拼接多段翻译结果
  return (result.trans_result || []).map(item => item.dst).join('\n')
}

// ============ 阿里云翻译 ============
async function translateByAliyun(text, from, to) {
  const { key, secret, region } = config.translate.aliyun

  if (!key || !secret) {
    console.warn('[翻译] 阿里云翻译未配置，返回原文')
    return `[未配置翻译] ${text}`
  }

  // 阿里云机器翻译通用 API
  // 详见: https://help.aliyun.com/document_detail/158266.html
  const endpoint = `https://mt.${region}.aliyuncs.com`

  // 这里使用 HTTP 调用方式，实际部署时可根据阿里云 SDK 调整
  const params = {
    FormatType: 'text',
    SourceLanguage: from,
    TargetLanguage: to,
    SourceText: text,
    Scene: 'general'
  }

  // 简化签名过程，实际使用建议引入 @alicloud/openapi-client
  const res = await axios.post(`${endpoint}/api/translate/general`, params, {
    headers: {
      'Authorization': `APPCODE ${key}`
    },
    timeout: 5000
  })

  return res.data.Data?.Translated || text
}

module.exports = { translateText }
