'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJournal } from './hooks/useJournal';
import StorageInfo from './components/StorageInfo';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [dayLimit, setDayLimit] = useState<number>(7);
  const router = useRouter();
  const { saveJournalData } = useJournal();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files ? e.target.files[0] : null;
    
    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.type !== 'application/json') {
      setError('Please select a JSON file');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Read file content
      const fileText = await file.text();
      const jsonData = JSON.parse(fileText);

      // Send to API
      const response = await fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversations: jsonData,
          analysisOptions: {
            dayLimit: dayLimit
          }
        }),
        signal: AbortSignal.timeout(3000000)
      });

      if (!response.ok) {
        throw new Error('Failed to process conversations');
      }

      const result = await response.json();
      
      // Process themes and shadow traits if journal entries exist
      if (result.journalEntries?.entries?.length > 0) {
        try {
          // Collect all themes by date for batch processing
          const allThemesByDate: { [dateString: string]: any[] } = {};
          
          result.journalEntries.entries.forEach((entry: any) => {
            if (entry.emotionalSummary?.themes && entry.emotionalSummary.themes.length > 0) {
              // Filter out themes with empty supporting quotes
              const filteredThemes = entry.emotionalSummary.themes.filter((theme: any) => theme.supportingQuote.trim() !== '');
              
              if (filteredThemes.length > 0) {
                allThemesByDate[entry.date] = filteredThemes;
              }
            }
          });

          // Collect all shadow traits by date for batch processing
          const allShadowTraitsByDate: { [dateString: string]: any[] } = {};
          
          result.journalEntries.entries.forEach((entry: any) => {
            if (entry.shadowTraits && entry.shadowTraits.length > 0) {
              // Convert shadow traits to the format expected by the Python backend
              const shadowTraitWithQuotes = entry.shadowTraits
                .filter((trait: any) => trait.supportingQuote?.text.trim() !== '')
                .map((trait: any) => ({
                  trait: trait.name,
                  supportingQuote: trait.supportingQuote!.text,
                  description: trait.description
                }));
              
              if (shadowTraitWithQuotes.length > 0) {
                allShadowTraitsByDate[entry.date] = shadowTraitWithQuotes;
              }
            }
          });

          // Process themes and shadow traits in parallel using job-based WebSocket processing
          const [processedThemes, processedShadowTraits] = await Promise.all([
            // Process themes through Python backend
            (async () => {
              if (Object.keys(allThemesByDate).length > 0) {
                try {
                  console.log(`Submitting theme processing job for ${Object.keys(allThemesByDate).length} days...`);
                  
                  // 1. Submit job
                  const themeJobResponse = await fetch('http://localhost:8001/process-themes', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      themes: allThemesByDate
                    }),
                    signal: AbortSignal.timeout(30000) // 30 seconds for job submission
                  });

                  if (themeJobResponse.ok) {
                    const jobData = await themeJobResponse.json();
                    const jobId = jobData.job_id;
                    console.log(`Theme processing job submitted: ${jobId}`);
                    
                    // 2. Connect to WebSocket and wait for completion
                    const result = await new Promise((resolve, reject) => {
                      const ws = new WebSocket(`ws://localhost:8001/ws/${jobId}`);
                      const timeout = setTimeout(() => {
                        ws.close();
                        reject(new Error('WebSocket timeout'));
                      }, 3000000); // 50 minute timeout
                      
                      ws.onopen = () => {
                        console.log(`Connected to theme processing WebSocket for job ${jobId}`);
                      };
                      
                      ws.onmessage = (event) => {
                        try {
                          const data = JSON.parse(event.data);
                          console.log(`Theme processing type: ${data.type}`);
                          
                          if (data.type === 'job_completed') {
                            clearTimeout(timeout);
                            ws.close();
                            resolve(data.result);
                          } else if (data.type === 'job_error') {
                            clearTimeout(timeout);
                            ws.close();
                            reject(new Error(data.error || 'Theme processing failed'));
                          } else if (data.type === 'error') {
                            clearTimeout(timeout);
                            ws.close();
                            reject(new Error(data.message || 'Theme processing error'));
                          } else if (data.type === 'job_status') {
                            console.log(`Theme processing status: ${data.status} - ${data.message || 'Processing...'}`);
                            // Continue listening for completion
                          }
                        } catch (error) {
                          console.error('Error parsing WebSocket message:', error);
                        }
                      };
                      
                      ws.onerror = (error) => {
                        clearTimeout(timeout);
                        console.error('WebSocket error:', error);
                        reject(error);
                      };
                      
                      ws.onclose = () => {
                        clearTimeout(timeout);
                        console.log('Theme processing WebSocket closed');
                      };
                    });
                    
                    console.log(`Theme processing completed: ${(result as any)?.clusters?.length || 0} clusters`);
                    return result;
                  } else {
                    console.error('Failed to submit theme processing job:', await themeJobResponse.text());
                    return null;
                  }
                } catch (error) {
                  console.error('Error processing themes:', error);
                  return null;
                }
              }
              return null;
            })(),
            
            // Process shadow traits through Python backend
            (async () => {
              if (Object.keys(allShadowTraitsByDate).length > 0) {
                try {
                  console.log(`Submitting shadow trait processing job for ${Object.keys(allShadowTraitsByDate).length} days...`);
                  
                  // 1. Submit job
                  const shadowJobResponse = await fetch('http://localhost:8001/process-shadow-traits', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      traits: allShadowTraitsByDate
                    }),
                    signal: AbortSignal.timeout(30000) // 30 seconds for job submission
                  });

                  if (shadowJobResponse.ok) {
                    const jobData = await shadowJobResponse.json();
                    const jobId = jobData.job_id;
                    console.log(`Shadow trait processing job submitted: ${jobId}`);
                    
                    // 2. Connect to WebSocket and wait for completion
                    const result = await new Promise((resolve, reject) => {
                      const ws = new WebSocket(`ws://localhost:8001/ws/${jobId}`);
                      const timeout = setTimeout(() => {
                        ws.close();
                        reject(new Error('WebSocket timeout'));
                      }, 3000000); // 50 minute timeout
                      
                      ws.onopen = () => {
                        console.log(`Connected to shadow trait processing WebSocket for job ${jobId}`);
                      };
                      
                      ws.onmessage = (event) => {
                        try {
                          const data = JSON.parse(event.data);
                          console.log(`Shadow trait processing type: ${data.type}`);
                          
                          if (data.type === 'job_completed') {
                            clearTimeout(timeout);
                            ws.close();
                            resolve(data.result);
                          } else if (data.type === 'job_error') {
                            clearTimeout(timeout);
                            ws.close();
                            reject(new Error(data.error || 'Shadow trait processing failed'));
                          } else if (data.type === 'error') {
                            clearTimeout(timeout);
                            ws.close();
                            reject(new Error(data.message || 'Shadow trait processing error'));
                          } else if (data.type === 'job_status') {
                            console.log(`Shadow trait processing status: ${data.status} - ${data.message || 'Processing...'}`);
                            // Continue listening for completion
                          }
                        } catch (error) {
                          console.error('Error parsing WebSocket message:', error);
                        }
                      };
                      
                      ws.onerror = (error) => {
                        clearTimeout(timeout);
                        console.error('WebSocket error:', error);
                        reject(error);
                      };
                      
                      ws.onclose = () => {
                        clearTimeout(timeout);
                        console.log('Shadow trait processing WebSocket closed');
                      };
                    });
                    
                    console.log(`Shadow trait processing completed: ${(result as any)?.clusters?.length || 0} clusters`);
                    return result;
                  } else {
                    console.error('Failed to submit shadow trait processing job:', await shadowJobResponse.text());
                    return null;
                  }
                } catch (error) {
                  console.error('Error processing shadow traits:', error);
                  return null;
                }
              }
              return null;
            })()
          ]);

          // Add the processed results to the data
          result.themeAnalysis = processedThemes || undefined;
          result.shadowTraitAnalysis = processedShadowTraits || undefined;
          
        } catch (error) {
          console.error('Error in theme/shadow trait processing:', error);
          // Continue with undefined values if processing fails
          result.themeAnalysis = undefined;
          result.shadowTraitAnalysis = undefined;
        }
      }
      
      console.log("Test 1" + result);
      // Save processed data using the hook
      await saveJournalData(result);

      console.log("Test 2" + result);
      
      // Redirect to dashboard
      router.push('/dashboard');
      
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Error processing file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ChatGPT Journal
          </h1>
          <p className="text-gray-600">
            Transform your ChatGPT conversations into organized journal entries
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload ChatGPT Export (JSON)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload" 
                className="cursor-pointer block"
              >
                <div className="text-gray-400 mb-2">
                  <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-indigo-600 hover:text-indigo-500">
                  Click to upload
                </span>
                <span className="text-gray-500"> or drag and drop</span>
              </label>
            </div>
            
            {file && (
              <p className="mt-2 text-sm text-green-600">
                ✓ {file.name} selected
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analysis Period
            </label>
            <div className="space-y-2">
              <select
                value={dayLimit}
                onChange={(e) => setDayLimit(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={3}>Last 3 days</option>
                <option value={7}>Last 7 days (recommended)</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={0}>All conversations</option>
              </select>
              <p className="text-xs text-gray-500">
                Choose how many recent days to analyze. Shorter periods provide more focused insights and faster processing.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Create My Journal'
            )}
          </button>
        </form>

        <div className="mt-6 space-y-4">
          <StorageInfo />
          <div className="text-xs text-gray-500 text-center">
            <p>Your data is processed locally and stored in your browser only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}