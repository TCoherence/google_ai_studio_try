
export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  searchQueries?: string[];
  // If the message contains a plan to be reviewed
  plan?: ResearchPlan;
}

export interface ResearchStep {
  id: string;
  query: string;
  status: 'pending' | 'researching' | 'completed' | 'failed';
  finding?: string;
  sources?: Source[];
}

export interface ResearchPlan {
  topic: string;
  steps: ResearchStep[];
}

export interface Source {
  title: string;
  uri: string;
}

export interface ArtifactState {
  title: string;
  content: string;
  // Status helps UI decide what to show (loading spinner, progress list, or final text)
  phase: 'idle' | 'planning' | 'reviewing' | 'researching' | 'reporting' | 'completed';
  sources: Source[];
  currentStepId?: string; // To highlight what's being researched currently
}

export enum ViewMode {
  CHAT = 'CHAT',
  SPLIT = 'SPLIT',
  ARTIFACT = 'ARTIFACT'
}
