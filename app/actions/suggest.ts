'use server'

import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function suggestAlternatives(text: string): Promise<string[]> {
    if (!text || text.trim().length < 2) return []

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a real-time speech correction assistant.
                    User Input: Korean sentence.
                    Task: Provide 3 phonetically similar or corrected alternatives.
                    Constraint: ALWAYS return a valid JSON array of 3 strings under the key "alternatives".
                    Order: Rank by likelihood (Option 1 = Most likely intended sentence).
                    Example: { "alternatives": ["most_likely", "second_likely", "third_likely"] }`
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: "json_object" },
        })

        const content = response.choices[0].message.content
        if (!content) return []

        try {
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim()
            const parsed = JSON.parse(cleanContent)
            const candidates = Array.isArray(parsed) ? parsed : parsed.alternatives

            if (Array.isArray(candidates)) {
                return candidates.slice(0, 3)
            }
        } catch (e) {
            console.error('Failed to parse suggestion JSON', e)
        }

        return []

    } catch (error) {
        console.error('Suggestion generation failed', error)
        return []
    }
}
