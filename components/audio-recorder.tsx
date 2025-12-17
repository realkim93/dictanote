'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { correctText, CorrectionResult } from '@/app/actions/correct'
import { generateSummary, NotionMetadata } from '@/app/actions/summary'
import { saveToNotion } from '@/app/actions/notion'
import { CorrectionEditor } from '@/components/correction-editor'
import { SummaryReview } from '@/components/summary-review'
import { Mic, Square, Loader2, Sparkles, FileText, Globe } from 'lucide-react'

// Type definition for Web Speech API
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export function AudioRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [mode, setMode] = useState<'recording' | 'correction' | 'summary'>('recording')
    const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null)
    const [notionMetadata, setNotionMetadata] = useState<NotionMetadata | null>(null)
    const [error, setError] = useState<string | null>(null)

    const recognitionRef = useRef<any>(null)

    useEffect(() => {
        // Initialize SpeechRecognition on mount
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow
        const SpeechRecognitionAPI = SpeechRecognition || webkitSpeechRecognition

        if (!SpeechRecognitionAPI) {
            setError('Web Speech API is not supported in this browser. Please use Chrome or Safari.')
            return
        }

        const recognition = new SpeechRecognitionAPI()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ko-KR'

        recognition.onresult = (event: any) => {
            let finalTranscript = ''
            // Reconstruct the full transcript from the event results
            // We can't just append because interim results change. 
            // Strategy: Keep previous chunks? 
            // Actually, standard behavior: event.results contains the session's results. 
            // But if we restart, we lose it. 
            // Let's append only finalized results and keep partials in separate state?
            // Simpler: Just map all results to string.

            let interimTranscript = ''

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    // Basic heuristic: simple append. 
                    // But `transcript` state updates might be async. 
                    // Better to update based on what the API returns for THIS session.
                    setTranscript(prev => {
                        const newText = event.results[i][0].transcript.trim()
                        return prev ? `${prev} ${newText}` : newText
                    })
                }
            }
        }

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error)
            if (event.error === 'not-allowed') {
                setError('Microphone access denied.')
                setIsRecording(false)
            }
        }

        recognition.onend = () => {
            // Auto-restart if it stops but we think we are recording (e.g. timeout)
            // Checking a ref would be needed here if we rely on state
        }

        recognitionRef.current = recognition
    }, [])

    // To handle the "continuous" state properly with React state, 
    // we actually need to manage the start/stop carefully.
    // The 'onresult' above with 'continuous=true' will keep adding to event.results.
    // BUT, existing `transcript` state management might duplicate text if we are not careful.
    // Let's modify: simpler approach -> just listening to "result".

    // NOTE: React state inside onresult closure will be stale if we don't use functional updates or refs.
    // I used functional update for setTranscript above.

    const startRecording = () => {
        setError(null)
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start()
                setIsRecording(true)
            } catch (e) {
                console.error('Failed to start recognition', e)
            }
        }
    }

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
            setIsRecording(false)
        }
    }

    // --- API Handlers (Same as before) ---

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
                        <span className="flex items-center gap-2">
                            {mode === 'correction' ? 'AI Correction' :
                                mode === 'summary' ? 'Notion Export' : 'Dictanote (Web Speech API)'}
                            {mode === 'recording' && <Globe className="w-4 h-4 text-blue-500" />}
                        </span>
                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {mode === 'recording' && (
                        <Textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            placeholder="Click Record and start speaking in Korean..."
                            className="min-h-[400px] text-lg leading-relaxed p-6 resize-none focus-visible:ring-1"
                            disabled={isProcessing}
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
                                <Button onClick={startRecording} size="lg" className="w-32 gap-2 bg-blue-600 hover:bg-blue-700">
                                    <Mic className="w-4 h-4" /> Start
                                </Button>
                            ) : (
                                <Button onClick={stopRecording} size="lg" variant="destructive" className="w-32 gap-2">
                                    <Square className="w-4 h-4" /> Stop
                                </Button>
                            )}

                            <div className="text-sm text-muted-foreground self-center">
                                {isRecording ? "Listening..." : "Browser Native STT"}
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

            <p className="text-center text-xs text-muted-foreground mt-4">
                Runs entirely in your browser using the Web Speech API. No audio data is sent to Dictanote servers until you request AI correction.
            </p>
        </div>
    )
}
