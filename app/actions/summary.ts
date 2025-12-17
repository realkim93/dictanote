'use server'

import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export type NotionMetadata = {
    title: string
    summary: string
    tags: string[]
}

export async function generateSummary(text: string): Promise<NotionMetadata | { error: string }> {
    if (!text.trim()) {
        return { error: 'Empty text provided' }
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-5.2',
            messages: [
                {
                    role: 'system',
                    content: `다음 텍스트를 분석하여 Notion 페이지에 저장할 메타데이터를 생성해주세요.
1. 내용 전체를 포괄하는 직관적인 '제목' (20자 이내)
2. 핵심 내용을 요약한 '3줄 요약'
3. 관련된 태그 3개

JSON 포맷으로 응답:
{
  "title": "제목",
  "summary": "요약문...",
  "tags": ["태그1", "태그2", "태그3"]
}`
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
        })

        const content = response.choices[0].message.content
        if (!content) {
            throw new Error('No content received from AI')
        }

        const result = JSON.parse(content) as NotionMetadata
        return result

    } catch (error) {
        console.error('Summary generation error:', error)
        return { error: 'Failed to generate summary' }
    }
}
