'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { transcribeAudio } from '@/app/actions/transcribe'
import { correctText, CorrectionResult } from '@/app/actions/correct'
import { generateSummary, NotionMetadata } from '@/app/actions/summary'
import { saveToNotion } from '@/app/actions/notion'
import { CorrectionEditor } from '@/components/correction-editor'
import { SummaryReview } from '@/components/summary-review'
import { Mic, Square, Loader2, Sparkles, FileText } from 'lucide-react'

export function AudioRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [mode, setMode] = useState<'recording' | 'correction' | 'summary'>('recording')
    const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null)
    const [notionMetadata, setNotionMetadata] = useState<NotionMetadata | null>(null)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const processAudioChunk = async (blob: Blob) => {
        setIsProcessing(true)
        const formData = new FormData()
        formData.append('file', blob, 'audio.webm')

        try {
            const result = await transcribeAudio(formData)
            if (result.text) {
                setTranscript(prev => {
                    return prev ? prev + ' ' + result.text : result.text
                })
            }
        } catch (error) {
            console.error('Transcription failed', error)
        } finally {
            setIsProcessing(false)
        }
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            mediaRecorder.start(1000) // Collect 1s chunks
            setIsRecording(true)

            intervalRef.current = setInterval(async () => {
                if (chunksRef.current.length > 0) {
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                    chunksRef.current = []
                    await processAudioChunk(blob)
                }
            }, 10000)

        } catch (err) {
            console.error('Error accessing microphone:', err)
            alert('Microphone access denied or not supported.')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())

            setTimeout(() => {
                if (chunksRef.current.length > 0) {
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                    chunksRef.current = []
                    processAudioChunk(blob)
                }
            }, 500)

            setIsRecording(false)
        }
    }

    const handleStartCorrection = async () => {
        if (!transcript.trim()) return

        setIsProcessing(true)
        try {
            const result = await correctText(transcript)
            if ('error' in result) {
                alert(result.error)
                return
            }
            setCorrectionResult(result)
            setMode('correction')
        } catch (e) {
            console.error(e)
            alert('Correction failed')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSaveCorrection = (finalText: string) => {
        setTranscript(finalText)
        setMode('recording')
        setCorrectionResult(null)
    }

    const handleCancelCorrection = () => {
        setMode('recording')
        setCorrectionResult(null)
    }

    const handleGenerateSummary = async () => {
        if (!transcript.trim()) return

        setIsProcessing(true)
        try {
            const result = await generateSummary(transcript)
            if ('error' in result) {
                alert(result.error)
                return
            }
            setNotionMetadata(result)
            setMode('summary')
        } catch (e) {
            console.error(e)
            alert('Summary generation failed')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSaveToNotion = async (metadata: NotionMetadata) => {
        setIsProcessing(true)
        try {
            const result = await saveToNotion(transcript, metadata)
            if ('error' in result) {
                alert(result.error)
            } else {
                alert('Successfully saved to Notion!')
                setMode('recording')
                setNotionMetadata(null)
            }
        } catch (e) {
            console.error(e)
            alert('Failed to save to Notion')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleCancelSummary = () => {
        setMode('recording')
        setNotionMetadata(null)
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>
                            {mode === 'correction' ? 'AI Correction' :
                                mode === 'summary' ? 'Notion Export' : 'Dictanote Recording'}
                        </span>
                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {mode === 'recording' && (
                        <Textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            placeholder="Transcription will appear here..."
                            className="min-h-[400px] text-lg leading-relaxed p-6 resize-none focus-visible:ring-1"
                            disabled={isProcessing && !isRecording}
                        />
                    )}

                    {mode === 'correction' && correctionResult && (
                        <CorrectionEditor
                            initialResult={correctionResult}
                            onSave={handleSaveCorrection}
                            onCancel={handleCancelCorrection}
                        />
                    )}

                    {mode === 'summary' && notionMetadata && (
                        <SummaryReview
                            metadata={notionMetadata}
                            fullText={transcript}
                            onSave={handleSaveToNotion}
                            onCancel={handleCancelSummary}
                            isSaving={isProcessing}
                        />
                    )}
                </CardContent>
                {mode === 'recording' && (
                    <CardFooter className="flex justify-between items-center">
                        <div className="flex gap-4">
                            {!isRecording ? (
                                <Button onClick={startRecording} size="lg" className="w-32 gap-2 bg-red-500 hover:bg-red-600">
                                    <Mic className="w-4 h-4" /> Record
                                </Button>
                            ) : (
                                <Button onClick={stopRecording} size="lg" variant="destructive" className="w-32 gap-2">
                                    <Square className="w-4 h-4" /> Stop
                                </Button>
                            )}

                            <div className="text-sm text-muted-foreground self-center">
                                {isRecording ? "Recording... (Auto-transcribing every 10s)" : "Ready to record"}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setTranscript('')} disabled={isRecording}>Reset</Button>
                            <Button
                                variant="outline"
                                onClick={handleGenerateSummary}
                                disabled={isRecording || !transcript.trim() || isProcessing}
                                className="gap-2"
                            >
                                <FileText className="w-4 h-4 text-green-600" />
                                Export to Notion
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={handleStartCorrection}
                                disabled={isRecording || !transcript.trim() || isProcessing}
                                className="gap-2"
                            >
                                <Sparkles className="w-4 h-4 text-yellow-500" />
                                Start Correction
                            </Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </div>
    )
}
