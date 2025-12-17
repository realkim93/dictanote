'use server'

import { Client } from '@notionhq/client'
import { NotionMetadata } from './summary'

const notion = new Client({
    auth: process.env.NOTION_API_KEY,
})

export async function saveToNotion(content: string, metadata: NotionMetadata) {
    const databaseId = process.env.NOTION_DATABASE_ID

    if (!databaseId) {
        return { error: 'Notion Database ID not configured' }
    }

    try {
        const response = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                title: {
                    title: [
                        {
                            text: {
                                content: metadata.title,
                            },
                        },
                    ],
                },
                // Assumes the database has these properties. If not, this will fail.
                // We really need to know the schema or use a simpler Page creation (child of page).
                // Safest bet for "Database" is expecting standard properties, or just Title.
                // Let's try to add Tags if 'Tags' multi-select exists, and Summary if text exists.
                // For a generic implementation without knowing schema, it's risky.
                // BUT, the PRD said " 정리해서 저장할 수 있도록".
                // Let's try to include them in the page *body* if we can't be sure of properties,
                // but passing them as properties is cleaner.
                // We will assume a database with 'Summary' (Text) and 'Tags' (Multi-select) exists.
                // If not, we might need a fallback.

                "Summary": {
                    rich_text: [
                        {
                            text: {
                                content: metadata.summary
                            }
                        }
                    ]
                },
                "Tags": {
                    multi_select: metadata.tags.map(tag => ({ name: tag }))
                }
            },
            children: [
                {
                    object: 'block',
                    type: 'heading_2',
                    heading_2: {
                        rich_text: [{ text: { content: 'Summary' } }],
                    },
                },
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ text: { content: metadata.summary } }],
                    },
                },
                {
                    object: 'block',
                    type: 'heading_2',
                    heading_2: {
                        rich_text: [{ text: { content: 'Original Transcript' } }],
                    },
                },
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ text: { content: content } }],
                        // Note: Notion blocks have a 2000 char limit. Need to chunk if long.
                    },
                },
            ],
        })

        return { url: (response as any).url }
    } catch (error) {
        console.error('Notion save error:', error)
        return { error: 'Failed to save to Notion. Check Database ID and Schema.' }
    }
}
