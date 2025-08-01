import {
    ConversationData,
    ParsedMessage,
    MessagesByDate,
    ParseResult,
    JournalEntry,
    Conversation,
    Conversations,
    JournalEntries,
    ProcessedData,
    MemoryData,
    ThemeWithQuote,
    ThemeResponse,
    ShadowTraitWithQuote,
    ShadowTraitResponse,
    Person,
    PersonRelationshipType,
    Goal,
    GoalType,
    GoalStatus,
    GoalTimeframe,
    GeneralMemory,
    MemoryTag,
    SourceReference,
} from '@/app/lib/data';
import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from "@google/genai";
import PromptLoader from '@/app/lib/promptLoader';
import { journalEntrySchema, memoryExtractionSchema, getConfigWithThinking, getSimpleJsonConfig } from '@/app/lib/schemas';


// Configure runtime for longer processing
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

// Utility function to limit concurrency
async function limitConcurrency<T>(
    tasks: (() => Promise<T>)[],
    limit: number
): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<any>[] = [];
    
    for (const task of tasks) {
        const promise = task().then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
        });
        
        results.push(promise as any);
        executing.push(promise);
        
        if (executing.length >= limit) {
            await Promise.race(executing);
        }
    }
    
    return Promise.all(results);
}

// Unused functions for future goal/people suggestion system
async function extractGoalsAndPeople(
    messagesByDate: MessagesByDate,
    apiKey: string,
    existingPeople: Person[],
    existingGoals: Goal[]
): Promise<{people: Person[], goals: Goal[]}> {
    // Future implementation for goal/people suggestions
    return { people: [], goals: [] };
}

// Memory extraction function using Gemini Flash for general memories only
async function extractMemoriesProgressively(
    messagesByDate: MessagesByDate,
    apiKey: string
): Promise<MemoryData> {
    const ai = new GoogleGenAI({ apiKey });
    
    // Initialize memory collections - only general memories for now
    const people: Person[] = [];
    const goals: Goal[] = [];
    const generalMemories: GeneralMemory[] = [];
    
    // Process days sequentially to build context
    const sortedDates = Object.keys(messagesByDate).sort();
    
    for (const dateString of sortedDates) {
        const messages = messagesByDate[dateString];
        if (!messages || messages.length === 0) continue;
        
        // Get only user messages for memory extraction
        const userMessages = messages.filter(msg => msg.sender === 'user');
        if (userMessages.length === 0) continue;
        
        const conversationContext = userMessages
            .map(msg => msg.text)
            .join('\n\n');
        
        // Build context of existing general memories for the AI
        const existingContext = {
            generalMemories: generalMemories.map(m => `ID: ${m.id} | ${m.content} (${m.tag}) -> Last relevant quote: ${m.extractedFrom[m.extractedFrom.length - 1].relevantQuote}`).join('\n')
        };
        console.log("existingContext", existingContext);
        
        // Retry mechanism with exponential backoff
        const maxRetries = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempting to extract memories for ${dateString} (attempt ${attempt}/${maxRetries})`);
                
                const prompt = PromptLoader.getPromptText('memory/extract-facts', {
                    dateString,
                    'existingContext.generalMemories': existingContext.generalMemories || 'None yet',
                    conversationContext
                });

                const response = await ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: prompt,
                config: getConfigWithThinking(memoryExtractionSchema)
            });
            

            const extractedMemories = JSON.parse(response.text || '{}');
            console.log("extractedMemories", extractedMemories);
            
            // Filter out memories with problematic words
            if (extractedMemories.generalMemories) {
                const filterWords = ['planning', 'plans', 'interested', 'interest', 'considering', 'goal', 'goals', 'wants', 'want'];
                const originalCount = extractedMemories.generalMemories.length;
                
                extractedMemories.generalMemories = extractedMemories.generalMemories.filter((memory: any) => {
                    const containsFilterWord = filterWords.some(word => 
                        memory.content.toLowerCase().includes(word.toLowerCase())
                    );
                    
                    if (containsFilterWord) {
                        console.log(`Filtered out memory: "${memory.content}"`);
                        return false;
                    }
                    return true;
                });
                
                const filteredCount = extractedMemories.generalMemories.length;
                if (originalCount !== filteredCount) {
                    console.log(`Memory filter: ${originalCount} → ${filteredCount} (removed ${originalCount - filteredCount})`);
                }
            }
            
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (!part.text) {
                  continue;
                }
                else if (part.thought) {
                  console.log("Thoughts summary:");
                  console.log(part.text);
                }
                else {
                  console.log("Answer:");
                  console.log(part.text);
                }
              }
            
            // Process general memories with single array approach (new and existing in one array)
            if (extractedMemories.generalMemories) {
                let memoryId = 0;
                for (const memoryData of extractedMemories.generalMemories) {
                    
                    if (memoryData.id) {
                        // Has ID = existing memory update
                        const existingMemory = generalMemories.find(m => m.id === memoryData.id);
                        if (existingMemory) {
                            // Update existing memory
                            existingMemory.content = memoryData.content;
                            existingMemory.tag = memoryData.tag as MemoryTag;
                            existingMemory.lastUpdated = new Date(dateString);
                            
                            // Add new source reference
                            existingMemory.extractedFrom.push({
                                type: 'conversation' as const,
                                date: new Date(dateString),
                                relevantQuote: memoryData.quote
                            });
                        }
                    } else {
                        // No ID = new memory
                        generalMemories.push({
                            id: dateString + 'memory' + memoryId,
                            content: memoryData.content,
                            tag: memoryData.tag as MemoryTag,
                            lastUpdated: new Date(dateString),
                            extractedFrom: [{
                                type: 'conversation' as const,
                                date: new Date(dateString),
                                relevantQuote: memoryData.quote
                            }]
                        });
                        memoryId++;
                    }
                }
            }
            
            // If we get here, the request was successful
            console.log(`Successfully extracted memories for ${dateString}`);
            break; // Exit the retry loop on success
            
            } catch (error) {
                lastError = error as Error;
                console.error(`Attempt ${attempt} failed for ${dateString}:`, error);
                
                // If this is the last attempt, continue to next date
                if (attempt === maxRetries) {
                    console.error(`All ${maxRetries} attempts failed for ${dateString}. Continuing to next date.`);
                    break; // Exit retry loop and continue with next date
                }
                
                // Calculate delay with exponential backoff (1s, 2s, 4s)
                const delay = Math.pow(2, attempt - 1) * 1000;
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } // End of retry loop
    } // End of dateString loop
    console.log("Goals", JSON.stringify(goals, null, 2));
    return {
        people,
        goals,
        generalMemories,
        stats: {
            totalPeople: people.length,
            totalGoals: goals.length,
            totalMemories: generalMemories.length
        }
    };
    }


async function parseConversations(conversationList: ConversationData[], apiKey?: string, dayLimit?: number): Promise<ProcessedData> {
    const conversations: Conversation[] = [];
    const messagesByDate: MessagesByDate = {};

    conversationList.forEach(conversation => {
        if (!conversation.mapping) return;

        const messages: ParsedMessage[] = [];
        let earliestTime = Infinity;
        let latestTime = -Infinity;

        // Extract messages from the mapping
        Object.values(conversation.mapping).forEach(node => {
            const message = node.message;
            
            // Skip if no message or empty content
            if (!message || !message.content || !message.content.parts) return;
            
            const messageText = message.content.parts.join(' ').trim();
            
            // Skip empty messages
            if (!messageText) return;

            // Get sender type
            const senderType = message.author?.role || 'unknown';
            
            // Get date - use create_time if available, otherwise use conversation create_time
            let timestamp = message.create_time || conversation.create_time;
            if (!timestamp) return; // Skip if no timestamp available
            
            // Convert timestamp to date
            const date = new Date(timestamp * 1000);
            const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            
            const messageObj: ParsedMessage = {
                date: date,
                dateString: dateString,
                sender: senderType,
                text: messageText,
                conversationId: conversation.conversation_id || conversation.id || 'unknown',
                messageId: message.id,
                timestamp: timestamp
            };

            messages.push(messageObj);

            // Track earliest and latest times
            earliestTime = Math.min(earliestTime, timestamp);
            latestTime = Math.max(latestTime, timestamp);

            // Organize by date for journal entry generation
            if (!messagesByDate[dateString]) {
                messagesByDate[dateString] = [];
            }
            messagesByDate[dateString].push(messageObj);
        });

        // Sort messages by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);

        // Create conversation object
        const conversationObj: Conversation = {
            id: conversation.conversation_id || conversation.id || 'unknown',
            title: conversation.title,
            messages: messages,
            metadata: {
                createdAt: earliestTime,
                updatedAt: latestTime
            }
        };

        conversations.push(conversationObj);
    });

    // Sort conversations by creation time
    conversations.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);

    // Sort messages within each date
    Object.keys(messagesByDate).forEach(date => {
        messagesByDate[date].sort((a, b) => a.timestamp - b.timestamp);
    });

    // Filter to last N days if dayLimit is specified
    let filteredMessagesByDate = messagesByDate;
    if (dayLimit && dayLimit > 0) {
        const allDates = Object.keys(messagesByDate).sort();
        const lastNDates = allDates.slice(-dayLimit);
        
        filteredMessagesByDate = {};
        lastNDates.forEach(date => {
            filteredMessagesByDate[date] = messagesByDate[date];
        });
        
        console.log(`Filtered to last ${dayLimit} days: ${lastNDates.length} days of data`);
    }

    // Create journal entries from filteredMessagesByDate if API key is provided
    const journalEntries: JournalEntries = {
        entries: [],
        stats: {
            totalEntries: 0,
            dateRange: null
        }
    };
    
    if (apiKey && Object.keys(filteredMessagesByDate).length > 0) {
        try {
            // Generate journal entries for each date that has messages (without processing themes yet)
            // Limit concurrency to prevent overwhelming the API
            const JOURNAL_GENERATION_CONCURRENCY_LIMIT = 5;
            const totalDates = Object.keys(filteredMessagesByDate).length;
            
            console.log(`Generating journal entries for ${totalDates} dates with concurrency limit of ${JOURNAL_GENERATION_CONCURRENCY_LIMIT}`);
            
            const journalTasks = Object.keys(filteredMessagesByDate).map((dateString) => {
                return async () => {
                    try {
                        return await generateJournalEntryWithoutThemeProcessing(filteredMessagesByDate, dateString, apiKey);
                    } catch (error) {
                        console.error(`Failed to generate journal entry for ${dateString}:`, error);
                        return null;
                    }
                };
            });

            // Run memory extraction in parallel with journal generation
            const memoryExtractionPromise = extractMemoriesProgressively(filteredMessagesByDate, apiKey);

            // Wait for both journal generation and memory extraction
            const [generatedEntries, memoryData] = await Promise.all([
                limitConcurrency(journalTasks, JOURNAL_GENERATION_CONCURRENCY_LIMIT),
                memoryExtractionPromise.catch(error => {
                    console.error('Memory extraction failed:', error);
                    return {
                        people: [],
                        goals: [],
                        generalMemories: [],
                        stats: { totalPeople: 0, totalGoals: 0, totalMemories: 0 }
                    };
                })
            ]);
            
            // Filter out null entries
            const validEntries = generatedEntries.filter((entry): entry is JournalEntry => entry !== null);
            
            journalEntries.entries = validEntries;
            journalEntries.stats.totalEntries = validEntries.length;
            
            if (validEntries.length > 0) {
                const dates = validEntries.map(entry => entry.date).sort();
                journalEntries.stats.dateRange = {
                    earliest: dates[0],
                    latest: dates[dates.length - 1]
                };
            }

            // Add memory data to the response
            const processedData: ProcessedData = {
                conversations: {
                    conversations: conversations
                },
                journalEntries: journalEntries,
                themeAnalysis: undefined,
                shadowTraitAnalysis: undefined,
                memoryData: memoryData
            };

            return processedData;
        } catch (error) {
            console.error('Error generating journal entries:', error);
            // Continue with empty journal entries if generation fails
        }
    }

    return {
        conversations: {
            conversations: conversations
        },
        journalEntries: journalEntries,
        themeAnalysis: undefined,
        shadowTraitAnalysis: undefined
    };
}

// New function that generates journal entries without theme processing
async function generateJournalEntryWithoutThemeProcessing(
    messagesByDate: MessagesByDate,
    dateString: string,
    apiKey: string
): Promise<JournalEntry | null> {
    const messages = messagesByDate[dateString];
    
    if (!messages || messages.length === 0) {
        return null;
    }

    try {
        return await generateJournalEntry(messages, dateString, apiKey);
    } catch (error) {
        console.error('Error generating journal entry:', error);
        throw error;
    }
}

// Update the original generateJournalEntry to not process themes
async function generateJournalEntry(
    messages: ParsedMessage[],
    dateString: string,
    apiKey: string
): Promise<JournalEntry> {
    const ai = new GoogleGenAI({ apiKey });

    // Get only user messages for quote matching
    const userMessages = messages.filter(msg => msg.sender === 'user');
    
    // Combine all messages into a single context
    const conversationContext = messages
        .map(msg => {
            if (msg.sender === 'user') {
                return `User Message: ${msg.text}`
            } else {
                return `ChatGPT Response(DO NOT USE THIS AS A QUOTE): ${msg.text}`
            }
        })
        .join('\n\n');

    // Create a prompt that guides the AI to generate a reflective journal entry
    const prompt = PromptLoader.getPromptText('journal/generate-entry', {
        dateString,
        conversationContext
    });

    // Retry mechanism with exponential backoff
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting to generate journal entry for ${dateString} (attempt ${attempt}/${maxRetries})`);
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: prompt,
                config: getSimpleJsonConfig(journalEntrySchema)
            });

            // If we get here, the request was successful
            const generatedContent = JSON.parse(response.text || '{}');

            // Ensure we have no more than 3 CBT prompts
            if (generatedContent.cbtPrompts && generatedContent.cbtPrompts.length > 3) {
                generatedContent.cbtPrompts = generatedContent.cbtPrompts.slice(0, 3);
            }
            
            // Filter emotional themes to ensure supporting quotes are from user messages
            if (generatedContent.emotionalSummary?.themes) {
                generatedContent.emotionalSummary.themes = generatedContent.emotionalSummary.themes.filter((theme: any) => {
                    return userMessages.some(msg => msg.text.includes(theme.supportingQuote));
                });
            }

            // Filter shadow traits to ensure supporting quotes are from user messages
            const shadowTraits = generatedContent.shadowTraits?.map((trait: any) => {
                let supportingQuote = null;

                if (trait.supportingQuote) {
                    // Find the user message that contains this quote or is most similar
                    const matchingMessage = userMessages.find(msg => 
                        msg.text.includes(trait.supportingQuote) || 
                        trait.supportingQuote.includes(msg.text.substring(0, 50)) ||
                        // Fuzzy matching for partial quotes
                        msg.text.toLowerCase().includes(trait.supportingQuote.toLowerCase().substring(0, 30))
                    );

                    if (matchingMessage) {
                        supportingQuote = {
                            text: trait.supportingQuote,
                            conversationId: matchingMessage.conversationId,
                            messageId: matchingMessage.messageId,
                            date: dateString
                        };
                    }
                }

                return {
                    name: trait.name,
                    description: trait.description,
                    reflectionPrompt: trait.reflectionPrompt,
                    supportingQuote: supportingQuote
                };
            }).filter((trait: any) => trait.supportingQuote !== null) || [];

            // Create the journal entry object (without emotional_themes for now)
            const journalEntry: JournalEntry = {
                id: crypto.randomUUID(),
                date: dateString,
                timestamp: Date.now(),
                ...generatedContent,
                emotional_themes: [], // Will be populated later in batch processing
                shadowTraits: shadowTraits,
                sourceConversationIds: new Set(messages.map(msg => msg.conversationId))
            };

            console.log(`Successfully generated journal entry for ${dateString}`);
            return journalEntry;

        } catch (error) {
            lastError = error as Error;
            console.error(`Attempt ${attempt} failed for ${dateString}:`, error);
            
            // If this is the last attempt, throw the error
            if (attempt === maxRetries) {
                console.error(`All ${maxRetries} attempts failed for ${dateString}. Throwing error.`);
                throw lastError;
            }
            
            // Calculate delay with exponential backoff (2s, 4s, 8s)
            const delay = Math.pow(2, attempt - 1) * 2000;
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Unexpected error in retry mechanism');
}

// Helper function to process all messages for a specific date
export async function processDateMessages(
    messagesByDate: MessagesByDate,
    dateString: string,
    apiKey: string
): Promise<JournalEntry | null> {
    const messages = messagesByDate[dateString];
    
    if (!messages || messages.length === 0) {
        return null;
    }

    try {
        return await generateJournalEntry(messages, dateString, apiKey);
    } catch (error) {
        console.error('Error generating journal entry:', error);
        throw error;
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Validate that we received conversation data
        if (!Array.isArray(body.conversations)) {
            console.error('Invalid request body. Expected conversations array.');
            return NextResponse.json(
                { error: 'Invalid request body. Expected conversations array.' },
                { status: 400 }
            );
        }
        if(!process.env.GEMINI_API_KEY){
            console.error('GOOGLE_GENERATIVE_AI_API_KEY is not defined in the environment variables');
            throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not defined in the environment variables');
        }

        // Extract analysis options (default to last 7 days)
        const analysisOptions = body.analysisOptions || {};
        const dayLimit = analysisOptions.dayLimit || 7;

        // Extract API key from request body (optional)
        const apiKey = process.env.GEMINI_API_KEY
        // Parse the conversations with day limit (now async)
        const result = await parseConversations(body.conversations, apiKey, dayLimit);

        // Return the parsed results
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error processing conversations:', error);
        return NextResponse.json(
            { error: 'Failed to process conversations' },
            { status: 500 }
        );
    }
}
