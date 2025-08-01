'use client';

import { useState, useEffect, useRef } from 'react';
import { ThemeWithQuote, ChatMessage, ReflectionPrompt, ParsedMessage } from '@/app/lib/data';

type ReflectionType = 'emotionalclusterreflection' | 'shadowclusterreflection' | 'cbtreflection' | 'shadowreflection';

interface ReflectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: ThemeWithQuote;
    conversationHistory: ParsedMessage[];
    allSupportingQuotes: string[];
    onSaveReflection: (messages: ChatMessage[]) => void;
    onAutoSave: (messages: ChatMessage[]) => void;
    reflectionType: ReflectionType;
    journalConversationHistory?: ParsedMessage[];
    existingMessages?: ChatMessage[];
}

const ReflectionModal: React.FC<ReflectionModalProps> = ({
    isOpen,
    onClose,
    theme,
    conversationHistory,
    allSupportingQuotes,
    onSaveReflection,
    onAutoSave,
    reflectionType,
    journalConversationHistory = [],
    existingMessages = []
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>(existingMessages);
    const [currentInput, setCurrentInput] = useState('');
    // Removed phase system - using direct conversation approach
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        setMessages(existingMessages);
    }, [existingMessages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            // Generate AI-powered initial message for different reflection types
            generateInitialMessage();
        }
    }, [isOpen, theme, reflectionType]);

    const generateInitialMessage = async () => {
        setIsLoading(true);
        try {
            // For CBT and shadow reflections, use the question directly as initial message
            if (reflectionType === 'cbtreflection' || reflectionType === 'shadowreflection') {
                const initialMessage: ChatMessage = {
                    id: crypto.randomUUID(),
                    sender: 'system',
                    content: theme.supportingQuote, // The question is stored in supportingQuote
                    timestamp: Date.now()
                };
                setMessages([initialMessage]);
                setIsLoading(false);
                return;
            }

            // For cluster reflections, use AI-generated initial messages
            let endpoint = '/api/reflection/initial';
            if (reflectionType === 'shadowclusterreflection') {
                endpoint = '/api/shadow-reflection/initial';
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    theme: theme.theme,
                    supportingQuote: theme.supportingQuote,
                    description: theme.description,
                    allSupportingQuotes: allSupportingQuotes,
                    themeConversationHistory: conversationHistory,
                    journalConversationHistory: journalConversationHistory
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate initial message');
            }

            const aiResponse = await response.json();
            
            const initialMessage: ChatMessage = {
                id: crypto.randomUUID(),
                sender: 'system',
                content: aiResponse.response,
                timestamp: Date.now()
            };
            
            setMessages([initialMessage]);
        } catch (error) {
            console.error('Error generating initial message:', error);
            // Fallback to static message
            const fallbackMessage: ChatMessage = {
                id: crypto.randomUUID(),
                sender: 'system',
                content: reflectionType === 'shadowclusterreflection'
                    ? `I notice the shadow pattern of "${theme.theme}" appearing across your conversations.

${theme.description}

Let's explore this pattern with compassion and curiosity. How do you see this showing up in your life right now?`
                    : reflectionType === 'cbtreflection' || reflectionType === 'shadowreflection'
                    ? theme.supportingQuote // For CBT and shadow reflections, use the question directly
                    : `I notice the theme of "${theme.theme}" came up in your conversations.

${theme.description}

Let's explore this theme together. What do you think drives this behavior for you?`,
                timestamp: Date.now()
            };
            setMessages([fallbackMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Removed phase prompts - using AI-generated responses

    const handleSendMessage = async () => {
        if (!currentInput.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            sender: 'user',
            content: currentInput,
            timestamp: Date.now()
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setCurrentInput('');
        setIsLoading(true);

        try {
            // Call the appropriate backend API to get AI response
            let apiEndpoint = '/api/reflection';
            if (reflectionType === 'shadowclusterreflection') {
                apiEndpoint = '/api/shadow-reflection';
            } else if (reflectionType === 'cbtreflection') {
                apiEndpoint = '/api/cbt-reflection';
            } else if (reflectionType === 'shadowreflection') {
                apiEndpoint = '/api/shadow-reflection/individual';
            }
            
            const requestBody = {
                theme: theme.theme,
                supportingQuote: theme.supportingQuote,
                description: theme.description,
                userMessage: currentInput,
                conversationHistory: newMessages,
                allSupportingQuotes: allSupportingQuotes,
                themeConversationHistory: conversationHistory,
                journalConversationHistory: journalConversationHistory
            };

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Failed to get AI response');
            }

            const aiResponse = await response.json();
            
            const systemMessage: ChatMessage = {
                id: crypto.randomUUID(),
                sender: 'system',
                content: aiResponse.response,
                timestamp: Date.now()
            };
            
            const updatedMessages = [...newMessages, systemMessage];
            setMessages(updatedMessages);
            
            // Auto-save after each message exchange
            onAutoSave(updatedMessages);
        } catch (error) {
            console.error('Error getting AI response:', error);
            // Simple fallback response
            const fallbackResponse = "I understand. Can you tell me more about that?";
            const systemMessage: ChatMessage = {
                id: crypto.randomUUID(),
                sender: 'system',
                content: fallbackResponse,
                timestamp: Date.now()
            };
            const updatedMessages = [...newMessages, systemMessage];
            setMessages(updatedMessages);
            
            // Auto-save even for fallback responses
            onAutoSave(updatedMessages);
        } finally {
            setIsLoading(false);
        }
    };

    // Removed phase-based system - using direct AI responses

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleClose = () => {
        onSaveReflection(messages);
        onClose();
    };

    if (!isOpen) return null;

    // Removed phase-related UI functions

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-bold text-gray-800">Reflecting on: {theme.theme}</h2>
                        <button
                            onClick={handleClose}
                            className="text-gray-500 hover:text-gray-700 text-2xl"
                        >
                            ×
                        </button>
                    </div>
                    
                    {/* Simple reflection indicator */}
                    <div className="flex items-center space-x-2 mb-3">
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {reflectionType === 'shadowclusterreflection' || reflectionType === 'shadowreflection' 
                                ? 'Shadow Integration' 
                                : reflectionType === 'cbtreflection'
                                ? 'CBT Reflection'
                                : 'Emotional Reflection'}
                        </span>
                        {existingMessages.length > 0 && (
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                Continuing Previous Session
                            </span>
                        )}
                    </div>
                    
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                    message.sender === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-800'
                                }`}
                            >
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 text-gray-800 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                                <div className="flex items-center space-x-2">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                    <span className="text-sm">Reflecting...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-6 border-t">
                    <div className="flex space-x-2">
                        <textarea
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Share your thoughts..."
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-black"
                            rows={2}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!currentInput.trim() || isLoading}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Thinking...</span>
                                </>
                            ) : (
                                <span>Send</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReflectionModal; 