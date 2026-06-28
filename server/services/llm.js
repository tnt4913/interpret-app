// services/llm.js - AI 回答生成服务
// 根据面试官的问题，生成简洁有条理的英文参考回答
const config = require('../config')
const axios = require('axios')

/**
 * 根据面试问题生成参考回答
 * @param {string} question - 面试官的问题（英文）
 * @param {string} context - 上下文（之前的对话，可选）
 * @returns {Promise<string>} 英文参考回答
 */
async function generateAnswer(question, context = '') {
  const provider = config.llm.provider

  try {
    switch (provider) {
      case 'deepseek':
        return await callLLM('deepseek', question, context)
      case 'openai':
        return await callLLM('openai', question, context)
      case 'zhipu':
        return await callLLM('zhipu', question, context)
      case 'moonshot':
        return await callLLM('moonshot', question, context)
      default:
        return await callLLM('deepseek', question, context)
    }
  } catch (err) {
    console.error('[LLM] 生成回答失败:', err.message)
    return getFallbackAnswer(question)
  }
}

// ============ 统一 LLM 调用（OpenAI 兼容格式） ============
async function callLLM(provider, question, context) {
  const providerConfig = config.llm[provider]
  if (!providerConfig || !providerConfig.apiKey) {
    console.warn(`[LLM] ${provider} 未配置 API Key，使用备用回答`)
    return getFallbackAnswer(question)
  }

  const systemPrompt = `You are an expert interview coach helping a candidate in a real-time English interview.

Your task:
- Generate a concise, well-structured English response to the interviewer's question.
- The response should be natural, professional, and easy to speak aloud.
- Keep it under 80 words unless complexity requires more.
- Use bullet points or short paragraphs for clarity.
- Do NOT include any meta-commentary, just the answer itself.

Format:
- If the question asks for introduction/experience: use 2-3 bullet points.
- If the question is behavioral (e.g., "tell me about a time"): use the STAR method briefly.
- If the question is technical: give a direct, accurate answer.
- Always start directly with the answer content.`

  const userPrompt = context
    ? `Previous context: ${context}\n\nInterviewer's question: ${question}\n\nGenerate a reference answer:`
    : `Interviewer's question: ${question}\n\nGenerate a reference answer:`

  const modelMap = {
    deepseek: 'deepseek-chat',
    openai: 'gpt-4o-mini',
    zhipu: 'glm-4-flash',
    moonshot: 'moonshot-v1-8k'
  }

  const res = await axios.post(
    `${providerConfig.baseUrl}/chat/completions`,
    {
      model: modelMap[provider] || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 300,
      stream: false
    },
    {
      headers: {
        'Authorization': `Bearer ${providerConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    }
  )

  return res.data.choices[0].message.content.trim()
}

// ============ 备用回答（当 LLM 不可用时） ============
function getFallbackAnswer(question) {
  const q = question.toLowerCase()

  // 常见面试问题的预设回答
  if (q.includes('introduce') || q.includes('yourself')) {
    return `I have a strong background in this field with several years of experience.

• I specialize in [your key skill], having worked on multiple projects
• I'm passionate about solving complex problems and delivering results
• I'm excited about this opportunity to contribute to your team`
  }

  if (q.includes('strength')) {
    return `My greatest strengths are:

• Problem-solving ability — I enjoy breaking down complex challenges
• Adaptability — I learn quickly and adjust to new situations
• Teamwork — I collaborate effectively with diverse teams`
  }

  if (q.includes('weakness')) {
    return `I sometimes focus too much on details, but I've learned to balance this by:

• Setting clear priorities and deadlines
• Using checklists to ensure efficiency
• Trusting team members with tasks`
  }

  if (q.includes('why') && q.includes('company')) {
    return `I'm drawn to your company because:

• Your innovative approach to [industry/field] aligns with my goals
• I admire your company culture and values
• I see great potential to contribute and grow here`
  }

  if (q.includes('experience') || q.includes('project')) {
    return `Let me share a relevant experience:

• Situation: I worked on a challenging project that required [skill]
• Task: My goal was to [objective]
• Action: I took initiative by [specific action]
• Result: We achieved [positive outcome]`
  }

  if (q.includes('five years') || q.includes('future')) {
    return `In five years, I see myself:

• Growing professionally in this field
• Taking on more leadership responsibilities
• Making a meaningful impact on the team and company`
  }

  // 通用回答模板
  return `That's a great question. Let me address it:

• Based on my understanding, the key point is [main idea]
• In my experience, [relevant insight]
• I'm confident I can contribute effectively to this area`
}

module.exports = { generateAnswer }
