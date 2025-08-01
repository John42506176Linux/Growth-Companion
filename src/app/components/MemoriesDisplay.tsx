'use client';

import { MemoryData, Person, Goal, GeneralMemory } from '@/app/lib/data';
import { useState, useEffect } from 'react';

interface MemoriesDisplayProps {
  memoryData: MemoryData;
}

type MemoryCategory = 'all' | 'people' | 'places' | 'events' | 'goals' | 'memories';

export default function MemoriesDisplay({ memoryData }: MemoriesDisplayProps) {
  const [activeCategory, setActiveCategory] = useState<MemoryCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubGoal, setSelectedSubGoal] = useState<Goal | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [goalNavigationStack, setGoalNavigationStack] = useState<Goal[]>([]);

  const categories = [
    { id: 'all' as MemoryCategory, label: 'All', count: memoryData.stats.totalPeople + memoryData.stats.totalGoals + memoryData.stats.totalMemories },
    { id: 'people' as MemoryCategory, label: 'People', count: memoryData.stats.totalPeople },
    { id: 'goals' as MemoryCategory, label: 'Goals', count: memoryData.stats.totalGoals },
    { id: 'memories' as MemoryCategory, label: 'General', count: memoryData.stats.totalMemories },
  ];

  // Filter function based on search term
  const filterBySearch = (text: string) => {
    if (!text) return false;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  };

  const openSubGoalModal = (subGoal: Goal) => {
    setSelectedSubGoal(subGoal);
    setGoalNavigationStack([subGoal]);
    setIsModalOpen(true);
  };

  const navigateToSubGoal = (subGoal: Goal) => {
    setGoalNavigationStack(prev => [...prev, subGoal]);
    setSelectedSubGoal(subGoal);
  };

  const navigateBack = () => {
    setGoalNavigationStack(prev => {
      const newStack = prev.slice(0, -1);
      if (newStack.length > 0) {
        setSelectedSubGoal(newStack[newStack.length - 1]);
        return newStack;
      } else {
        closeModal();
        return [];
      }
    });
  };

  const navigateToGoalInStack = (index: number) => {
    const newStack = goalNavigationStack.slice(0, index + 1);
    setGoalNavigationStack(newStack);
    setSelectedSubGoal(newStack[newStack.length - 1]);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSubGoal(null);
    setGoalNavigationStack([]);
  };

  // Handle keyboard events for modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  // Person Card Component
  const PersonCard = ({ person }: { person: Person }) => (
    <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-blue-800">{person.name}</h3>
          <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
            {person.relationshipType.replace('_', ' ')}
          </span>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>Mentioned {person.mentionCount} times</div>
          <div>Last: {new Date(person.lastMentioned).toLocaleDateString()}</div>
        </div>
      </div>
      
      {person.relationshipDescription && (
        <p className="text-sm text-gray-600 mb-2">{person.relationshipDescription}</p>
      )}
      
      {person.personalityTraits.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-medium text-gray-700 mb-1">Personality:</div>
          <div className="flex flex-wrap gap-1">
            {person.personalityTraits.slice(0, 3).map((trait, index) => (
              <span key={index} className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded">
                {trait}
              </span>
            ))}
            {person.personalityTraits.length > 3 && (
              <span className="text-xs text-gray-500">+{person.personalityTraits.length - 3} more</span>
            )}
          </div>
        </div>
      )}
      
      {person.extractedFrom.length > 0 && (
        <div className="border-t pt-2 mt-2">
          <div className="text-xs text-gray-500 italic">
            "{person.extractedFrom[0].relevantQuote}"
          </div>
        </div>
      )}
    </div>
  );



  // Goal Card Component
  const GoalCard = ({ goal, allGoals }: { goal: Goal; allGoals: Goal[] }) => {
    let subGoals: Goal[] = [];
    if(goal.subGoalIds) {
      subGoals = goal.subGoalIds.map(id => allGoals.find(g => g.id === id)).filter(Boolean) as Goal[];
    }
    
    return (
      <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div>
            <button 
              onClick={() => openSubGoalModal(goal)}
              className="text-lg font-semibold text-orange-800 hover:text-orange-900 hover:underline text-left transition-colors cursor-pointer group"
              title="Click to view goal details"
            >
              <span className="group-hover:text-orange-900">{goal.title}</span>
              <span className="ml-1 text-orange-400 opacity-60 group-hover:opacity-100 transition-opacity">🔍</span>
            </button>
            <div className="flex gap-2 mt-1">
              <span className="inline-block bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
                {goal.type}
              </span>
              <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                goal.status === 'completed' ? 'bg-green-100 text-green-700' :
                goal.status === 'active' ? 'bg-blue-100 text-blue-700' :
                goal.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                goal.status === 'abandoned' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {goal.status}
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>Mentioned {goal.mentionCount} times</div>
            <div>{goal.timeframe?.replace('_', ' ')}</div>
            <div>Last: {new Date(goal.lastMentioned).toLocaleDateString()}</div>
            {subGoals && subGoals.length > 0 && (
              <div className="text-orange-600 font-medium">
                {subGoals.length} sub-goal{subGoals.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
        
        {goal.description && (
          <p className="text-sm text-gray-600 mb-2">{goal.description}</p>
        )}
        
        { subGoals && subGoals.length > 0 && (
          <div className="mb-2">
            <div className="text-xs font-medium text-gray-700 mb-1">Sub-goals:</div>
            <ul className="text-xs text-gray-600 space-y-1">
              {subGoals.slice(0, 3).map((subGoal, index) => (
                <li key={index} className="flex items-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    subGoal.status === 'completed' ? 'bg-green-400' :
                    subGoal.status === 'active' ? 'bg-blue-400' :
                    subGoal.status === 'paused' ? 'bg-yellow-400' :
                    subGoal.status === 'abandoned' ? 'bg-red-400' :
                    'bg-gray-400'
                  }`}></span>
                  <button 
                    className="text-orange-600 hover:text-orange-800 hover:underline text-left"
                    onClick={() => openSubGoalModal(subGoal)}
                  >
                    {subGoal.title}
                  </button>
                </li>
              ))}
              {subGoals && subGoals.length > 3 && (
                <li className="text-gray-500">+{subGoals.length - 3} more sub-goals</li>
              )}
            </ul>
          </div>
        )}
        
        { goal.extractedFrom && goal.extractedFrom.length > 0 && (
          <div className="border-t pt-2 mt-2">
            <div className="text-xs text-gray-500 italic">
              "{goal.extractedFrom[0].relevantQuote}"
            </div>
          </div>
        )}
      </div>
    );
  };

  // General Memory Card Component
  const GeneralMemoryCard = ({ memory }: { memory: GeneralMemory }) => (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-3">
        <p className="text-sm text-gray-800 mb-2">{memory.content}</p>
        <div className="flex flex-wrap gap-1">
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
            {memory.tag}
          </span>
        </div>
      </div>
      
      {memory.extractedFrom.length > 0 && (
        <div className="border-t pt-2 mt-2">
          <div className="text-xs text-gray-500 italic">
            "{memory.extractedFrom[0].relevantQuote}"
          </div>
        </div>
      )}
    </div>
  );

  // Filter data based on active category and search term
  const getFilteredData = () => {
    const filtered = {
      people: memoryData.people.filter(person => 
        filterBySearch(person.name) || 
        filterBySearch(person.relationshipDescription || '') ||
        person.personalityTraits.some(trait => filterBySearch(trait))
      ),
      goals: memoryData.goals
        .filter(goal => !goal.parentGoalId) // Only show top-level goals (no parent)
        .filter(goal => 
          filterBySearch(goal.title) || 
          filterBySearch(goal.description || '')
        ),
      memories: memoryData.generalMemories.filter(memory => 
        filterBySearch(memory.content)
      )
    };

    if (activeCategory === 'all') {
      return filtered;
    } else {
      return {
        people: activeCategory === 'people' ? filtered.people : [],
        goals: activeCategory === 'goals' ? filtered.goals : [],
        memories: activeCategory === 'memories' ? filtered.memories : []
      };
    }
  };

  const filteredData = getFilteredData();

  // Recursive Sub-Goal Component
  const RecursiveSubGoals = ({ goal, depth = 0, maxDepth = 5 }: { goal: Goal; depth?: number; maxDepth?: number }) => {
    const subGoals = goal.subGoalIds?.map(id => memoryData.goals.find(g => g.id === id)).filter(Boolean) as Goal[] || [];
    
    if (subGoals.length === 0 || depth >= maxDepth) return null;

    return (
      <div className="space-y-2">
        {subGoals.map((subGoal, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-1">
                <span className={`inline-block w-3 h-3 rounded-full mr-3 ${
                  subGoal.status === 'completed' ? 'bg-green-400' :
                  subGoal.status === 'active' ? 'bg-blue-400' :
                  subGoal.status === 'paused' ? 'bg-yellow-400' :
                  subGoal.status === 'abandoned' ? 'bg-red-400' :
                  'bg-gray-400'
                }`}></span>
                <div className="flex-1">
                  <button 
                    className="text-orange-600 hover:text-orange-800 hover:underline text-left font-medium"
                    onClick={() => navigateToSubGoal(subGoal)}
                  >
                    {subGoal.title}
                  </button>
                                     {subGoal.description && (
                     <p className="text-xs text-gray-600 mt-1 overflow-hidden" style={{ 
                       display: '-webkit-box', 
                       WebkitLineClamp: 2, 
                       WebkitBoxOrient: 'vertical' 
                     }}>
                       {subGoal.description}
                     </p>
                   )}
                </div>
              </div>
              {subGoal.subGoalIds && subGoal.subGoalIds.length > 0 && (
                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                  {subGoal.subGoalIds.length} sub-goal{subGoal.subGoalIds.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            {/* Show nested sub-goals if any */}
            {subGoal.subGoalIds && subGoal.subGoalIds.length > 0 && (
              <div className="ml-6 mt-3 pl-3 border-l-2 border-orange-200">
                {depth < maxDepth - 1 ? (
                  <RecursiveSubGoals goal={subGoal} depth={depth + 1} maxDepth={maxDepth} />
                ) : (
                  <div className="text-xs text-gray-500 italic p-2">
                    Click "{subGoal.title}" above to explore deeper levels
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Sub-Goal Modal Component
  const SubGoalModal = () => {
    if (!isModalOpen || !selectedSubGoal) return null;

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={closeModal}
      >
        <div 
          className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Breadcrumb Navigation */}
            {goalNavigationStack.length > 1 && (
              <div className="mb-4 p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-600">Navigation:</span>
                  {goalNavigationStack.map((goal, index) => (
                    <div key={goal.id} className="flex items-center">
                      {index > 0 && <span className="text-gray-400 mx-1">→</span>}
                      <button
                        onClick={() => navigateToGoalInStack(index)}
                        className={`px-2 py-1 rounded ${
                          index === goalNavigationStack.length - 1
                            ? 'bg-orange-200 text-orange-800 font-medium'
                            : 'text-orange-600 hover:bg-orange-100'
                        }`}
                      >
                        {goal.title}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {goalNavigationStack.length > 1 && (
                    <button
                      onClick={navigateBack}
                      className="p-1 text-gray-500 hover:text-gray-700 rounded"
                      title="Go back"
                    >
                      ← Back
                    </button>
                  )}
                  <h2 className="text-2xl font-bold text-orange-800">{selectedSubGoal.title}</h2>
                </div>
                
                {/* Goal Type Indicator */}
                <div className="mb-2">
                  {selectedSubGoal.parentGoalId ? (
                    <div className="text-sm text-gray-600">
                      <span className="inline-flex items-center">
                        🔗 Sub-goal
                        {(() => {
                          const parentGoal = memoryData.goals.find(g => g.id === selectedSubGoal.parentGoalId);
                          return parentGoal ? (
                            <span className="ml-2">
                              of "<button 
                                onClick={() => {
                                  const parent = memoryData.goals.find(g => g.id === selectedSubGoal.parentGoalId);
                                  if (parent) navigateToSubGoal(parent);
                                }}
                                className="text-orange-600 hover:text-orange-800 underline"
                              >
                                {parentGoal.title}
                              </button>"
                            </span>
                          ) : null;
                        })()}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      <span className="inline-flex items-center">
                        🎯 Main goal
                        {selectedSubGoal.subGoalIds && selectedSubGoal.subGoalIds.length > 0 && (
                          <span className="ml-2">({selectedSubGoal.subGoalIds.length} sub-goal{selectedSubGoal.subGoalIds.length !== 1 ? 's' : ''})</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <span className="inline-block bg-orange-100 text-orange-700 text-sm px-3 py-1 rounded-full">
                    {selectedSubGoal.type}
                  </span>
                  <span className={`inline-block text-sm px-3 py-1 rounded-full ${
                    selectedSubGoal.status === 'completed' ? 'bg-green-100 text-green-700' :
                    selectedSubGoal.status === 'active' ? 'bg-blue-100 text-blue-700' :
                    selectedSubGoal.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                    selectedSubGoal.status === 'abandoned' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedSubGoal.status}
                  </span>
                  <span className="inline-block bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
                    {selectedSubGoal.timeframe?.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Description */}
            {selectedSubGoal.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
                <p className="text-gray-600">{selectedSubGoal.description}</p>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Timeline */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">First mentioned:</span>
                    <span className="text-gray-800">{selectedSubGoal.firstMentioned.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last mentioned:</span>
                    <span className="text-gray-800">{selectedSubGoal.lastMentioned.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mention count:</span>
                    <span className="text-gray-800">{selectedSubGoal.mentionCount} times</span>
                  </div>
                  {selectedSubGoal.targetDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Target date:</span>
                      <span className="text-gray-800">{new Date(selectedSubGoal.targetDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Related People */}
              {selectedSubGoal.relatedPeople && selectedSubGoal.relatedPeople.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Related People</h3>
                  <div className="space-y-1">
                    {selectedSubGoal.relatedPeople.map((personId, index) => {
                      const person = memoryData.people.find(p => p.id === personId);
                      return (
                        <div key={index} className="text-sm text-gray-600">
                          {person ? person.name : `Person ID: ${personId}`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sub-goals (if any) */}
            {selectedSubGoal.subGoalIds && selectedSubGoal.subGoalIds.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Sub-goals ({selectedSubGoal.subGoalIds.length})
                </h3>
                <RecursiveSubGoals goal={selectedSubGoal} />
              </div>
            )}

            {/* Obstacles */}
            {selectedSubGoal.obstacles && selectedSubGoal.obstacles.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Obstacles</h3>
                <ul className="space-y-1">
                  {selectedSubGoal.obstacles.map((obstacle, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start">
                      <span className="text-red-400 mr-2">•</span>
                      {obstacle}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Extracted Context */}
            {selectedSubGoal.extractedFrom && selectedSubGoal.extractedFrom.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Context & Quotes</h3>
                <div className="space-y-3">
                  {selectedSubGoal.extractedFrom.map((source, index) => (
                    <div key={index} className="border-l-4 border-orange-200 pl-4 py-2 bg-orange-50">
                      <div className="text-xs text-gray-500 mb-1">
                        {new Date(source.date).toLocaleDateString()} - {source.type}
                      </div>
                      <div className="text-sm text-gray-700 italic">
                        "{source.relevantQuote}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={closeModal}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Your Personal Memories</h2>
        <div className="text-sm text-gray-500">
          {categories.find(c => c.id === 'all')?.count || 0} total memories extracted
        </div>
      </div>

      {/* Search and Category Filter */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === category.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.label} ({category.count})
            </button>
          ))}
        </div>
        
        <div className="max-w-md">
          <input
            type="text"
            placeholder="Search memories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Memory Grid */}
      <div className="space-y-8">
        {filteredData.people.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
              <span className="mr-2">👥</span>
              People ({filteredData.people.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.people.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          </div>
        )}


        {filteredData.goals.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center">
              <span className="mr-2">🎯</span>
              Goals ({filteredData.goals.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} allGoals={memoryData.goals} />
              ))}
            </div>
          </div>
        )}

        {filteredData.memories.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">💭</span>
              General Memories ({filteredData.memories.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.memories.map((memory) => (
                <GeneralMemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          </div>
        )}

        {/* No results message */}
        {Object.values(filteredData).every(arr => arr.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-lg mb-2">No memories found</p>
            <p className="text-sm">
              {searchTerm ? 'Try adjusting your search terms.' : 'No memories have been extracted yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Render the modal */}
      <SubGoalModal />
    </div>
  );
} 