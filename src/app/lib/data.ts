// Type definitions
interface Author {
    role: string;
    name?: string;
    metadata?: Record<string, any>;
}

interface MessageContent {
    content_type: string;
    parts: string[];
}
interface Person {
    // Identifiers
    id: string;
    name: string;
    aliases?: string[];              // Other names they're referred to by
    
    // Relationship Details
    relationshipType: PersonRelationshipType;
    relationshipDescription: string; // "Close friend from college"
    
    
    // Personal Details
    personalityTraits: string[];    // ["supportive", "analytical", "creative"]
    physicalTraits: string[];    // ["supportive", "analytical", "creative"]
    // Memory Context
    firstMentioned: Date;
    lastMentioned: Date;
    extractedFrom: SourceReference[];
    mentionCount: number;
}

enum PersonRelationshipType {
    FAMILY = 'family',
    ROMANTIC_PARTNER = 'romantic_partner',
    EX_PARTNER = 'ex_partner',
    CLOSE_FRIEND = 'close_friend',
    FRIEND = 'friend',
    ACQUAINTANCE = 'acquaintance',
    OTHER = 'other'
}

interface Place {
    id: string;
    name: string;
    aliases?: string[];            // Other names for this place
    
    // Location Details
    type: PlaceType;
    address?: string;
    city?: string;
    country?: string;
    
    // Temporal Context
    visitFrequency: FrequencyType;      // How often user goes there
    
    // Memory Context
    firstMentioned: Date;
    lastMentioned: Date;
    mentionCount: number;
    extractedFrom: SourceReference[];
    
    physicalDescription?: string;
  }

  interface Event {
    // Identifiers
    id: string;
    title: string;
    aliases?: string[];           // Other ways this event is referred to
    
    // Event Details
    type: EventType;
    category: EventCategory;
    location?: Place;
    description: string;
    
    // Temporal Information
    date?: Date;
    startTime?: Date;
    endTime?: Date;
    duration?: string;           // "2 hours", "all day"
    timeframe: TimeFrame;        // past, present, future, recurring
    
    
    // Memory Context
    firstMentioned: Date;
    lastMentioned: Date;
    mentionCount: number;
    
    // Source Information
    extractedFrom: SourceReference[];
  }
  
  enum EventType {
    WORK = 'work',                    // Meetings, projects, career events
    SOCIAL = 'social',                // Gatherings, celebrations, social activities
    RELATIONSHIP = 'relationship',    // Family events, romantic, friendship milestones
    HEALTH = 'health',               // Medical, fitness, mental health events
    PERSONAL = 'personal',           // Learning, growth, transitions, achievements
    TRAVEL = 'travel',               // Trips, vacations, relocations
    CHALLENGE = 'challenge',         // Crisis, loss, difficult situations
    OTHER = 'other'
  }
  
  enum EventCategory {
    MAJOR = 'major',                  // Important, life-impacting events
    ROUTINE = 'routine',              // Regular, everyday occurrences
    MINOR = 'minor'                   // Small, less significant events
  }
  
  enum TimeFrame {
    PAST = 'past',
    PRESENT = 'present',
    FUTURE = 'future',
    RECURRING = 'recurring'
  }

  enum FrequencyType {
    DAILY = 'daily',
    WEEKLY = 'weekly', 
    MONTHLY = 'monthly',
    OCCASIONALLY = 'occasionally',
    RARELY = 'rarely',
    ONE_TIME = 'one_time'
}

  enum PlaceType {
    HOME = 'home',                    // Personal living space
    WORK = 'work',                    // Office, workplace, professional spaces
    SOCIAL = 'social',                // Restaurants, bars, entertainment venues
    HEALTH = 'health',                // Gym, medical, wellness facilities
    TRAVEL = 'travel',                // Destinations, cities, vacation spots
    OTHER = 'other'
  }

  interface SourceReference {
    type: 'conversation' | 'reflection' | 'journal_entry';
    date: Date;
    relevantQuote: string;       // The specific text that mentioned this
  }

interface Message {
    id: string;
    author?: Author;
    create_time?: number;
    update_time?: number;
    content?: MessageContent;
    status?: string;
    end_turn?: boolean;
    weight?: number;
    metadata?: Record<string, any>;
    recipient?: string;
    channel?: string;
}

interface ConversationNode {
    id: string;
    message?: Message;
    parent?: string;
    children?: string[];
}

interface ConversationData {
    title?: string;
    create_time?: number;
    update_time?: number;
    mapping?: Record<string, ConversationNode>;
    conversation_id?: string;
    id?: string;
}

interface ParsedMessage {
    date: Date;
    dateString: string;
    sender: string;
    text: string;
    conversationId: string;
    messageId: string;
    timestamp: number;
}

interface MessagesByDate {
    [dateString: string]: ParsedMessage[];
}

interface ParseResult {
    conversations: Conversations;
    journalEntries: JournalEntries;
}

interface SupportingQuote {
    text: string;
    conversationId: string;
    messageId: string;
    date: string;
}

interface ShadowTrait {
    name: string;
    description: string;
    reflectionPrompt: string;
    supportingQuote?: SupportingQuote;
}

interface CBTPrompt {
    category: string;
    question: string;
    purpose: string;
}

interface EmotionalSummary {
    colors: string[]; // Array of hex codes for spectrum
    label: string; // 1-3 words
    themes: ThemeWithQuote[]; // Array of emotional themes with quotes and descriptions
    description?: string; // optional but shorter, shown by default
}

interface ThemeWithQuote {
    theme: string;
    supportingQuote: string;
    description: string; // Detailed description of the emotional theme
}

interface ClusterResult {
    cluster_id: number;
    label: string;
    description: string; // Contextual description of how this emotional theme manifests
    color: string; // Hex color code
    themes: string[]; // Just theme texts for overview
    representative_themes: RepresentativeTheme[]; // Up to 3 themes with quotes
    total_themes_in_cluster: number;
}

interface ThemeResponse {
    clusters: ClusterResult[];
    total_themes: number;
    num_clusters: number;
}

interface ShadowTraitWithQuote {
    trait: string;
    supportingQuote: string;
    description: string; // Detailed description of the shadow trait
}

interface ShadowClusterResult {
    cluster_id: number;
    label: string;
    description: string; // Contextual description of how this shadow pattern manifests
    color: string; // Hex color code
    traits: string[]; // Just trait names for overview
    representative_traits: RepresentativeShadowTrait[]; // Up to 3 traits with quotes
    total_traits_in_cluster: number;
}

interface RepresentativeShadowTrait {
    trait: string;
    supportingQuote: string;
    distance_to_center: number;
}

interface ShadowTraitResponse {
    clusters: ShadowClusterResult[];
    total_traits: number;
    num_clusters: number;
}

interface JournalEntry {
    id: string;
    date: string;
    timestamp: number;
    reflectiveNarrative: string;
    emotionalSummary: EmotionalSummary;
    topics: string[];
    cbtPrompts: CBTPrompt[];
    keyTakeaways: string[];
    shadowSummary: string;
    shadowTraits: ShadowTrait[];
    keyDecisions?: string[];
    keyFailures?: string[];
    nextSteps: string[];
    sourceConversationIds: Set<string>;
}

interface JournalEntries {
    entries: JournalEntry[];
    stats: {
        totalEntries: number;
        dateRange: {
            earliest: string;
            latest: string;
        } | null;
    };
}

interface Conversation {
    id: string;
    title?: string;
    messages: ParsedMessage[];
    metadata: {
        createdAt: number;
        updatedAt: number;
    };
}

interface Conversations {
    conversations: Conversation[];
}

interface ProcessedData {
    conversations: Conversations;
    journalEntries: JournalEntries;
    themeAnalysis?: ThemeResponse;
    shadowTraitAnalysis?: ShadowTraitResponse;
    memoryData?: MemoryData;
}

interface MemoryData {
  people: Person[];
  goals: Goal[];
  generalMemories: GeneralMemory[];
  stats: {
    totalPeople: number;
    totalGoals: number;
    totalMemories: number;
  };
}

interface EmotionalTheme {
    theme: string;
    supportingQuote?: SupportingQuote;
}

interface RepresentativeTheme {
    theme: string;
    supportingQuote: string;
    distance_to_center: number;
}

interface ReflectionPrompt {
    phase: 'recognition' | 'challenge' | 'reframe';
    question: string;
    followUp?: string;
}

interface ChatMessage {
    id: string;
    sender: 'user' | 'system';
    content: string;
    timestamp: number;
}

interface ReflectionSession {
    id: string;
    themeId: string;
    theme: string;
    supportingQuote: string;
    messages: ChatMessage[];
    startedAt: number;
    completedAt?: number;
    status: 'active' | 'completed' | 'abandoned';
    reflectionType: 'emotionalclusterreflection' | 'shadowclusterreflection' | 'cbtreflection' | 'shadowreflection';
    dateString: string; // YYYY-MM-DD format for easy organization
}

interface ThemeReflectionData {
    theme: string;
    description: string;
    supportingQuote: string;
    prompts: ReflectionPrompt[];
}

enum GoalType {
  CAREER = 'career',               // Job, skills, education, business
  HEALTH = 'health',               // Fitness, mental health, diet, medical
  FINANCIAL = 'financial',         // Money, savings, debt, investments
  PERSONAL = 'personal',           // Habits, growth, creativity, confidence
  RELATIONSHIP = 'relationship',   // Family, friends, romantic, social
  LIFESTYLE = 'lifestyle',         // Travel, hobbies, home, experiences
  OTHER = 'other'
}

enum GoalStatus {
  PLANNING = 'planning',           // Just thinking about it
  ACTIVE = 'active',              // Actively working on it
  PAUSED = 'paused',              // Temporarily stopped
  COMPLETED = 'completed',         // Successfully achieved
  ABANDONED = 'abandoned',         // Given up on
}

enum GoalTimeframe {
  IMMEDIATE = 'immediate',         // This week
  SHORT_TERM = 'short_term',       // 1-3 months
  MEDIUM_TERM = 'medium_term',     // 3-12 months
  LONG_TERM = 'long_term',         // 1+ years
  ONGOING = 'ongoing'              // Continuous/habit-based
}

interface Goal {
  id: string;
  title: string;
  description: string;
  type: GoalType;
  status: GoalStatus;
  timeframe: GoalTimeframe;
  
  // Hierarchical structure
  parentGoalId?: string;         // ID of parent goal if this is a subgoal
  subGoalIds: string[];          // IDs of child goals/subgoals
  obstacles: string[];           // Challenges encountered
  
  // Timeline
  targetDate?: Date;
  startedDate?: Date;
  completedDate?: Date;
  
  // Connections
  relatedPeople: string[];       // Person IDs who support/are involved  
  // Simple tracking
  firstMentioned: Date;
  lastMentioned: Date;
  mentionCount: number;

  // Source tracking
  extractedFrom: SourceReference[];
}

enum MemoryTag {
  // Personal
  SKILL = 'skill',                 // "I'm good at presentations", "I struggle with math"
  PHYSICAL_TRAIT = 'physical_trait',                 // "I'm introverted", "I'm detail-oriented"
  AGE = 'age',                     // "I'm 25 years old", "I'm 30 years old"
  SEX = 'sex',                     // "I'm a male", "I'm a female"
  HEIGHT = 'height',               // "I'm 6'2", "I'm 5'8"
  WEIGHT = 'weight',               // "I'm 180lbs", "I'm 160lbs"
  BODY_TYPE = 'body_type',         // "I'm muscular", "I'm skinny"
  HAIR_COLOR = 'hair_color',       // "I'm blonde", "I'm brown"
  EYE_COLOR = 'eye_color',         // "I'm blue", "I'm brown"
  SKIN_TONE = 'skin_tone',         // "I'm fair", "I'm dark"
  OCCUPATION = 'occupation',       // "I'm a software engineer", "I'm a student"
  EDUCATION = 'education',         // "I'm a student", "I'm a graduate"
  INCOME = 'income',               // "I make $100,000", "I make $50,000"
  NAME = 'name',                   // "I'm John", "I'm Sarah"


  // Emotional/Mental
  RELATIONSHIP_STATUS = 'relationship_status', // "I'm in a relationship", "I'm single"
  FAMILY_DETAILS = 'family_details', // "I have a brother", "I have a sister"
  
  ROUTINE = 'routine',             // "I meditate every morning"
  PERSONAL_VALUES = 'personal_values', // "I value honesty", "I value hard work"
  HOME_LOCATION = 'home_location', // "I live in NYC", "I live in Austin"
  RELIGION = 'religion', // "I'm a Christian", "I'm a Muslim"
  NATIONALITY = 'nationality', // "I'm a white male", "I'm a black female"
  ETHNICITY = 'ethnicity', // "I'm a white male", "I'm a black female"
  PLACE_OF_BIRTH = 'place_of_birth', // "I was born in NYC", "I was born in Austin"
}

interface GeneralMemory {
  id: string;
  content: string;              // The actual memory/information
  tag: MemoryTag;            // Multiple tags for categorization
  lastUpdated?: Date;

  extractedFrom: SourceReference[];
}

export type {
    Author,
    MessageContent,
    Message,
    ConversationNode,
    ConversationData,
    ParsedMessage,
    MessagesByDate,
    ParseResult,
    JournalEntry,
    JournalEntries,
    ShadowTrait,
    CBTPrompt,
    EmotionalSummary,
    ThemeWithQuote,
    ClusterResult,
    ThemeResponse,
    ShadowTraitWithQuote,
    ShadowClusterResult,
    RepresentativeShadowTrait,
    ShadowTraitResponse,
    Conversation,
    Conversations,
    ProcessedData,
    MemoryData,
    SupportingQuote,
    EmotionalTheme,
    RepresentativeTheme,
    ReflectionPrompt,
    ChatMessage,
    ReflectionSession,
    ThemeReflectionData,
    // Memory System Types
    Person,
    PersonRelationshipType,
    PlaceType,
    EventType,
    Goal,
    GoalType,
    GoalStatus,
    GoalTimeframe,
    GeneralMemory,
    MemoryTag,
    SourceReference
};
