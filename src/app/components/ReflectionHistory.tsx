'use client';

import { useState } from 'react';
import { ReflectionSession } from '@/app/lib/data';
import { useReflections } from '@/app/hooks/useReflections';

interface ReflectionHistoryProps {
    selectedDate?: string;
    showAllDates?: boolean;
    onOpenSession?: (session: ReflectionSession) => void;
}

const ReflectionHistory: React.FC<ReflectionHistoryProps> = ({ 
    selectedDate, 
    showAllDates = false,
    onOpenSession
}) => {
    const { reflectionSessions, loading, error, deleteReflectionSession } = useReflections();
    const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

    if (loading) {
        return (
            <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading reflection history...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-red-600">
                <p>Error loading reflection history: {error}</p>
            </div>
        );
    }

    // Filter sessions based on props
    const filteredSessions = showAllDates 
        ? reflectionSessions 
        : selectedDate 
            ? reflectionSessions.filter(session => session.dateString === selectedDate)
            : [];

    if (filteredSessions.length === 0) {
        return (
            <div className="p-4 text-center text-gray-500">
                <p>No reflection sessions found{selectedDate ? ` for ${selectedDate}` : ''}.</p>
            </div>
        );
    }

    // Group sessions by date
    const sessionsByDate = filteredSessions.reduce((acc, session) => {
        if (!acc[session.dateString]) {
            acc[session.dateString] = [];
        }
        acc[session.dateString].push(session);
        return acc;
    }, {} as Record<string, ReflectionSession[]>);

    const toggleSessionExpansion = (sessionId: string) => {
        const newExpanded = new Set(expandedSessions);
        if (newExpanded.has(sessionId)) {
            newExpanded.delete(sessionId);
        } else {
            newExpanded.add(sessionId);
        }
        setExpandedSessions(newExpanded);
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (window.confirm('Are you sure you want to delete this reflection session?')) {
            try {
                await deleteReflectionSession(sessionId);
            } catch (error) {
                console.error('Failed to delete session:', error);
                alert('Failed to delete reflection session');
            }
        }
    };

    const getReflectionTypeColor = (type: string) => {
        switch (type) {
            case 'cbtreflection':
                return 'bg-green-100 text-green-800';
            case 'shadowreflection':
                return 'bg-purple-100 text-purple-800';
            case 'shadowclusterreflection':
                return 'bg-indigo-100 text-indigo-800';
            case 'emotionalclusterreflection':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getReflectionTypeName = (type: string) => {
        switch (type) {
            case 'cbtreflection':
                return 'CBT Reflection';
            case 'shadowreflection':
                return 'Shadow Work';
            case 'shadowclusterreflection':
                return 'Shadow Cluster';
            case 'emotionalclusterreflection':
                return 'Emotional Reflection';
            default:
                return 'Reflection';
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Reflection History {selectedDate && `for ${selectedDate}`}
            </h3>

            {Object.entries(sessionsByDate)
                .sort(([a], [b]) => b.localeCompare(a)) // Sort dates descending
                .map(([date, sessions]) => (
                    <div key={date} className="space-y-3">
                        {showAllDates && (
                            <h4 className="text-md font-medium text-gray-700 border-b pb-1">
                                {new Date(date).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}
                            </h4>
                        )}

                        {sessions
                            .sort((a, b) => (b.completedAt || b.startedAt) - (a.completedAt || a.startedAt))
                            .map((session) => (
                                <div key={session.id} className="border rounded-lg p-4 bg-white shadow-sm">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReflectionTypeColor(session.reflectionType)}`}>
                                                    {getReflectionTypeName(session.reflectionType)}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(session.completedAt || session.startedAt).toLocaleTimeString('en-US', { 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })}
                                                </span>
                                            </div>
                                            <h5 className="font-medium text-gray-800">{session.theme}</h5>
                                            <p className="text-sm text-gray-600 mt-1">{session.supportingQuote}</p>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <button
                                                onClick={() => toggleSessionExpansion(session.id)}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            >
                                                {expandedSessions.has(session.id) ? 'Hide' : 'View'}
                                            </button>
                                            {onOpenSession && (
                                                <button
                                                    onClick={() => onOpenSession(session)}
                                                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                                                >
                                                    Open
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteSession(session.id)}
                                                className="text-red-600 hover:text-red-800 text-sm"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>

                                    {expandedSessions.has(session.id) && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                                {session.messages.map((message, index) => (
                                                    <div key={message.id || index} className={`p-3 rounded-lg ${
                                                        message.sender === 'user' 
                                                            ? 'bg-blue-50 ml-8' 
                                                            : 'bg-gray-50 mr-8'
                                                    }`}>
                                                        <div className="flex items-center space-x-2 mb-1">
                                                            <span className={`text-xs font-medium ${
                                                                message.sender === 'user' 
                                                                    ? 'text-blue-700' 
                                                                    : 'text-gray-700'
                                                            }`}>
                                                                {message.sender === 'user' ? 'You' : 'Therapist'}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(message.timestamp).toLocaleTimeString('en-US', { 
                                                                    hour: '2-digit', 
                                                                    minute: '2-digit' 
                                                                })}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-800">{message.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                ))}
        </div>
    );
};

export default ReflectionHistory; 