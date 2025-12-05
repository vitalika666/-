
import React, { useState, useEffect, useRef } from 'react';
import { GameStatus, GameState } from './types';
import { generateStorySegment, generateSceneImage } from './services/geminiService';
import Button from './components/Button';
import Typewriter from './components/Typewriter';

const App: React.FC = () => {
  // Start in LOADING state for auto-start
  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.LOADING,
    history: [],
    currentStory: null,
    currentImage: null,
    turnCount: 1
  });
  
  // Track last choice for retry functionality
  const [lastChoice, setLastChoice] = useState<string | null>(null);

  const scrollEndRef = useRef<HTMLDivElement>(null);

  const startGame = async () => {
    setGameState(prev => ({ ...prev, status: GameStatus.LOADING, errorMessage: undefined, turnCount: 1 }));
    setLastChoice(null);
    
    try {
      // 1. Get Story Text (Turn 1)
      const story = await generateStorySegment([], undefined, 1);
      
      // 2. Get Image
      const image = await generateSceneImage(story.visualDescription);
      
      setGameState(prev => ({
        ...prev,
        status: GameStatus.PLAYING,
        history: [JSON.stringify(story)],
        currentStory: story,
        currentImage: image,
        turnCount: 1
      }));

    } catch (e: any) {
      console.error(e);
      const isQuota = e?.status === 429 || e?.code === 429 || e?.message?.includes('quota');
      setGameState(prev => ({ 
        ...prev, 
        status: GameStatus.ERROR, 
        errorMessage: isQuota 
          ? "Слишком много запросов. Косте нужно отдышаться (подождите 5 сек)." 
          : "Костя не смог загрузить реальность." 
      }));
    }
  };

  const handleChoice = async (choice: string) => {
    if (!gameState.currentStory) return;
    
    // Save choice for retry
    setLastChoice(choice);

    const updatedHistory = [...gameState.history, `Player Choice: ${choice}`];
    const nextTurn = gameState.turnCount + 1;
    
    setGameState(prev => ({ ...prev, status: GameStatus.LOADING }));

    try {
      // 1. Get Story Text
      const story = await generateStorySegment(updatedHistory, choice, nextTurn);

      // 2. Get Image
      const image = await generateSceneImage(story.visualDescription);
      
      setGameState(prev => ({
        ...prev,
        status: story.gameStatus === 'PLAYING' ? GameStatus.PLAYING : (story.gameStatus === 'VICTORY' ? GameStatus.VICTORY : GameStatus.GAME_OVER),
        history: [...updatedHistory, JSON.stringify(story)],
        currentStory: story,
        currentImage: image,
        turnCount: nextTurn
      }));

    } catch (e: any) {
      console.error(e);
      const isQuota = e?.status === 429 || e?.code === 429 || e?.message?.includes('quota');
      setGameState(prev => ({ 
        ...prev, 
        status: GameStatus.ERROR, 
        errorMessage: isQuota 
           ? "Сервер перегрелся от базы. Подожди пару секунд и нажми кнопку ниже." 
           : "Шапа дудосит сервер." 
      }));
    }
  };

  const resetGame = () => {
    startGame();
  };

  const retryLastAction = () => {
    if (lastChoice) {
      handleChoice(lastChoice);
    } else {
      startGame();
    }
  };

  useEffect(() => {
    startGame();
  }, []);

  if (gameState.status === GameStatus.LOADING) {
    return (
      <div className="h-[100dvh] bg-gray-900 text-white flex flex-col items-center justify-center p-4 overscroll-none">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm animate-pulse text-center font-bold pixel-font text-blue-400">
          {gameState.turnCount === 1 ? "ЗАГРУЗКА..." : "ГЕНЕРАЦИЯ..."}
        </p>
      </div>
    );
  }

  if (gameState.status === GameStatus.ERROR) {
    return (
      <div className="h-[100dvh] bg-red-900/20 flex items-center justify-center p-4 overscroll-none">
        <div className="bg-gray-800 p-4 rounded-lg text-center max-w-sm w-full border border-red-500 shadow-2xl">
          <h2 className="text-lg text-red-500 mb-2 font-bold uppercase">Ошибка связи</h2>
          <p className="text-white text-sm mb-6 leading-relaxed">{gameState.errorMessage}</p>
          <div className="flex flex-col gap-3">
             <Button onClick={retryLastAction} variant="primary">Попробовать снова</Button>
             <Button onClick={resetGame} variant="secondary">Сброс игры</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gray-900 text-gray-100 font-sans flex flex-col items-center overflow-hidden overscroll-none">
      <div className="w-full max-w-2xl bg-gray-800 h-full flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header - Added pt-safe-t for mobile notch/status bar */}
        <header className="bg-gray-900 pt-safe-t px-3 pb-2 border-b border-gray-700 flex justify-between items-center shrink-0 z-20 shadow-md min-h-[50px] box-content">
          <div className="flex flex-col justify-center h-full pt-1">
             <h1 className="font-bold text-xs text-blue-400 pixel-font truncate">Костя vs Алина</h1>
          </div>
          <div className="flex gap-2 items-center pt-1">
             <span className="text-[10px] text-gray-500 font-mono uppercase">ХОД {gameState.turnCount}/10</span>
             <button onClick={resetGame} className="text-[10px] text-red-400 hover:text-red-300 py-1 px-1 border border-red-900/50 rounded bg-red-900/10 transition-colors">СБРОС</button>
          </div>
        </header>

        {/* Image - 16:9 Aspect Ratio */}
        <div className="shrink-0 relative w-full aspect-video bg-black overflow-hidden border-b-2 border-gray-700 group flex items-center justify-center">
           {gameState.currentImage ? (
             <img 
               src={gameState.currentImage} 
               alt="Scene" 
               className="w-full h-full object-cover"
             />
           ) : (
             <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-900 text-xs gap-2 p-4">
               <span className="text-2xl opacity-50">📵</span>
               <span className="text-center">Камера села (Лимит API)</span>
             </div>
           )}

           <div className="absolute top-2 right-2 pointer-events-none">
              {gameState.status === GameStatus.VICTORY && (
                <span className="bg-green-600/90 backdrop-blur text-white px-2 py-0.5 rounded-full font-bold shadow-lg animate-bounce text-[10px] uppercase">ПОБЕДА</span>
              )}
              {gameState.status === GameStatus.GAME_OVER && (
                <span className="bg-red-600/90 backdrop-blur text-white px-2 py-0.5 rounded-full font-bold shadow-lg text-[10px] uppercase">ДОМА</span>
              )}
           </div>
        </div>

        {/* Content Area - Fills space, no gaps */}
        <main className="flex-grow flex flex-col bg-gray-800/80 overflow-hidden relative">
            <div className="flex-grow overflow-y-auto p-4 game-scroll">
              {gameState.currentStory && (
                <div className="text-sm leading-6 text-gray-200 font-medium pb-4">
                  <Typewriter key={gameState.currentStory.storyText} text={gameState.currentStory.storyText} speed={5} />
                </div>
              )}
              <div ref={scrollEndRef}></div>
            </div>
        </main>

        {/* Controls - Added pb-safe-b for home indicator */}
        <footer className="p-3 bg-gray-900 border-t border-gray-700 shrink-0 pb-safe-b">
          <div className="grid grid-cols-1 gap-2">
            {gameState.status === GameStatus.PLAYING && gameState.currentStory && (
              gameState.currentStory.choices.map((choice, idx) => (
                <Button 
                  key={idx} 
                  onClick={() => handleChoice(choice)}
                  variant="secondary"
                  className="text-left text-sm py-3 px-4 active:bg-gray-700 leading-tight bg-gray-800 border-gray-700"
                >
                  {idx + 1}. {choice}
                </Button>
              ))
            )}

            {(gameState.status === GameStatus.VICTORY || gameState.status === GameStatus.GAME_OVER) && (
               <Button onClick={resetGame} variant={gameState.status === GameStatus.VICTORY ? "primary" : "danger"} className="py-3 text-sm uppercase tracking-wider">
                 Начать сначала
               </Button>
            )}
          </div>
        </footer>

      </div>
    </div>
  );
};

export default App;
