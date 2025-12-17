'use server'

import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export type CorrectionSuggestion = {
    target_substring: string
    candidates: string[]
    reason: string
}

export type CorrectionSegment = {
    original_text: string
    suggestions: CorrectionSuggestion[]
}

export type CorrectionResult = {
    segments: CorrectionSegment[]
}

export async function correctText(fullText: string): Promise<CorrectionResult | { error: string }> {
    if (!fullText.trim()) {
        return { error: 'Empty text provided' }
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-5.2', // Using GPT-5.2 as per user request
            messages: [
                {
                    role: 'system',
                    content: `당신은 한국어 전문 교정 에디터입니다.
주어지는 텍스트는 음성 인식을 통해 생성된 것으로, 오탈자나 문맥에 맞지 않는 표현이 포함되어 있을 수 있습니다.
전체 텍스트의 문맥을 완벽하게 이해한 뒤, 텍스트를 논리적인 세그먼트(3~5문장 단위)로 분석하세요.

각 세그먼트 내에서 수정이 필요한 부분(비문, 오타, 더 자연스러운 표현 등)을 찾아서 다음 JSON 포맷으로 응답하세요.
수정할 필요가 없는 부분은 original_text만 반환하고 suggestions는 빈 배열로 두세요.

응답 예시 JSON 구조:
{
  "segments": [
    {
      "original_text": "세그먼트 원본 텍스트...",
      "suggestions": [
        {
          "target_substring": "수정 대상 단어/구절 (반드시 original_text에 정확히 존재하는 문자열)",
          "candidates": ["수정안 1", "수정안 2", "수정안 3"],
          "reason": "수정 제안 이유"
        }
      ]
    }
  ]
}`
                },
                {
                    role: 'user',
                    content: fullText
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3, // Lower temperature for more consistent corrections
        })

        const content = response.choices[0].message.content
        if (!content) {
            throw new Error('No content received from AI')
        }

        const result = JSON.parse(content) as CorrectionResult
        return result

    } catch (error) {
        console.error('Correction error:', error)
        return { error: 'Failed to correct text' }
    }
}
