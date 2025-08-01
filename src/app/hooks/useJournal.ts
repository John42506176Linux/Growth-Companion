import { useState, useEffect } from 'react';
import { ParseResult, ParsedMessage, JournalEntry, ProcessedData } from '@/app/lib/data';
import { indexedDBStorage } from '@/app/lib/indexedDB';

const LEGACY_STORAGE_KEY = 'processedJournal';

// Helper function to convert old format to new format
function convertOldFormatToNew(oldData: any): ParseResult {
    return {
        conversations: {
            conversations: oldData.messages.map((msg: any) => ({
                id: msg.conversationId,
                messages: [msg],
                metadata: {
                    createdAt: msg.timestamp,
                    updatedAt: msg.timestamp
                }
            }))
        },
        journalEntries: {
            entries: [],
            stats: {
                totalEntries: 0,
                dateRange: null
            }
        }
    };
}

export function useJournal() {
    // State for the parsed data
    const [journalData, setJournalData] = useState<ProcessedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load data from IndexedDB on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                // Try to load from IndexedDB first

                const indexedData = await indexedDBStorage.getJournalData();
                
                if (indexedData) {
                    setJournalData(indexedData);
                    setLoading(false);
                    return;
                }

                // If no IndexedDB data, check for legacy localStorage data
                const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
                if (legacyData) {
                    const parsedData = JSON.parse(legacyData);
                    
                    // Check if data is in old format (has messages array)
                    if (Array.isArray(parsedData.messages)) {
                        // Convert old format to new format
                        const newFormatData = convertOldFormatToNew(parsedData);
                        setJournalData(newFormatData);
                        // Migrate to IndexedDB
                        await indexedDBStorage.saveJournalData(newFormatData);
                    } else {
                        // Data is already in new format
                        // Convert date strings back to Date objects in messages
                        if (parsedData.conversations && parsedData.conversations.conversations) {
                            parsedData.conversations.conversations.forEach((conv: any) => {
                                conv.messages = conv.messages.map((msg: any) => ({
                                    ...msg,
                                    date: new Date(msg.date)
                                }));
                            });
                            
                            // Convert date strings back to Date objects in memory data
                            if (parsedData.memoryData) {
                                const memoryData = parsedData.memoryData;
                                
                                // Convert dates in people
                                if (memoryData.people) {
                                    memoryData.people.forEach((person: any) => {
                                        person.firstMentioned = new Date(person.firstMentioned);
                                        person.lastMentioned = new Date(person.lastMentioned);
                                        if (person.extractedFrom) {
                                            person.extractedFrom.forEach((ref: any) => {
                                                ref.date = new Date(ref.date);
                                            });
                                        }
                                    });
                                }
                                
                                // Convert dates in places
                                if (memoryData.places) {
                                    memoryData.places.forEach((place: any) => {
                                        place.firstMentioned = new Date(place.firstMentioned);
                                        place.lastMentioned = new Date(place.lastMentioned);
                                        if (place.extractedFrom) {
                                            place.extractedFrom.forEach((ref: any) => {
                                                ref.date = new Date(ref.date);
                                            });
                                        }
                                    });
                                }
                                
                                // Convert dates in events
                                if (memoryData.events) {
                                    memoryData.events.forEach((event: any) => {
                                        event.firstMentioned = new Date(event.firstMentioned);
                                        event.lastMentioned = new Date(event.lastMentioned);
                                        if (event.extractedFrom) {
                                            event.extractedFrom.forEach((ref: any) => {
                                                ref.date = new Date(ref.date);
                                            });
                                        }
                                    });
                                }
                                
                                // Convert dates in goals
                                if (memoryData.goals) {
                                    memoryData.goals.forEach((goal: any) => {
                                        goal.firstMentioned = new Date(goal.firstMentioned);
                                        goal.lastMentioned = new Date(goal.lastMentioned);
                                        if (goal.targetDate) goal.targetDate = new Date(goal.targetDate);
                                        if (goal.startedDate) goal.startedDate = new Date(goal.startedDate);
                                        if (goal.completedDate) goal.completedDate = new Date(goal.completedDate);
                                        if (goal.extractedFrom) {
                                            goal.extractedFrom.forEach((ref: any) => {
                                                ref.date = new Date(ref.date);
                                            });
                                        }
                                    });
                                }
                                
                                // Convert dates in general memories
                                if (memoryData.generalMemories) {
                                    memoryData.generalMemories.forEach((memory: any) => {
                                        if (memory.extractedFrom) {
                                            memory.extractedFrom.forEach((ref: any) => {
                                                ref.date = new Date(ref.date);
                                            });
                                        }
                                    });
                                }
                            }
                            
                            setJournalData(parsedData);
                            // Migrate to IndexedDB
                            await indexedDBStorage.saveJournalData(parsedData);
                        } else {
                            // Data structure is invalid, clear it
                            console.warn('Invalid data structure found in localStorage, clearing...');
                        }
                    }
                    
                    // Clear legacy localStorage after migration
                    localStorage.removeItem(LEGACY_STORAGE_KEY);
                }
            } catch (err) {
                setError('Failed to load journal data from storage');
                console.error('Error loading journal data:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Function to save new journal data
    const saveJournalData = async (data: ParseResult) => {
        try {
            setJournalData(data);
            await indexedDBStorage.saveJournalData(data);
            setError(null);
        } catch (err) {
            setError('Failed to save journal data');
            console.error('Error saving journal data:', err);
        }
    };

    // Function to clear journal data
    const clearJournalData = async () => {
        try {
            setJournalData(null);
            await indexedDBStorage.clearJournalData();
            setError(null);
        } catch (err) {
            setError('Failed to clear journal data');
            console.error('Error clearing journal data:', err);
        }
    };

    // Helper functions for filtering and accessing data
    const getMessagesByDate = (dateString: string): ParsedMessage[] => {
        return journalData?.conversations.conversations
            .flatMap(conv => conv.messages)
            .filter(msg => msg.dateString === dateString) || [];
    };

    const getDateRange = (): string[] => {
        if (!journalData) return [];
        
        const dates = new Set<string>();
        journalData.conversations.conversations.forEach(conv => {
            conv.messages.forEach(msg => {
                dates.add(msg.dateString);
            });
        });
        return Array.from(dates).sort();
    };

    const getMessagesBySender = (senderType: string): ParsedMessage[] => {
        return journalData?.conversations.conversations
            .flatMap(conv => conv.messages)
            .filter(msg => msg.sender === senderType) || [];
    };

    const getJournalEntries = (): JournalEntry[] => {
        return journalData?.journalEntries.entries || [];
    };

    const getJournalEntryByDate = (dateString: string): JournalEntry | undefined => {
        return journalData?.journalEntries.entries.find(entry => entry.date === dateString);
    };

    const getThemeAnalysis = () => {
        return journalData?.themeAnalysis;
    };

    const getShadowTraitAnalysis = () => {
        return journalData?.shadowTraitAnalysis;
    };

    const getMemoryData = () => {
        return journalData?.memoryData;
    };

    return {
        journalData,
        loading,
        error,
        saveJournalData,
        clearJournalData,
        getMessagesByDate,
        getDateRange,
        getMessagesBySender,
        getJournalEntries,
        getJournalEntryByDate,
        getThemeAnalysis,
        getShadowTraitAnalysis,
        getMemoryData
    };
} 