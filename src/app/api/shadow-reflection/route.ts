import { NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, ParsedMessage } from '@/app/lib/data';
import PromptLoader from '@/app/lib/promptLoader';
import { getSimpleJsonConfig } from '@/app/lib/schemas';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { 
            theme, 
            supportingQuote, 
            description, 
            userMessage, 
            conversationHistory, 
            allSupportingQuotes,
            themeConversationHistory,
            journalConversationHistory
        } = body;

        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is not defined in the environment variables');
            throw new Error('GEMINI_API_KEY is not defined in the environment variables');
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Build the conversation context from the current reflection session
        const reflectionContext = conversationHistory
            .map((msg: ChatMessage) => `${msg.sender}: ${msg.content}`)
            .join('\n\n');

        // Build the theme-specific conversation context
        const themeContext = themeConversationHistory
            ?.map((msg: ParsedMessage) => `${msg.sender}: ${msg.text}`)
            .join('\n\n') || '';

        // Build the journal conversation context for additional insight (last 5 days)
        const journalContext = journalConversationHistory
            ?.map((msg: ParsedMessage) => `${msg.sender}: ${msg.text}`)
            .join('\n\n') || '';

        // Format all supporting quotes for this shadow trait cluster
        const supportingQuotesContext = allSupportingQuotes && allSupportingQuotes.length > 0
            ? `\n\nAll supporting quotes for this shadow pattern:\n${allSupportingQuotes.map((quote: string, index: number) => `${index + 1}. "${quote}"`).join('\n')}`
            : '';

        // Create a specialized prompt for shadow trait integration with full context
        const prompt = PromptLoader.getPromptText('shadow/individual-integration', {
            theme,
            description: supportingQuotesContext,
            shadowQuestion: supportingQuote,
            todayContext: journalContext,
            journalContext,
            reflectionContext,
            userMessage
        });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: getSimpleJsonConfig()
        });

        const generatedContent = JSON.parse(response.text || '{}');

        // Validate the response structure
        if (!generatedContent.response) {
            throw new Error('Invalid AI response structure');
        }


        return NextResponse.json({
            response: generatedContent.response,
        });

    } catch (error) {
        console.error('Error in shadow reflection API:', error);
        return NextResponse.json(
            { error: 'Failed to generate shadow reflection response' },
            { status: 500 }
        );
    }
} 