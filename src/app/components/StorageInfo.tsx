'use client';

import { useState, useEffect } from 'react';
import { indexedDBStorage } from '@/app/lib/indexedDB';

interface StorageInfoProps {
  onClearData?: () => void;
}

export default function StorageInfo({ onClearData }: StorageInfoProps) {
  const [storageInfo, setStorageInfo] = useState<{ used: number; quota: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        const info = await indexedDBStorage.getStorageInfo();
        setStorageInfo(info);
      } catch (error) {
        console.error('Failed to get storage info:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStorageInfo();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUsagePercentage = (): number => {
    if (!storageInfo || storageInfo.quota === 0) return 0;
    return (storageInfo.used / storageInfo.quota) * 100;
  };

  const getUsageColor = (): string => {
    const percentage = getUsagePercentage();
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-2 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  if (!storageInfo) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Storage Usage</h3>
        {onClearData && (
          <button
            onClick={onClearData}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Clear Data
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Used: {formatBytes(storageInfo.used)}</span>
          <span>Available: {formatBytes(storageInfo.quota)}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getUsageColor()}`}
            style={{ width: `${Math.min(getUsagePercentage(), 100)}%` }}
          ></div>
        </div>
        
        <div className="text-xs text-gray-500">
          {getUsagePercentage().toFixed(1)}% used
        </div>
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        <p>✓ Using IndexedDB for large file support</p>
        <p>✓ No size limits like localStorage</p>
      </div>
    </div>
  );
} 