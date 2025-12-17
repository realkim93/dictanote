'use client'

import { useState } from 'react'
import { NotionMetadata } from '@/app/actions/summary'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save, Loader2, ArrowRight } from 'lucide-react'

interface SummaryReviewProps {
    metadata: NotionMetadata
    fullText: string
    onSave: (metadata: NotionMetadata) => void
    onCancel: () => void
    isSaving: boolean
}

export function SummaryReview({ metadata: initialMetadata, onSave, onCancel, isSaving }: SummaryReviewProps) {
    const [metadata, setMetadata] = useState(initialMetadata)

    const handleTagChange = (index: number, value: string) => {
        const newTags = [...metadata.tags]
        newTags[index] = value
        setMetadata({ ...metadata, tags: newTags })
    }

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-white">
            <h3 className="font-semibold text-lg border-b pb-2">Review Notion Export</h3>

            <div className="space-y-2">
                <Label>Title</Label>
                <Input
                    value={metadata.title}
                    onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea
                    value={metadata.summary}
                    onChange={(e) => setMetadata({ ...metadata, summary: e.target.value })}
                    className="h-24 resize-none"
                />
            </div>

            <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                    {metadata.tags.map((tag, idx) => (
                        <Input
                            key={idx}
                            value={tag}
                            onChange={(e) => handleTagChange(idx, e.target.value)}
                            className="w-32 h-8 text-sm inline-block"
                        />
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                <Button variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
                <Button onClick={() => onSave(metadata)} disabled={isSaving} className="gap-2 bg-green-600 hover:bg-green-700">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save to Notion
                </Button>
            </div>
        </div>
    )
}
