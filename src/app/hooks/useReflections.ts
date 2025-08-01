'use client';

import { useState, useEffect } from 'react';
import { ReflectionSession } from '@/app/lib/data';
import { indexedDBStorage } from '@/app/lib/indexedDB';

interface UseReflectionsReturn {
    reflectionSessions: ReflectionSession[];
    loading: boolean;
    error: string | null;
    saveReflectionSession: (session: ReflectionSession) => Promise<void>;
    getReflectionsByDate: (dateString: string) => ReflectionSession[];
    getReflectionsByType: (reflectionType: string) => ReflectionSession[];
    refreshReflections: () => Promise<void>;
    deleteReflectionSession: (sessionId: string) => Promise<void>;
}

export function useReflections(): UseReflectionsReturn {
    const [reflectionSessions, setReflectionSessions] = useState<ReflectionSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load all reflection sessions on mount
    useEffect(() => {
        loadReflections();
    }, []);

    const loadReflections = async () => {
        try {
            setLoading(true);
            setError(null);
            const sessions = await indexedDBStorage.getAllReflectionSessions();
            setReflectionSessions(sessions);
        } catch (err) {
            console.error('Failed to load reflection sessions:', err);
            setError('Failed to load reflection sessions');
        } finally {
            setLoading(false);
        }
    };

    const saveReflectionSession = async (session: ReflectionSession) => {
        try {
            await indexedDBStorage.saveReflectionSession(session);
            // Refresh the sessions list
            await loadReflections();
        } catch (err) {
            console.error('Failed to save reflection session:', err);
            throw err;
        }
    };

    const getReflectionsByDate = (dateString: string): ReflectionSession[] => {
        return reflectionSessions.filter(session => session.dateString === dateString);
    };

    const getReflectionsByType = (reflectionType: string): ReflectionSession[] => {
        return reflectionSessions.filter(session => session.reflectionType === reflectionType);
    };

    const refreshReflections = async () => {
        await loadReflections();
    };

    const deleteReflectionSession = async (sessionId: string) => {
        try {
            await indexedDBStorage.deleteReflectionSession(sessionId);
            // Refresh the sessions list
            await loadReflections();
        } catch (err) {
            console.error('Failed to delete reflection session:', err);
            throw err;
        }
    };

    return {
        reflectionSessions,
        loading,
        error,
        saveReflectionSession,
        getReflectionsByDate,
        getReflectionsByType,
        refreshReflections,
        deleteReflectionSession
    };
} 