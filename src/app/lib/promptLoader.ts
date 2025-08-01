import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface PromptConfig {
  text: string;
  description: string;
  default_model: string;
  provider: string;
  response_format?: string;
  response_schema?: any;
  thinking_budget?: number;
  include_thoughts?: boolean;
  meta: {
    authors: string[];
    category: string;
    use_case: string;
    filter_words?: string[];
  };
  version: string;
}

export class PromptLoader {
  private static promptsCache: Map<string, PromptConfig> = new Map();

  /**
   * Load a prompt from a YAML file
   * @param promptPath - Path relative to the prompts folder (e.g., 'journal/generate-entry')
   * @returns Parsed prompt configuration
   */
  static loadPrompt(promptPath: string): PromptConfig {
    // Check cache first
    if (this.promptsCache.has(promptPath)) {
      return this.promptsCache.get(promptPath)!;
    }

    const fullPath = path.join(process.cwd(), 'src', 'app', 'prompts', `${promptPath}.yml`);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Prompt file not found: ${fullPath}`);
    }

    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const promptConfig = yaml.parse(fileContent) as PromptConfig;

    // Cache the parsed prompt
    this.promptsCache.set(promptPath, promptConfig);

    return promptConfig;
  }

  /**
   * Load a prompt and substitute variables in the text
   * @param promptPath - Path relative to the prompts folder
   * @param variables - Object containing variables to substitute
   * @returns Prompt text with variables substituted
   */
  static getPromptText(promptPath: string, variables: Record<string, any> = {}): string {
    const promptConfig = this.loadPrompt(promptPath);
    let promptText = promptConfig.text;

    // Substitute variables using simple string replacement
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      promptText = promptText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), stringValue);
    });

    return promptText;
  }

  /**
   * Get the full prompt configuration
   * @param promptPath - Path relative to the prompts folder
   * @returns Full prompt configuration
   */
  static getPromptConfig(promptPath: string): PromptConfig {
    return this.loadPrompt(promptPath);
  }

  /**
   * Clear the prompt cache (useful for development)
   */
  static clearCache(): void {
    this.promptsCache.clear();
  }

  /**
   * List all available prompts
   * @returns Array of available prompt paths
   */
  static listPrompts(): string[] {
    const promptsDir = path.join(process.cwd(), 'src', 'app', 'prompts');
    const prompts: string[] = [];

    function scanDirectory(dir: string, relativePath: string = '') {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          scanDirectory(fullPath, path.join(relativePath, item));
        } else if (item.endsWith('.yml')) {
          const promptPath = path.join(relativePath, item.replace('.yml', ''));
          prompts.push(promptPath.replace(/\\/g, '/')); // Normalize path separators
        }
      }
    }

    if (fs.existsSync(promptsDir)) {
      scanDirectory(promptsDir);
    }

    return prompts;
  }
}

export default PromptLoader; 