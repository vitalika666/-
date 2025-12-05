
export enum GameStatus {
  START = 'START',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  ERROR = 'ERROR'
}

export interface StoryResponse {
  storyText: string;
  choices: string[];
  visualDescription: string;
  gameStatus: 'PLAYING' | 'VICTORY' | 'GAME_OVER';
}

export interface GameState {
  status: GameStatus;
  history: string[]; // Chat history for context
  currentStory: StoryResponse | null;
  currentImage: string | null;
  errorMessage?: string;
  turnCount: number;
}
