export interface Persona {
  Ein: string;
  Jan: string;
  Spike: string;
  Sherlock: string;
  Agatha: string;
  Jet: string;
  Warren: string;
}

export interface Model {
  id: string;
  host?: 'groq' | 'ollama' | 'gemini' | 'lmStudio' | 'openai' | 'openrouter' | 'custom' | string;
  active?: boolean;
  context_length?: number;
  name?: string;
}

export interface TtsSettings {
  selectedVoice?: string;
  rate?:number;
  pitch?:number;
  volume?:number;
}

export interface Config {
  personas: Record<string, string>;
  persona: string;
  generateTitle?: boolean;
  backgroundImage?: boolean;
  webMode?: 'Duckduckgo' | 'Brave' | 'Google' | 'Wikipedia' | 'GoogleCustomSearch' | string; // Added GoogleCustomSearch
  webLimit?: number;
  serpMaxLinksToVisit?: number;
  wikiNumBlocks?: number;
  wikiRerank?: boolean;
  wikiNumBlocksToRerank?: number;
  contextLimit: number;
  ModelSettingsPanel?: Record<string, unknown>;
  temperature: number;
  maxTokens: number;
  topP: number;
  presencepenalty: number;
  lmStudioUrl?: string;
  lmStudioConnected?: boolean;
  lmStudioError?: string | unknown;
  ollamaUrl?: string;
  ollamaConnected?: boolean;
  ollamaError?: string | unknown;
  groqApiKey?: string;
  groqConnected?: boolean;
  groqError?: string | unknown;
  geminiApiKey?: string;
  geminiConnected?: boolean;
  geminiError?: string | unknown;
  openAiApiKey?: string;
  openAiConnected?: boolean;
  openAiError?: string | unknown;
  openRouterApiKey?: string;
  openRouterConnected?: boolean;
  openRouterError?: string | unknown;
  customEndpoint?: string;
  customApiKey?: string;
  customConnected?: boolean;
  customError?: string | unknown;
  googleApiKey?: string; // Added for Google Custom Search
  googleCx?: string; // Added for Google Custom Search CX
  visibleApiKeys?: boolean;
  fontSize?: number;
  models?: Model[];
  selectedModel?: string;
  useNote?: boolean;
  noteContent?: string;
  chatMode?: 'web' | 'page' | 'chat' | string;
  theme?: string;
  customTheme?: {
    active?: string;
    bg?: string;
    text?: string;
    bold?: string;
    italic?: string;
    link?: string;
    codeBg?: string;
    codeFg?: string;
    preBg?: string;
    preFg?: string;
    mute?: string;
    tableBorder?: string;
    error?: string;
    success?: string;
    warning?: string;
    name?: string;
  };
  computeLevel: 'low' | 'medium' | 'high' | string;
  paperTexture?: boolean;
  panelOpen: boolean;
  tts?: TtsSettings;
}

export interface ConfigContextType {
  config: Config;
  updateConfig: (newConfig: Partial<Config>) => void;
}