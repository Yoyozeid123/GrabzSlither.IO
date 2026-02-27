import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { GameCanvas } from "@/components/GameCanvas";
import { CyberInput } from "@/components/CyberInput";
import { NeonButton } from "@/components/NeonButton";
import { ColorPicker } from "@/components/ColorPicker";
import { Leaderboard } from "@/components/Leaderboard";
import { useCreateHighscore } from "@/hooks/use-highscores";
import { Trophy, Activity, Ghost } from "lucide-react";

// Static logo import as requested
import logo from '@assets/snake-removebg-preview_1772181540141.png';

type GameState = "MENU" | "PLAYING" | "GAMEOVER";

export default function Home() {
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [playerName, setPlayerName] = useState("");
  const [selectedHue, setSelectedHue] = useState(120); // Default Neon Green
  const [finalScore, setFinalScore] = useState(0);

  // In-game HUD State
  const [currentScore, setCurrentScore] = useState(100);
  const [currentRank, setCurrentRank] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(1);
  const [gameLeaders, setGameLeaders] = useState<{name: string, length: number, isPlayer: boolean}[]>([]);

  const createScoreMutation = useCreateHighscore();

  const handleStartGame = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!playerName.trim()) {
      // Basic shake or visual feedback could go here
      return;
    }
    setGameState("PLAYING");
  };

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setGameState("GAMEOVER");
    
    // Submit score to backend
    createScoreMutation.mutate({ playerName, score });
    
    // Fire confetti for dramatic effect
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#39ff14', '#ff00ff', '#00ffff']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#39ff14', '#ff00ff', '#00ffff']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, [playerName, createScoreMutation]);

  return (
    <div className="relative w-full h-screen overflow-hidden scanline bg-background text-foreground">
      
      {/* Background ambient grid visible mainly in menu */}
      {(gameState === "MENU" || gameState === "GAMEOVER") && (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(57,255,20,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(57,255,20,0.05)_1px,transparent_1px)] bg-[size:50px_50px] z-0 pointer-events-none" />
      )}

      <AnimatePresence mode="wait">
        
        {/* === MAIN MENU === */}
        {gameState === "MENU" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 1.1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="absolute inset-0 flex flex-col items-center justify-center z-50 p-4"
          >
            {/* Animated background snakes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    background: `hsl(${i * 45}, 100%, 50%)`,
                    boxShadow: `0 0 30px hsl(${i * 45}, 100%, 50%)`,
                    filter: 'blur(1px)',
                  }}
                  animate={{
                    x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth, Math.random() * window.innerWidth],
                    y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight, Math.random() * window.innerHeight],
                    scale: [1, 1.5, 1],
                  }}
                  transition={{
                    duration: 20 + i * 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            <div className="bg-card/90 backdrop-blur-xl p-8 md:p-12 rounded-2xl neon-box max-w-lg w-full flex flex-col items-center border border-primary/30 shadow-2xl relative overflow-hidden">
              
              {/* Animated glowing bg orb */}
              <motion.div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 4, repeat: Infinity }}
              />

              <motion.div className="relative mb-6 flex items-center justify-center">
                {/* Multiple pulsing rings */}
                <motion.div
                  className="absolute w-56 h-56 border-2 border-primary/40 rounded-full"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <motion.div
                  className="absolute w-56 h-56 border-2 border-accent/40 rounded-full"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                />
                <motion.div
                  className="absolute w-56 h-56 border-2 border-cyan-400/40 rounded-full"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 2 }}
                />
                
                {/* Rotating glow effect */}
                <motion.div
                  className="absolute w-60 h-60 rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent, rgba(57,255,20,0.3), transparent)',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />
                
                <motion.img 
                  src={logo} 
                  alt="GrabzSlither Logo" 
                  className="w-48 h-48 object-contain drop-shadow-[0_0_30px_rgba(57,255,20,0.8)] relative z-10"
                  animate={{ 
                    y: [0, -12, 0],
                    rotate: [0, 3, -3, 0],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                />
              </motion.div>
              
              <form onSubmit={handleStartGame} className="w-full space-y-8 relative z-10">
                <div>
                  <CyberInput 
                    placeholder="ENTER CODENAME..." 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={15}
                    required
                    autoFocus
                  />
                </div>
                
                <ColorPicker selectedHue={selectedHue} onChange={setSelectedHue} />
                
                <NeonButton type="submit" size="lg" className="w-full mt-4" disabled={!playerName.trim()}>
                  INITIALIZE LINK <Activity className="w-5 h-5 ml-2" />
                </NeonButton>
              </form>
            </div>
          </motion.div>
        )}

        {/* === GAMEPLAY === */}
        {gameState === "PLAYING" && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-10"
          >
            <GameCanvas 
              playerName={playerName} 
              selectedHue={selectedHue} 
              onGameOver={handleGameOver}
              updateUI={(score, rank, total) => {
                setCurrentScore(score);
                setCurrentRank(rank);
                setTotalPlayers(total);
              }}
              updateLeaderboard={setGameLeaders}
            />
            
            {/* HUD Overlay */}
            <div className="absolute top-4 left-4 pointer-events-none z-20 text-white font-display text-xl space-y-2 text-shadow-sm">
              <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded border border-primary/30 shadow-[0_0_10px_hsla(var(--primary)/0.2)]">
                <span className="text-primary/70">SCORE:</span> <span className="font-bold text-primary neon-text">{currentScore}</span>
              </div>
              <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded border border-accent/30 shadow-[0_0_10px_hsla(var(--accent)/0.2)]">
                <span className="text-accent/70">RANK:</span> <span className="font-bold text-accent neon-text-pink">{currentRank} / {totalPlayers}</span>
              </div>
            </div>

            {/* In-Game Mini Leaderboard */}
            <div className="absolute top-4 right-4 pointer-events-none z-20 bg-black/60 backdrop-blur-md rounded border border-white/10 p-3 min-w-[200px]">
              <h3 className="text-center font-display text-white/80 mb-2 text-sm tracking-widest border-b border-white/10 pb-1">MATCH LEADERS</h3>
              <div className="space-y-1">
                {gameLeaders.map((leader, i) => (
                  <div key={i} className={`flex justify-between font-sans text-sm ${leader.isPlayer ? 'text-primary font-bold' : 'text-white/60'}`}>
                    <span>{i+1}. {leader.name}</span>
                    <span>{leader.length}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* === GAME OVER === */}
        {gameState === "GAMEOVER" && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="absolute inset-0 flex flex-col md:flex-row items-center justify-center gap-8 z-50 p-4 bg-black/80 backdrop-blur-sm"
          >
            {/* Game Over Card */}
            <div className="bg-card p-8 rounded-2xl neon-box-pink max-w-sm w-full flex flex-col items-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-accent/5 pointer-events-none" />
              
              <Ghost className="w-20 h-20 text-accent mb-4 drop-shadow-[0_0_15px_hsl(var(--accent))]" />
              
              <h1 className="text-5xl mb-2 text-center text-destructive font-display font-black text-shadow-[0_0_20px_hsl(var(--destructive))]">
                SYSTEM<br/>FAILURE
              </h1>
              
              <div className="w-full h-px bg-gradient-to-r from-transparent via-accent to-transparent my-6" />
              
              <div className="text-center mb-8 space-y-2">
                <p className="font-display text-muted-foreground text-sm tracking-widest">FINAL SCORE</p>
                <p className="font-display text-5xl text-primary neon-text">{finalScore.toLocaleString()}</p>
              </div>

              {createScoreMutation.isPending && (
                <p className="text-primary animate-pulse text-sm font-sans mb-4">UPLOADING METRICS TO MAINFRAME...</p>
              )}

              <NeonButton 
                variant="accent" 
                onClick={() => setGameState("MENU")}
                className="w-full"
              >
                REBOOT SEQUENCE
              </NeonButton>
            </div>

            {/* Global Leaderboard Panel */}
            <Leaderboard />
            
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
