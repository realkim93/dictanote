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

    try {
        const response = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-large-v3-turbo',
            language: 'ko', // Force Korean as per requirements
        })

        return { text: response.text }
    } catch (error) {
        console.error('Transcription error:', error)
        return { error: 'Failed to transcribe audio' }
    }
}
