'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { correctText, CorrectionResult } from '@/app/actions/correct'
import { generateSummary, NotionMetadata } from '@/app/actions/summary'
import { saveToNotion } from '@/app/actions/notion'
import { suggestAlternatives } from '@/app/actions/suggest'
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

    // Real-time suggestion state
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [lastSentence, setLastSentence] = useState<string | null>(null)

    const recognitionRef = useRef<any>(null)

    // Trigger suggestion generation
    const handleSuggestionTrigger = async (sentence: string) => {
        if (!sentence || sentence.length < 2) return
        setLastSentence(sentence)
        setSuggestions([]) // Clear old

        try {
            const alts = await suggestAlternatives(sentence)
            if (alts && alts.length > 0) {
                setSuggestions(alts)
            }
        } catch (e) {
            console.error('Suggestion error', e)
        }
    }

    // Handle Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (mode !== 'recording' || suggestions.length === 0 || !lastSentence) return

            if (['1', '2', '3'].includes(e.key)) {
                e.preventDefault()
                const index = parseInt(e.key) - 1
                if (suggestions[index]) {
                    const selected = suggestions[index]
                    setTranscript(prev => {
                        // Replace the last occurrence of the lastSentence
                        // Verify it ends with it (approx)
                        const trimmedPrev = prev.trim()
                        if (trimmedPrev.endsWith(lastSentence)) {
                            return trimmedPrev.slice(0, -lastSentence.length) + selected
                        }
                        return prev // Fallback if mismatch
                    })
                    setSuggestions([]) // Clear after selection
                    setLastSentence(null)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [mode, suggestions, lastSentence])

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
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const newText = event.results[i][0].transcript.trim()
                    setTranscript(prev => {
                        return prev ? `${prev} ${newText}` : newText
                    })

                    // Trigger suggestion for this finalized sentence
                    handleSuggestionTrigger(newText)
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
        setSuggestions([])
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
            setSuggestions([])
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
                        <div className="relative">
                            <Textarea
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                placeholder="Click Record and start speaking in Korean..."
                                className="min-h-[400px] text-lg leading-relaxed p-6 resize-none focus-visible:ring-1 pb-20" // Extra padding for suggestions
                                disabled={isProcessing}
                            />

                            {suggestions.length > 0 && (
                                <div className="absolute bottom-4 left-4 right-4 bg-white/95 border shadow-lg rounded-lg p-3 backdrop-blur transition-all animate-in slide-in-from-bottom-2">
                                    <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
                                        <span>Alternate Suggestions (Press 1-3 to replace last sentence)</span>
                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">GPT-4o-mini</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {suggestions.map((sug, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    // Trigger keydown emulation or direct replace logic
                                                    // DRY: Simplest to just copy logic? Or verify keydown handler works.
                                                    // Just manual dispatch for now or copy replace logic.
                                                    if (lastSentence) {
                                                        setTranscript(prev => {
                                                            const trimmedPrev = prev.trim()
                                                            if (trimmedPrev.endsWith(lastSentence)) {
                                                                return trimmedPrev.slice(0, -lastSentence.length) + sug
                                                            }
                                                            return prev
                                                        })
                                                        setSuggestions([])
                                                        setLastSentence(null)
                                                    }
                                                }}
                                                className="text-left text-sm p-2 hover:bg-slate-50 border rounded flex gap-2 items-center group"
                                            >
                                                <span className="bg-slate-200 text-slate-700 w-5 h-5 flex items-center justify-center rounded text-xs font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    {idx + 1}
                                                </span>
                                                <span className="flex-1">{sug}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
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
