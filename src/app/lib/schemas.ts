import { Type } from "@google/genai";

// Journal Entry Generation Schema
export const journalEntrySchema = {
  type: Type.OBJECT,
  properties: {
    reflectiveNarrative: {
      type: Type.STRING,
      description: "Write this as if the user is writing in their personal journal, using their own voice and writing style. Output in **markdown format** with proper line breaks, emphasis, and formatting. Analyze the user's language patterns and mirror their tone. Write in first person as if they're reflecting on their day. Use markdown formatting like **bold** for emphasis, separate thoughts with double line breaks, and make it feel like an intimate, personal reflection - not a report about conversations. Don't mention ChatGPT, the assistant,the AI, or 'conversations' - just focus on the thoughts, feelings, and insights as if they naturally occurred to the user. Example format:\n\nToday I found myself thinking about...\n\nI noticed that I keep **struggling** with...\n\nThere's something about the way I approach..."
    },
    emotionalSummary: {
      type: Type.OBJECT,
      properties: {
        colors: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "An array of 2-4 hex color codes that represent the emotional spectrum (e.g., ['#3B82F6', '#10B981'] for calm transitioning to content, or ['#EF4444', '#F59E0B'] for stressed moving to energetic)"
        },
        label: {
          type: Type.STRING,
          description: "A 1-3 word emotional label that captures the dominant feeling (e.g., 'Focused', 'Mixed Emotions', 'Contemplative', 'Energetic', 'Conflicted').The goal is to capture the user's emotional state in a way that is easy to understand and relatable."
        },
        themes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              theme: { 
                type: Type.STRING,
                description: "A single word or short phrase that captures the emotional theme. It should be short direct label that describes specifically what this pattern is for this user. Bonus points if you can relate it to a specific event or situation. E.G Class Scheduling Anxiety. Always go for concrete and specific over abstract and general."
              },
              description: { 
                type: Type.STRING,
                description: "A short description(1-2 sentences) that describes the emotional theme in a way that is easy to understand and relatable."
              },
              supportingQuote: { 
                type: Type.STRING,
                description: "A specific quote from the USER (not ChatGPT or assistant) that illustrates this emotional theme. Should be exact text from their messages."
              }
            },
            required: ["theme", "description", "supportingQuote"]
          },
          description: "An array of emotional themes from the day These should be single words or short phrases that describe the specific emotional theme for this user."
        },
        description: {
          type: Type.STRING,
          description: "Optional: A brief sentence (10-15 words max) that captures the emotional nuance. It should be a single sentence that captures that remind the user of their emotional state on that day. 1st person."
        }
      },
      required: ["colors", "label", "themes"]
    },
    topics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of 3-6 main topics or subjects discussed in the conversations. These should be specific enough to be meaningful but broad enough to be useful for categorization. Examples: ['career planning', 'relationship dynamics', 'creative projects', 'financial goals', 'health concerns', 'learning new skills']. Focus on the substantive themes rather than just keywords."
    },
    cbtPrompts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          question: { 
            type: Type.STRING,
            description: "Write this as if the user is asking themselves this question about what specifically happened TODAY. Reference actual events, conversations, or situations from their day. Use simple, accessible language that mirrors how they might actually think or talk to themselves. Examples: 'Why did I react that way when [specific situation from today]?' or 'What was I really feeling when [specific event]?' Make it personal, conversational, and directly tied to their actual day."
          },
          purpose: { 
            type: Type.STRING,
            description: "A brief, simple explanation of why this question might be helpful for them to explore, written in plain language."
          }
        }
      },
      description: "A list of 1-3 self-reflection questions that are specifically about what happened on this day. Reference actual conversations, events, or situations from their day. Use accessible, conversational language that feels natural and personal rather than clinical or formal."
    },
    shadowSummary: {
      type: Type.STRING,
      description: "A brief, reflective overview of the user's potential shadow patterns — written with the tone of a wise, emotionally intelligent therapist like Robert Greene. This summary should be thoughtful, non-judgmental, and focused on helping the user understand and productively channel these patterns. Invite reflection; avoid conclusions. Use soft language like 'you may notice' or 'at times.' Close with a reflective question to guide their journaling."
    },
    shadowTraits: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { 
            type: Type.STRING,
            description: "Use simple, direct trait names that are easy to understand. A shadow trait is a Examples include: 'Fear of being Mediocre', 'Insecurity in Physical appearance','Extreme Agression', 'Extreme judgement', 'Need to control social social o'"
          },
          description: { 
            type: Type.STRING,
            description: "Write this as if you're a wise therapist speaking directly to the user in Robert Greene's style. Use 'you' throughout. Be compassionate but insightful. Help them understand this pattern without judgment. For example: 'You seem to have a tendency to...' or 'There's a part of you that appears to...' Make it feel like a gentle observation from someone who truly sees and understands them. If you can, figure out what the root cause of the trait is and describe it in a way that is easy to understand and relatable."
          },
          reflectionPrompt: { type: Type.STRING },
          supportingQuote: { 
            type: Type.STRING,
            description: "A specific quote from the USER (not ChatGPT) that illustrates this shadow trait. Should be exact text from their messages."
          }
        }
      },
      description: "A list of 1-3 shadow traits observed from the user's entries. Focus on actual traits/patterns, Since these are shadow traits, negative trait names are appropriate and expected. Use simple, direct language that people can easily understand. More deep and specific the better."
    },
    keyDecisions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Important decisions made or discussed"
    },
    keyFailures: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Setbacks or challenges encountered"
    },
    nextSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Action items and future intentions"
    }
  },
  required: ["reflectiveNarrative", "emotionalSummary", "topics", "cbtPrompts", "nextSteps"]
};

// Memory Extraction Schema
export const memoryExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    generalMemories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { 
            type: Type.STRING,
            description: "Only include if updating existing memory, use the ID from the existing memories list above"
          },
          content: { type: Type.STRING },
          tag: { 
            type: Type.STRING, 
            enum: ['skill', 'physical_trait', 'name', 'age', 'sex', 'height', 'weight', 'body_type', 'hair_color', 'eye_color', 'skin_tone', 'occupation', 'education', 'relationship_status', 'family_details', 'routine','personal_values','religion','nationality','ethnicity','place_of_birth','home_location','income'] 
          },
          quote: { type: Type.STRING }
        },
        required: ["content", "tag", "quote"],
        description: "ALL memory mentions. Include ID if existing memory, omit ID if new memory."
      }
    }
  },
  required: ["generalMemories"]
};

// Simple JSON Response Schema (for conversational prompts)
export const simpleResponseSchema = {
  type: Type.OBJECT,
  properties: {
    response: {
      type: Type.STRING,
      description: "The response message"
    }
  },
  required: ["response"]
};

// Helper function to get config for prompts with thinking enabled
export const getConfigWithThinking = (schema: any) => ({
  responseMimeType: "application/json" as const,
  responseSchema: schema,
  thinkingConfig: {
    thinkingBudget: -1,
    includeThoughts: true,
  }
});

// Helper function to get simple JSON config
export const getSimpleJsonConfig = (schema: any = simpleResponseSchema) => ({
  responseMimeType: "application/json" as const,
  responseSchema: schema
});

export default {
  journalEntrySchema,
  memoryExtractionSchema,
  simpleResponseSchema,
  getConfigWithThinking,
  getSimpleJsonConfig
}; 