import { NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { ParsedMessage } from '@/app/lib/data';
import PromptLoader from '@/app/lib/promptLoader';
import { getSimpleJsonConfig } from '@/app/lib/schemas';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { 
            theme, 
            supportingQuote, 
            description, 
            allSupportingQuotes,
            themeConversationHistory,
            userMemories,
            journalConversationHistory,
            memories
        } = body;

        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is not defined in the environment variables');
            throw new Error('GEMINI_API_KEY is not defined in the environment variables');
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Build the journal conversation context for additional insight (last 5 days)
        const journalContext = journalConversationHistory
            ?.map((msg: ParsedMessage) => `${msg.sender}: ${msg.text}`)
            .join('\n\n') || '';

        // Format all supporting quotes for this emotional theme
        const supportingQuotesContext = allSupportingQuotes && allSupportingQuotes.length > 0
            ? `\n\nAll supporting quotes for this emotional theme:\n${allSupportingQuotes.map((quote: string, index: number) => `${index + 1}. "${quote}"`).join('\n')}`
            : '';

        // Format memories for context
        const memoriesContext = memories && memories.length > 0
            ? `\n\nUser's personal memories and traits:\n${memories.map((memory: string, index: number) => `• ${memory}`).join('\n')}`
            : '';

        const prompt = PromptLoader.getPromptText('reflection/emotional-initial', {
            theme,
            description,
            supportingQuotesContext,
            memoriesContext,
            journalContext
        });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: getSimpleJsonConfig()
        });

        const generatedContent = JSON.parse(response.text || '{}');

        if (!generatedContent.response) {
            throw new Error('Invalid AI response structure');
        }

        return NextResponse.json({
            response: generatedContent.response
        });

    } catch (error) {
        console.error('Error in emotional reflection initial API:', error);
        return NextResponse.json(
            { error: 'Failed to generate initial emotional reflection message' },
            { status: 500 }
        );
    }
} 