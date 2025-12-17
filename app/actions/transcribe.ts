'use server'

import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function transcribeAudio(formData: FormData) {
    const file = formData.get('file') as File

    if (!file) {
        throw new Error('No file provided')
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error('Missing OPENAI_API_KEY')
        return { error: 'Server misconfiguration: Missing API Key' }
    }

    try {
        console.log('Transcribing file...', file.name, file.size)
        const response = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'ko',
            temperature: 0.0, // Reduce creativity to minimize hallucinations
        })

        const text = response.text.trim()

        // Filter out common Whisper hallucinations
        const hallucinations = [
            'MBC 뉴스', 'MBC뉴스',
            '시청해주셔서 감사합니다', '시청해 주셔서 감사합니다',
            '구독과 좋아요', '구독, 좋아요', '부탁드립니다',
            'Thanks for watching', 'Thank you for watching',
            'Subtitles by', 'Amara.org'
        ]

        if (hallucinations.some(h => text.includes(h)) && text.length < 30) {
            console.log('Filtered hallucination:', text)
            return { text: '' }
        }

        return { text }
    } catch (error) {
        console.error('Transcription error:', error)
        return { error: 'Failed to transcribe audio' }
    }
}
