'use client';

import { useJournal } from '../hooks/useJournal';
import { useState } from 'react';
import { JournalEntry, EmotionalSummary, ThemeResponse, ThemeWithQuote, ChatMessage, ParsedMessage, ShadowTraitResponse, ShadowClusterResult, Conversations, ReflectionSession } from '@/app/lib/data';
import ReactMarkdown from 'react-markdown';
import ReflectionModal from '../components/ReflectionModal';
import StorageInfo from '../components/StorageInfo';
import { indexedDBStorage } from '../lib/indexedDB';
import MemoriesDisplay from '../components/MemoriesDisplay';
import ReflectionHistory from '../components/ReflectionHistory';

type ViewMode = 'conversations' | 'journal';

export default function Dashboard() {
    const { 
        journalData, 
        loading, 
        error, 
        getDateRange, 
        getMessagesByDate,
        getJournalEntryByDate,
        getThemeAnalysis,
        getShadowTraitAnalysis,
        getMemoryData,
        clearJournalData
    } = useJournal();
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [viewMode, setViewMode] = useState<ViewMode>('conversations');
    const [highlightedMessageId, setHighlightedMessageId] = useState<string>('');

    // Add state for collapsible sections
    const [collapsedSections, setCollapsedSections] = useState({
        cbt: true,
        shadow: true,
        decisions: true,
        failures: true,
        nextSteps: true,
        reflections: true
    });

    // Add state for reflection modal
    const [reflectionModal, setReflectionModal] = useState<{
        isOpen: boolean;
        theme: ThemeWithQuote | null;
        conversationHistory: ParsedMessage[];
        allSupportingQuotes: string[];
        reflectionType: 'emotionalclusterreflection' | 'shadowclusterreflection' | 'cbtreflection' | 'shadowreflection';
        journalConversationHistory: ParsedMessage[];
    }>({
        isOpen: false,
        theme: null,
        conversationHistory: [],
        allSupportingQuotes: [],
        reflectionType: 'emotionalclusterreflection',
        journalConversationHistory: [],
    });

    // Add state for current reflection session
    const [currentReflectionSession, setCurrentReflectionSession] = useState<ReflectionSession | null>(null);

    // Toggle function for sections
    const toggleSection = (section: keyof typeof collapsedSections) => {
        setCollapsedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Reflection modal handlers
    const openReflectionModal = (theme: ThemeWithQuote) => {
        // Get the current journal entry to provide full context
        const currentJournalEntry = selectedDate ? getJournalEntryByDate(selectedDate) : undefined;
        const conversationHistory = selectedDate ? getMessagesByDate(selectedDate) : [];
        
        // Find all supporting quotes for similar themes
        const allSupportingQuotes = currentJournalEntry?.emotionalSummary?.themes
            .filter(t => t.theme.toLowerCase().includes(theme.theme.toLowerCase()) || 
                        theme.theme.toLowerCase().includes(t.theme.toLowerCase()))
            .map(t => t.supportingQuote) || [];

        setReflectionModal({
            isOpen: true,
            theme: theme,
            conversationHistory: conversationHistory,
            allSupportingQuotes: allSupportingQuotes,
            reflectionType: 'emotionalclusterreflection',
            journalConversationHistory: getLast5DaysConversations(),
        });
    };

    const openOverallReflectionModal = () => {
        const themeAnalysis = getThemeAnalysis();
        
        if (!themeAnalysis || !themeAnalysis.clusters || themeAnalysis.clusters.length === 0) {
            console.log('No theme analysis available');
            return;
        }

        // Collect all themes and supporting quotes across all clusters
        const allThemes = themeAnalysis.clusters.flatMap(cluster => cluster.themes);
        const allSupportingQuotes = themeAnalysis.clusters.flatMap(cluster => 
            cluster.representative_themes.map(rt => rt.supportingQuote)
        );

        // Create a comprehensive theme summary
        const clusterSummary = themeAnalysis.clusters.map(cluster => 
            `${cluster.label}: ${cluster.description}`
        ).join('\n\n');

        // Create a synthetic theme that represents the overall emotional journey
        const overallTheme: ThemeWithQuote = {
            theme: `Overall Emotional Patterns`,
            supportingQuote: allSupportingQuotes.slice(0, 3).join(' | '), // Show first 3 quotes as preview
            description: `Looking at your emotional patterns across all conversations, here's what emerges:\n\n${clusterSummary}\n\nLet's explore these patterns and how they might be connected.`
        };

        // Get all conversation history from all journal entries
        const allConversationHistory: ParsedMessage[] = [];
        if (journalData?.journalEntries?.entries) {
            journalData.journalEntries.entries.forEach(entry => {
                const messages = getMessagesByDate(entry.date);
                allConversationHistory.push(...messages);
            });
        }

        setReflectionModal({
            isOpen: true,
            theme: overallTheme,
            conversationHistory: allConversationHistory,
            allSupportingQuotes: allSupportingQuotes,
            reflectionType: 'emotionalclusterreflection',
            journalConversationHistory: getLast5DaysConversations()
        });
    };

    const closeReflectionModal = () => {
        setReflectionModal({
            isOpen: false,
            theme: null,
            conversationHistory: [],
            allSupportingQuotes: [],
            reflectionType: 'emotionalclusterreflection',
            journalConversationHistory: []
        });
        setCurrentReflectionSession(null);
    };

    const handleSaveReflection = async (messages: ChatMessage[]) => {
        if (!currentReflectionSession) {
            console.log('No current reflection session to save');
            closeReflectionModal();
            return;
        }

        try {
            // Complete the reflection session
            const completedSession: ReflectionSession = {
                ...currentReflectionSession,
                messages: messages,
                completedAt: Date.now(),
                status: 'completed'
            };

            // Save to IndexedDB
            await indexedDBStorage.saveReflectionSession(completedSession);
            console.log('Reflection session saved successfully:', completedSession);
            
            closeReflectionModal();
        } catch (error) {
            console.error('Failed to save reflection session:', error);
            // Still close the modal even if saving fails
            closeReflectionModal();
        }
    };

    const handleAutoSave = async (messages: ChatMessage[]) => {
        if (!currentReflectionSession) {
            console.log('No current reflection session to auto-save');
            return;
        }

        try {
            // Update the reflection session with current messages
            const updatedSession: ReflectionSession = {
                ...currentReflectionSession,
                messages: messages,
                status: 'active'
            };

            // Save to IndexedDB
            await indexedDBStorage.saveReflectionSession(updatedSession);
            console.log('Reflection session auto-saved:', updatedSession);
        } catch (error) {
            console.error('Failed to auto-save reflection session:', error);
        }
    };

    // Collapsible Section Component
    const CollapsibleSection = ({ 
        id, 
        title, 
        bgColor, 
        titleColor, 
        children, 
        defaultOpen = false 
    }: {
        id: keyof typeof collapsedSections;
        title: string;
        bgColor: string;
        titleColor: string;
        children: React.ReactNode;
        defaultOpen?: boolean;
    }) => {
        const isOpen = !collapsedSections[id];
        
        return (
            <div className={`${bgColor} rounded-lg mb-4`}>
                <button
                    onClick={() => toggleSection(id)}
                    className={`w-full p-4 text-left flex items-center justify-between hover:opacity-80 transition-opacity`}
                >
                    <h3 className={`text-lg font-medium ${titleColor}`}>{title}</h3>
                    <span className={`text-sm ${titleColor} transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                        ▶
                    </span>
                </button>
                
                {isOpen && (
                    <div className="px-4 pb-4">
                        {children}
                    </div>
                )}
            </div>
        );
    };

    // Simple markdown renderer for basic formatting
    const renderMarkdown = (text: string) => {
        return text
            .split('\n\n')
            .map((paragraph, index) => {
                // Handle bold text **text**
                const boldFormatted = paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                // Handle italic text *text*
                const italicFormatted = boldFormatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
                
                return (
                    <p 
                        key={index} 
                        className="mb-4 last:mb-0 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: italicFormatted }}
                    />
                );
            });
    };

    // Add function to navigate to specific date
    const navigateToJournalEntry = (date: string) => {
        setSelectedDate(date);
        setViewMode('journal');
        setHighlightedMessageId(''); // Clear any message highlighting
    };

    // Add function to navigate to conversation with highlighting
    const navigateToConversation = (date: string, messageId: string) => {
        setSelectedDate(date);
        setViewMode('conversations');
        setHighlightedMessageId(messageId);
    };

    // Helper function to get last N days of conversations (default 5 for backward compatibility)
    const getLastNDaysConversations = (days: number = 5): ParsedMessage[] => {
        const dates = getDateRange();
        const lastNDates = dates.slice(-days); // Get last N dates
        const lastNDaysMessages: ParsedMessage[] = [];
        
        lastNDates.forEach(date => {
            const messagesForDate = getMessagesByDate(date);
            lastNDaysMessages.push(...messagesForDate);
        });
        
        return lastNDaysMessages;
    };

    // Keep the old function for backward compatibility
    const getLast5DaysConversations = (): ParsedMessage[] => {
        return getLastNDaysConversations(5);
    };

    const openClusterReflectionModal = (cluster: any) => {
        // Get all supporting quotes from this cluster
        const clusterSupportingQuotes = cluster.representative_themes.map((rt: any) => rt.supportingQuote);
        
        // Get conversation histories for all supporting quotes in this cluster
        const relevantConversationHistory: ParsedMessage[] = [];
        if (journalData?.journalEntries?.entries) {
            journalData.journalEntries.entries.forEach(entry => {
                const messages = getMessagesByDate(entry.date);
                // Find messages that contain any of the supporting quotes from this cluster
                const relevantMessages = messages.filter(msg => 
                    clusterSupportingQuotes.some((quote: string) => 
                        msg.text.includes(quote) || quote.includes(msg.text.substring(0, 50))
                    )
                );
                relevantConversationHistory.push(...relevantMessages);
            });
        }

        // Create a theme object for this cluster
        const clusterTheme: ThemeWithQuote = {
            theme: cluster.label,
            supportingQuote: clusterSupportingQuotes.slice(0, 2).join(' | '), // Show first 2 quotes as preview
            description: `${cluster.description}

Some of the things you've said that show this are:
${clusterSupportingQuotes.slice(0, 2).map((quote: string, index: number) => `• "${quote.length > 60 ? quote.substring(0, 60) + '...' : quote}"`).join('\n')}${clusterSupportingQuotes.length > 2 ? '\n• ...' : ''}`
        };

        setReflectionModal({
            isOpen: true,
            theme: clusterTheme,
            conversationHistory: relevantConversationHistory,
            allSupportingQuotes: clusterSupportingQuotes,
            reflectionType: 'emotionalclusterreflection',
            journalConversationHistory: getLast5DaysConversations()
        });
    };

    const openShadowClusterReflectionModal = (cluster: ShadowClusterResult) => {
        // Get all supporting quotes from this shadow cluster
        const clusterSupportingQuotes = cluster.representative_traits.map((rt: any) => rt.supportingQuote);
        
        // Get conversation histories for all supporting quotes in this cluster
        const relevantConversationHistory: ParsedMessage[] = [];
        if (journalData?.journalEntries?.entries) {
            journalData.journalEntries.entries.forEach(entry => {
                const messages = getMessagesByDate(entry.date);
                // Find messages that contain any of the supporting quotes from this cluster
                const relevantMessages = messages.filter(msg => 
                    clusterSupportingQuotes.some((quote: string) => 
                        msg.text.includes(quote) || quote.includes(msg.text.substring(0, 50))
                    )
                );
                relevantConversationHistory.push(...relevantMessages);
            });
        }

        // Create a theme object for this shadow cluster
        const clusterTheme: ThemeWithQuote = {
            theme: cluster.label,
            supportingQuote: clusterSupportingQuotes.slice(0, 2).join(' | '), // Show first 2 quotes as preview
            description: `${cluster.description}

Some of the things you've said that show this pattern are:
${clusterSupportingQuotes.slice(0, 2).map((quote: string, index: number) => `• "${quote.length > 60 ? quote.substring(0, 60) + '...' : quote}"`).join('\n')}${clusterSupportingQuotes.length > 2 ? '\n• ...' : ''}`
        };

        setReflectionModal({
            isOpen: true,
            theme: clusterTheme,
            conversationHistory: relevantConversationHistory,
            allSupportingQuotes: clusterSupportingQuotes,
            journalConversationHistory: getLast5DaysConversations(),
            reflectionType: 'shadowclusterreflection',
            
        });
    };

    const openCBTReflectionModal = (cbtPrompt: any) => {
        // Get the current journal entry to provide context
        const currentJournalEntry = selectedDate ? getJournalEntryByDate(selectedDate) : undefined;
        const conversationHistory = selectedDate ? getMessagesByDate(selectedDate) : [];
        
        // Create a theme object for this CBT question
        const cbtTheme: ThemeWithQuote = {
            theme: cbtPrompt.category,
            supportingQuote: cbtPrompt.question,
            description: `${cbtPrompt.purpose}

This reflection question is designed to help you explore your thoughts, emotions, and behaviors more deeply based on what happened in your conversations today.`
        };

        // Create a new reflection session
        const newReflectionSession: ReflectionSession = {
            id: crypto.randomUUID(),
            themeId: cbtPrompt.category || 'cbt-reflection',
            theme: cbtPrompt.category,
            supportingQuote: cbtPrompt.question,
            messages: [],
            startedAt: Date.now(),
            status: 'active',
            reflectionType: 'cbtreflection',
            dateString: selectedDate || new Date().toISOString().split('T')[0]
        };

        setCurrentReflectionSession(newReflectionSession);

        setReflectionModal({
            isOpen: true,
            theme: cbtTheme,
            conversationHistory: conversationHistory,
            allSupportingQuotes: [cbtPrompt.question],
            reflectionType: 'cbtreflection',
            journalConversationHistory: getLast5DaysConversations()
        });
    };

    const openShadowReflectionModal = (shadowTrait: any) => {
        // Get the current journal entry to provide context
        const currentJournalEntry = selectedDate ? getJournalEntryByDate(selectedDate) : undefined;
        const conversationHistory = selectedDate ? getMessagesByDate(selectedDate) : [];
        
        // Create a theme object for this shadow trait reflection
        const shadowTheme: ThemeWithQuote = {
            theme: shadowTrait.name,
            supportingQuote: shadowTrait.reflectionPrompt,
            description: `${shadowTrait.description}

This reflection question is designed to help you explore and integrate this shadow pattern with compassion and understanding.`
        };

        // Create a new reflection session
        const newReflectionSession: ReflectionSession = {
            id: crypto.randomUUID(),
            themeId: shadowTrait.name || 'shadow-reflection',
            theme: shadowTrait.name,
            supportingQuote: shadowTrait.reflectionPrompt,
            messages: [],
            startedAt: Date.now(),
            status: 'active',
            reflectionType: 'shadowreflection',
            dateString: selectedDate || new Date().toISOString().split('T')[0]
        };

        setCurrentReflectionSession(newReflectionSession);

        setReflectionModal({
            isOpen: true,
            theme: shadowTheme,
            conversationHistory: conversationHistory,
            allSupportingQuotes: [shadowTrait.reflectionPrompt],
            reflectionType: 'shadowreflection',
            journalConversationHistory: getLast5DaysConversations()
        });
    };

    const openExistingReflectionSession = (session: ReflectionSession) => {
        // Get the conversation history for the date this session was created
        const sessionDate = session.dateString;
        const conversationHistory = getMessagesByDate(sessionDate);
        
        // Create a theme object from the session
        const sessionTheme: ThemeWithQuote = {
            theme: session.theme,
            supportingQuote: session.supportingQuote,
            description: `Previous reflection session from ${sessionDate}`
        };

        // Set the current session (for continuation or viewing)
        setCurrentReflectionSession(session);

        setReflectionModal({
            isOpen: true,
            theme: sessionTheme,
            conversationHistory: conversationHistory,
            allSupportingQuotes: [session.supportingQuote],
            reflectionType: session.reflectionType,
            journalConversationHistory: getLast5DaysConversations()
        });
    };

    const handleClearData = async () => {
        if (window.confirm('Are you sure you want to clear all journal data? This action cannot be undone.')) {
            await clearJournalData();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading your journal...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    if (!journalData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">No Journal Data</h2>
                    <p className="text-gray-600 mb-6">Upload your ChatGPT conversations to get started.</p>
                    <a
                        href="/"
                        className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                        Upload Conversations
                    </a>
                </div>
            </div>
        );
    }

    const dates = getDateRange();
    const messages = selectedDate ? getMessagesByDate(selectedDate) : [];
    const journalEntry = selectedDate ? getJournalEntryByDate(selectedDate) : undefined;
    const themeAnalysis = getThemeAnalysis();
    const shadowTraitAnalysis = getShadowTraitAnalysis();
    const memoryData = getMemoryData();

    // Updated Emotional Summary component with spectrum and themes
    const EmotionalSummaryCard = ({ emotionalSummary }: { emotionalSummary: EmotionalSummary }) => {
        const { colors, label, description, themes } = emotionalSummary;
        
        // Create gradient from colors array
        const gradientStyle = colors.length > 1 
            ? `linear-gradient(135deg, ${colors.join(', ')})`
            : colors[0];
        
        // Create background tint using first color
        const backgroundTint = `${colors[0]}15`;
        
        return (
            <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: backgroundTint }}>
                <div className="flex items-center space-x-4">
                    {/* Color spectrum indicator */}
                    <div className="flex flex-col items-center space-y-2">
                        <div 
                            className="w-12 h-8 rounded-full border-2 border-white shadow-md"
                            style={{ background: gradientStyle }}
                        />
                        {colors.length > 1 && (
                            <div className="flex space-x-1">
                                {colors.map((color, index) => (
                                    <div
                                        key={index}
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Label, description, and themes */}
                    <div className="flex-1">
                        <h3 
                            className="text-lg font-bold mb-1" 
                            style={{ color: colors[0] }}
                        >
                            {label}
                        </h3>

                        
                        {/* Description shown by default */}
                        {description && (
                            <p className="text-sm text-gray-600 italic">
                                {description}
                            </p>
                        )}
            
                    </div>
                </div>
            </div>
        );
    };

    // Enhanced Theme Analysis component with color graphs
    const ThemeAnalysisSection = ({ analysis }: { analysis: ThemeResponse }) => {
        // Calculate relative sizes for visual representation
        const maxClusterSize = Math.max(...analysis.clusters.map(c => c.total_themes_in_cluster));
        
        return (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-purple-800">Emotional Theme Patterns</h2>
                    <div className="flex items-center space-x-4">
                        <div className="text-sm text-purple-600">
                            {analysis.total_themes} themes • {analysis.num_clusters} clusters
                        </div>
                        <button
                            onClick={openOverallReflectionModal}
                            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-sm px-4 py-2 rounded-full transition-all duration-200 flex items-center space-x-2 shadow-md"
                        >
                            <span>🧠</span>
                            <span>Reflect on Patterns</span>
                        </button>
                    </div>
                </div>
                
                {/* Cluster Overview with Size Visualization */}
                <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-lg">
                    <span className="text-sm font-medium text-gray-600 mr-2">Cluster sizes:</span>
                    {analysis.clusters.map((cluster) => {
                        const relativeSize = (cluster.total_themes_in_cluster / maxClusterSize) * 100;
                        const circleSize = Math.max(20, (relativeSize / 100) * 40); // Min 20px, max 40px
                        
                        return (
                            <div key={cluster.cluster_id} className="flex items-center gap-2">
                                <div
                                    className="rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold"
                                    style={{
                                        backgroundColor: cluster.color,
                                        width: `${circleSize}px`,
                                        height: `${circleSize}px`,
                                        fontSize: `${Math.max(8, circleSize / 4)}px`
                                    }}
                                >
                                    {cluster.total_themes_in_cluster}
                                </div>
                                <span className="text-xs text-gray-600">{cluster.label}</span>
                            </div>
                        );
                    })}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysis.clusters.map((cluster) => (
                        <div key={cluster.cluster_id} className="bg-white p-4 rounded-lg border shadow-sm">
                            {/* Cluster Header with Color Bar */}
                            <div className="mb-4">
                                <div 
                                    className="h-2 rounded-full mb-3"
                                    style={{ backgroundColor: cluster.color }}
                                />
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold" style={{ color: cluster.color }}>
                                        {cluster.label}
                                    </h3>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                                            {cluster.total_themes_in_cluster} themes
                                        </span>
                                        <button
                                            onClick={() => openClusterReflectionModal(cluster)}
                                            className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded-full transition-colors duration-200 flex items-center space-x-1"
                                        >
                                            <span>💭</span>
                                            <span>Reflect</span>
                                        </button>
                                    </div>
                                </div>
                                {/* Cluster description */}
                                <p className="text-sm text-gray-600 mb-3">{cluster.description}</p>
                            </div>
                            
                            {/* Representative Themes with Distance Visualization */}
                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-gray-600 mb-2">Key Themes:</h4>
                                <div className="space-y-2">
                                    {cluster.representative_themes.map((repTheme, index) => {
                                        // Convert distance to visual indicator (closer = more opaque)
                                        const opacity = Math.max(0.3, 1 - (repTheme.distance_to_center / 2));
                                        
                                        // Find the journal entry that contains this quote
                                        const findQuoteSource = (quote: string) => {
                                            if (!journalData?.journalEntries?.entries) return null;
                                            
                                            for (const entry of journalData.journalEntries.entries) {
                                                const messages = getMessagesByDate(entry.date);
                                                const matchingMessage = messages.find(msg => 
                                                    msg.text.includes(quote) || quote.includes(msg.text.substring(0, 50))
                                                );
                                                if (matchingMessage) {
                                                    return { date: entry.date, messageId: matchingMessage.messageId };
                                                }
                                            }
                                            return null;
                                        };
                                        
                                        const quoteSource = findQuoteSource(repTheme.supportingQuote);
                                        
                                        return (
                                            <div key={index} className="bg-white bg-opacity-70 p-3 rounded">
                                                <blockquote className="text-xs text-gray-600 italic pl-2 border-l-2 mb-2" style={{ borderColor: cluster.color }}>
                                                    "{repTheme.supportingQuote}"
                                                </blockquote>
                                                {quoteSource && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => navigateToJournalEntry(quoteSource.date)}
                                                            className="text-xs text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors"
                                                        >
                                                            View journal entry →
                                                        </button>
                                                        <button
                                                            onClick={() => navigateToConversation(quoteSource.date, quoteSource.messageId)}
                                                            className="text-xs text-purple-600 hover:text-purple-800 underline hover:no-underline transition-colors"
                                                        >
                                                            View in conversation →
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* All Themes (collapsed view) */}
                            <details className="group">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 mb-2">
                                    View all {cluster.themes.length} themes ▼
                                </summary>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {cluster.themes.map((theme, index) => (
                                        <span
                                            key={index}
                                            className="text-xs px-2 py-1 rounded border"
                                            style={{ 
                                                backgroundColor: `${cluster.color}15`,
                                                borderColor: `${cluster.color}40`,
                                                color: cluster.color
                                            }}
                                        >
                                            {theme}
                                        </span>
                                    ))}
                                </div>
                            </details>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const ShadowTraitAnalysisSection = ({ analysis }: { analysis: ShadowTraitResponse }) => {
        // Calculate relative sizes for visual representation
        const maxClusterSize = Math.max(...analysis.clusters.map(c => c.total_traits_in_cluster));
        
        return (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-lg mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-orange-800">Shadow Trait Patterns</h2>
                    <div className="flex items-center space-x-4">
                        <div className="text-sm text-orange-600">
                            {analysis.total_traits} traits • {analysis.num_clusters} clusters
                        </div>
                        <button
                            onClick={() => {
                                // Create overall shadow trait reflection
                                const allSupportingQuotes = analysis.clusters.flatMap(cluster => 
                                    cluster.representative_traits.map(rt => rt.supportingQuote)
                                );
                                
                                const clusterSummary = analysis.clusters.map(cluster => 
                                    `${cluster.label}: ${cluster.description}`
                                ).join('\n\n');

                                const overallTheme: ThemeWithQuote = {
                                    theme: `Overall Shadow Patterns`,
                                    supportingQuote: allSupportingQuotes.slice(0, 3).join(' | '),
                                    description: `Looking at your shadow patterns across all conversations, here's what emerges:\n\n${clusterSummary}\n\nLet's explore these patterns and how they might be limiting you.`
                                };

                                const allConversationHistory: ParsedMessage[] = [];
                                if (journalData?.journalEntries?.entries) {
                                    journalData.journalEntries.entries.forEach(entry => {
                                        const messages = getMessagesByDate(entry.date);
                                        allConversationHistory.push(...messages);
                                    });
                                }

                                setReflectionModal({
                                    reflectionType: 'shadowclusterreflection',
                                    isOpen: true,
                                    theme: overallTheme,
                                    conversationHistory: allConversationHistory,
                                    allSupportingQuotes: allSupportingQuotes,
                                    journalConversationHistory: getLast5DaysConversations()
                                });
                            }}
                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm px-4 py-2 rounded-full transition-all duration-200 flex items-center space-x-2 shadow-md"
                        >
                            <span>🌑</span>
                            <span>Reflect on Shadow Patterns</span>
                        </button>
                    </div>
                </div>
                
                {/* Cluster Overview with Size Visualization */}
                <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-lg">
                    <span className="text-sm font-medium text-gray-600 mr-2">Cluster sizes:</span>
                    {analysis.clusters.map((cluster) => {
                        const relativeSize = (cluster.total_traits_in_cluster / maxClusterSize) * 100;
                        const circleSize = Math.max(20, (relativeSize / 100) * 40); // Min 20px, max 40px
                        
                        return (
                            <div key={cluster.cluster_id} className="flex items-center gap-2">
                                <div
                                    className="rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold"
                                    style={{
                                        backgroundColor: cluster.color,
                                        width: `${circleSize}px`,
                                        height: `${circleSize}px`,
                                        fontSize: `${Math.max(8, circleSize / 4)}px`
                                    }}
                                >
                                    {cluster.total_traits_in_cluster}
                                </div>
                                <span className="text-xs text-gray-600">{cluster.label}</span>
                            </div>
                        );
                    })}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysis.clusters.map((cluster) => (
                        <div key={cluster.cluster_id} className="bg-white p-4 rounded-lg border shadow-sm">
                            {/* Cluster Header with Color Bar */}
                            <div className="mb-4">
                                <div 
                                    className="h-2 rounded-full mb-3"
                                    style={{ backgroundColor: cluster.color }}
                                />
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold" style={{ color: cluster.color }}>
                                        {cluster.label}
                                    </h3>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                                            {cluster.total_traits_in_cluster} traits
                                        </span>
                                        <button
                                            onClick={() => openShadowClusterReflectionModal(cluster)}
                                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-2 py-1 rounded-full transition-colors duration-200 flex items-center space-x-1"
                                        >
                                            <span>🌑</span>
                                            <span>Reflect</span>
                                        </button>
                                    </div>
                                </div>
                                {/* Cluster description */}
                                <p className="text-sm text-gray-600 mb-3">{cluster.description}</p>
                            </div>
                            
                            {/* Representative Traits with Distance Visualization */}
                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-gray-600 mb-2">Key Traits:</h4>
                                <div className="space-y-2">
                                    {cluster.representative_traits.map((repTrait, index) => {
                                        // Find the journal entry that contains this quote
                                        const findQuoteSource = (quote: string) => {
                                            if (!journalData?.journalEntries?.entries) return null;
                                            
                                            for (const entry of journalData.journalEntries.entries) {
                                                const messages = getMessagesByDate(entry.date);
                                                const matchingMessage = messages.find(msg => 
                                                    msg.text.includes(quote) || quote.includes(msg.text.substring(0, 50))
                                                );
                                                if (matchingMessage) {
                                                    return { date: entry.date, messageId: matchingMessage.messageId };
                                                }
                                            }
                                            return null;
                                        };
                                        
                                        const quoteSource = findQuoteSource(repTrait.supportingQuote);
                                        const truncatedQuote = repTrait.supportingQuote.length > 60 ? 
                                            repTrait.supportingQuote.substring(0, 60) + '...' : 
                                            repTrait.supportingQuote;
                                        
                                        return (
                                            <div key={index} className="bg-white bg-opacity-70 p-3 rounded">
                                                <div className="text-sm text-gray-600 mb-3">{repTrait.trait}</div>
                                                <blockquote className="text-xs text-gray-600 italic pl-2 border-l-2 mb-2" style={{ borderColor: cluster.color }}>
                                                    "{truncatedQuote}"
                                                </blockquote>
                                                {quoteSource && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => navigateToJournalEntry(quoteSource.date)}
                                                            className="text-xs text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors"
                                                        >
                                                            View journal entry →
                                                        </button>
                                                        <button
                                                            onClick={() => navigateToConversation(quoteSource.date, quoteSource.messageId)}
                                                            className="text-xs text-orange-600 hover:text-orange-800 underline hover:no-underline transition-colors"
                                                        >
                                                            View in conversation →
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* All Traits (collapsed view) */}
                            <details className="group">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 mb-2">
                                    View all {cluster.traits.length} traits ▼
                                </summary>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {cluster.traits.map((trait, index) => (
                                        <span
                                            key={index}
                                            className="text-xs px-2 py-1 rounded border"
                                            style={{ 
                                                backgroundColor: `${cluster.color}15`,
                                                borderColor: `${cluster.color}40`,
                                                color: cluster.color
                                            }}
                                        >
                                            {trait}
                                        </span>
                                    ))}
                                </div>
                            </details>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="container mx-auto px-4 py-8">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-3xl font-bold text-gray-800">Your Journal</h1>
                        <div className="w-64">
                            <StorageInfo onClearData={handleClearData} />
                        </div>
                    </div>
                    
                    {/* Theme Analysis Section - shown at top */}
                    {themeAnalysis && !selectedDate && (
                        <ThemeAnalysisSection analysis={themeAnalysis} />
                    )}
                    
                    {/* Shadow Trait Analysis Section - shown at top */}
                    {shadowTraitAnalysis && !selectedDate && (
                        <ShadowTraitAnalysisSection analysis={shadowTraitAnalysis} />
                    )}
                    
                    {/* Memories Section - shown at top */}
                    {memoryData && !selectedDate && (
                        <MemoriesDisplay memoryData={memoryData} />
                    )}
                    
                    {/* Date selector */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Date
                        </label>
                        <select
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">Select a date</option>
                            {dates.map((date) => (
                                <option key={date} value={date}>
                                    {new Date(date).toLocaleDateString()}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* View mode tabs */}
                    <div className="mb-6 border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setViewMode('conversations')}
                                className={`${
                                    viewMode === 'conversations'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Conversations
                            </button>
                            <button
                                onClick={() => setViewMode('journal')}
                                className={`${
                                    viewMode === 'journal'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Journal Entry
                            </button>
                        </nav>
                    </div>

                    {/* Content display */}
                    {selectedDate && (
                        <div className="space-y-6">
                            {viewMode === 'conversations' ? (
                                // Conversations view
                                <div className="space-y-4">
                                    {messages.map((message) => (
                                        <div
                                            key={message.messageId}
                                            className={`p-4 rounded-lg transition-all duration-300 ${
                                                message.sender === 'user'
                                                    ? 'bg-blue-50 ml-4'
                                                    : 'bg-indigo-50 mr-4'
                                            } ${
                                                highlightedMessageId === message.messageId
                                                    ? 'ring-2 ring-orange-400 bg-orange-50'
                                                    : ''
                                            }`}
                                        >
                                            <div className="flex items-center mb-2">
                                                <span className={`text-sm font-medium ${
                                                    message.sender === 'user'
                                                        ? 'text-blue-600'
                                                        : 'text-indigo-600'
                                                }`}>
                                                    {message.sender === 'user' ? 'You' : 'ChatGPT'}
                                                </span>
                                                <span className="text-xs text-gray-500 ml-2">
                                                    {new Date(message.timestamp * 1000).toLocaleTimeString()}
                                                </span>
                                                {highlightedMessageId === message.messageId && (
                                                    <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                                        Referenced in shadow analysis
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-700 whitespace-pre-wrap">{message.text}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                // Journal entry view
                                <div className="space-y-6">
                                    {journalEntry ? (
                                        <>
                                            <div className="prose max-w-none">
                                                <div className="text-xl font-semibold text-gray-800 mb-4">
                                                    {renderMarkdown(journalEntry.reflectiveNarrative)}
                                                </div>
                                                
                                                <EmotionalSummaryCard emotionalSummary={journalEntry.emotionalSummary} />

                                                {/* Topics section */}
                                                <div className="bg-slate-50 p-4 rounded-lg mb-4">
                                                    <h3 className="text-lg font-medium text-slate-800 mb-3">Topics</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {journalEntry.topics.map((topic, index) => (
                                                            <span
                                                                key={index}
                                                                className="inline-block bg-slate-200 text-slate-700 text-sm px-3 py-1 rounded-full"
                                                            >
                                                                {topic}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {journalEntry.cbtPrompts && journalEntry.cbtPrompts.length > 0 && (
                                                    <CollapsibleSection
                                                        id="cbt"
                                                        title="Reflection Questions"
                                                        bgColor="bg-green-50"
                                                        titleColor="text-green-800"
                                                    >
                                                        <p className="text-sm text-green-700 mb-4">These therapeutic questions are tailored to your conversations and can help you explore your thoughts, emotions, and behaviors more deeply.</p>
                                                        <div className="space-y-4">
                                                            {journalEntry.cbtPrompts.map((prompt, index) => (
                                                                <div key={index} className="bg-white p-4 rounded-md border border-green-200">
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                                                                            {prompt.category}
                                                                        </span>
                                                                    </div>
                                                                    <h4 className="text-md font-medium text-green-900 mb-2">{prompt.question}</h4>
                                                                    <button
                                                                        onClick={() => openCBTReflectionModal(prompt)}
                                                                        className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-full transition-colors duration-200 flex items-center space-x-2"
                                                                    >
                                                                        <span>💭</span>
                                                                        <span>Explore This Question</span>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </CollapsibleSection>
                                                )}

                                                <CollapsibleSection
                                                    id="shadow"
                                                    title="Shadow Analysis"
                                                    bgColor="bg-orange-50"
                                                    titleColor="text-orange-800"
                                                >                                                    
                                                    <div className="border-t border-orange-200 pt-4">
                                                        <h4 className="text-md font-medium text-orange-700 mb-3">Shadow Traits</h4>
                                                        <div className="space-y-4">
                                                            {journalEntry.shadowTraits.map((trait, index) => (
                                                                <div key={index} className="bg-white p-4 rounded-md border border-orange-200">
                                                                    <h5 className="text-lg font-semibold text-orange-800 mb-2">{trait.name}</h5>
                                                                    <h4 className="text-md font-medium text-orange-900 mb-2">{trait.reflectionPrompt}</h4>
                                                                    
                                                                    {/* Supporting Quote */}
                                                                    {trait.supportingQuote && (
                                                                        <div className="bg-orange-50 border border-orange-300 rounded-md p-3 mb-3">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                                                                    You said on {new Date(trait.supportingQuote.date).toLocaleDateString()}:
                                                                                </span>
                                                                                <div className="flex gap-2">
                                                                                    {trait.supportingQuote.date !== selectedDate && (
                                                                                        <button
                                                                                            onClick={() => navigateToJournalEntry(trait.supportingQuote!.date)}
                                                                                            className="text-xs text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors"
                                                                                        >
                                                                                            View journal entry →
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        onClick={() => navigateToConversation(trait.supportingQuote!.date, trait.supportingQuote!.messageId)}
                                                                                        className="text-xs text-orange-600 hover:text-orange-800 underline hover:no-underline transition-colors"
                                                                                    >
                                                                                        View in conversation →
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            <blockquote className="text-md font-medium text-gray-800 italic border-l-2 border-orange-400 pl-3">
                                                                                "{trait.supportingQuote.text}"
                                                                            </blockquote>

                                                                        </div>
                                                                    )}
                                                                    
                                                                    
                                                                    
                                                                    <button
                                                                        onClick={() => openShadowReflectionModal(trait)}
                                                                        className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-full transition-colors duration-200 flex items-center space-x-2"
                                                                    >
                                                                        <span>🌑</span>
                                                                        <span>Explore Shadow Pattern</span>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </CollapsibleSection>

                                                {journalEntry.keyDecisions && journalEntry.keyDecisions.length > 0 && (
                                                    <CollapsibleSection
                                                        id="decisions"
                                                        title="Key Decisions"
                                                        bgColor="bg-purple-50"
                                                        titleColor="text-purple-800"
                                                    >
                                                        <ul className="list-disc list-inside space-y-1">
                                                            {journalEntry.keyDecisions.map((decision, index) => (
                                                                <li key={index} className="text-gray-700">{decision}</li>
                                                            ))}
                                                        </ul>
                                                    </CollapsibleSection>
                                                )}

                                                {journalEntry.keyFailures && journalEntry.keyFailures.length > 0 && (
                                                    <CollapsibleSection
                                                        id="failures"
                                                        title="Setbacks & Challenges"
                                                        bgColor="bg-red-50"
                                                        titleColor="text-red-800"
                                                    >
                                                        <ul className="list-disc list-inside space-y-1">
                                                            {journalEntry.keyFailures.map((failure, index) => (
                                                                <li key={index} className="text-gray-700">{failure}</li>
                                                            ))}
                                                        </ul>
                                                    </CollapsibleSection>
                                                )}

                                                {journalEntry.nextSteps && journalEntry.nextSteps.length > 0 && (
                                                    <CollapsibleSection
                                                        id="nextSteps"
                                                        title="Next Steps"
                                                        bgColor="bg-yellow-50"
                                                        titleColor="text-yellow-800"
                                                    >
                                                        <ul className="list-disc list-inside space-y-1">
                                                            {journalEntry.nextSteps.map((step, index) => (
                                                                <li key={index} className="text-gray-700">{step}</li>
                                                            ))}
                                                        </ul>
                                                    </CollapsibleSection>
                                                )}

                                                {/* Reflection History Section */}
                                                <CollapsibleSection
                                                    id="reflections"
                                                    title="Reflection History"
                                                    bgColor="bg-purple-50"
                                                    titleColor="text-purple-800"
                                                >
                                                    <ReflectionHistory 
                                                        selectedDate={selectedDate} 
                                                        onOpenSession={openExistingReflectionSession}
                                                    />
                                                </CollapsibleSection>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            No journal entry available for this date.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedDate && messages.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No messages found for this date.
                        </div>
                    )}
                </div>
            </div>

            {/* Reflection Modal */}
            {reflectionModal.theme && (
                <ReflectionModal
                    isOpen={reflectionModal.isOpen}
                    onClose={closeReflectionModal}
                    theme={reflectionModal.theme}
                    conversationHistory={reflectionModal.conversationHistory}
                    allSupportingQuotes={reflectionModal.allSupportingQuotes}
                    onSaveReflection={handleSaveReflection}
                    onAutoSave={handleAutoSave}
                    reflectionType={reflectionModal.reflectionType}
                    journalConversationHistory={reflectionModal.journalConversationHistory}
                    existingMessages={currentReflectionSession?.messages || []}
                />
            )}
        </div>
    );
} 