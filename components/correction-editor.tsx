'use client'

import { useState } from 'react'
import { CorrectionResult } from '@/app/actions/correct'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, X, RotateCcw } from 'lucide-react'

interface CorrectionEditorProps {
    initialResult: CorrectionResult
    onSave: (text: string) => void
    onCancel: () => void
}

export function CorrectionEditor({ initialResult, onSave, onCancel }: CorrectionEditorProps) {
    // We manage the segments as state because applying a suggestion changes the text
    // The structure might need to change to support applying edits. 
    // For simplicity, we will track applied edits by modifying the 'original_text' in the segment
    // and removing the suggestion used.

    const [segments, setSegments] = useState(initialResult.segments)

    const handleApplySuggestion = (segmentIndex: number, suggestionIndex: number, newText: string) => {
        setSegments(prev => {
            const newSegments = [...prev]
            const segment = { ...newSegments[segmentIndex] }
            // Replace only the first occurrence for now (MVP limitation)
            // Ideally we track indices, but string matching is fragile.
            // We assume strict matching from the AI response.
            const target = segment.suggestions[suggestionIndex].target_substring

            // Simple string replacement - risky if multiple occurrences
            segment.original_text = segment.original_text.replace(target, newText)

            // Remove the suggestion as it's resolved
            segment.suggestions = segment.suggestions.filter((_, idx) => idx !== suggestionIndex)

            newSegments[segmentIndex] = segment
            return newSegments
        })
    }

    const handleManualEdit = (segmentIndex: number, suggestionIndex: number, manualText: string) => {
        handleApplySuggestion(segmentIndex, suggestionIndex, manualText)
    }

    const getFullText = () => segments.map(s => s.original_text).join(' ') // Join with space or newline? 
    // Since we don't know the delimiter, space is safe, but paragraphs might merge.
    // We can join with "\n\n" if we want paragraphs, but let's assume space for flow.

    // Actually, we should allow editable text area as well?
    // The PRD implies "Click 1, 2, 3". If we just replace text, the user can't edit other parts easily.
    // But let's stick to the PRD: Click candidates to fix.

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-white min-h-[400px] text-lg leading-relaxed whitespace-pre-wrap">
                {segments.map((segment, sIdx) => {
                    let text = segment.original_text
                    // We need to render this text but allowing interactive spans for suggestions.
                    // This is tricky: "I like appple and bannana". Two suggestions.
                    // We need to parse the string to insert components.

                    // Basic parser: iterate suggestions, split text. 
                    // Note: overlapping suggestions are not handled (AI shouldn't do that).

                    // We sort suggestions by their position in string to avoid mess (indexOf)
                    // But 'indexOf' is ambiguous if duplicates exist. 
                    // We will attempt to split by the *first* match of each suggestion sequentially if possible, 
                    // or just highlight all occurrences (simpler).

                    // Let's go with a simpler rendered approach:
                    // We assume suggestions are distinct enough. 
                    // We will construct an array of ReactNodes.

                    const parts: React.ReactNode[] = []
                    let lastIndex = 0

                    // Sort suggestions by position (finding first index)
                    const sortedSuggestions = [...segment.suggestions].sort((a, b) => {
                        return text.indexOf(a.target_substring) - text.indexOf(b.target_substring)
                    }).filter(s => text.indexOf(s.target_substring) !== -1)

                    // If no suggestions, just text
                    if (sortedSuggestions.length === 0) {
                        return <span key={sIdx}>{text} </span>
                    }

                    sortedSuggestions.forEach((suggestion, sugIdx) => {
                        const start = text.indexOf(suggestion.target_substring, lastIndex)
                        if (start === -1) return // Already processed or not found

                        const before = text.slice(lastIndex, start)
                        if (before) parts.push(<span key={`${sIdx}-text-${lastIndex}`}>{before}</span>)

                        parts.push(
                            <Popover key={`${sIdx}-sug-${sugIdx}`}>
                                <PopoverTrigger asChild>
                                    <span className="cursor-pointer bg-yellow-100 hover:bg-yellow-200 border-b-2 border-yellow-400 px-0.5 rounded transition-colors">
                                        {suggestion.target_substring}
                                    </span>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0" align="start">
                                    <div className="p-2 bg-slate-50 border-b text-xs font-semibold text-slate-500">
                                        Suggestion: {suggestion.reason}
                                    </div>
                                    <div className="p-1 flex flex-col gap-1">
                                        {suggestion.candidates.map((candidate, cIdx) => (
                                            <Button
                                                key={cIdx}
                                                variant="ghost"
                                                className="justify-start h-auto py-2 px-3 text-left font-normal"
                                                onClick={() => handleApplySuggestion(sIdx, segment.suggestions.indexOf(suggestion), candidate)}
                                            >
                                                <span className="font-bold mr-2 text-blue-600">{cIdx + 1}.</span>
                                                {candidate}
                                            </Button>
                                        ))}
                                    </div>
                                    <div className="p-2 border-t bg-slate-50">
                                        <Label className="text-xs mb-1 block text-slate-500">Manual Edit (Option 4)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Type correction..."
                                                className="h-8 text-sm"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleManualEdit(sIdx, segment.suggestions.indexOf(suggestion), e.currentTarget.value)
                                                }}
                                            />
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )

                        lastIndex = start + suggestion.target_substring.length
                    })

                    // Remaining text
                    const after = text.slice(lastIndex)
                    if (after) parts.push(<span key={`${sIdx}-text-end`}>{after}</span>)

                    return (
                        <span key={sIdx}>
                            {parts}
                            {' '}
                        </span>
                    ) // Add space between segments
                })}
            </div>

            <div className="flex justify-between items-center bg-slate-100 p-4 rounded-lg">
                <Button variant="outline" onClick={onCancel} className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Cancel Correction
                </Button>
                <div className="flex gap-2">
                    <span className="text-sm text-slate-500 self-center mr-2">
                        Click highlighted text to review suggestions.
                    </span>
                    <Button onClick={() => onSave(segments.map(s => s.original_text).join(' '))} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Check className="w-4 h-4" />
                        Finalize & Save
                    </Button>
                </div>
            </div>
        </div>
    )
}
