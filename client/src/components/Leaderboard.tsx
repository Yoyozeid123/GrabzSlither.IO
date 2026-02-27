import { motion } from "framer-motion";
import { useHighscores } from "@/hooks/use-highscores";
import { Trophy, Activity, Skull } from "lucide-react";

export function Leaderboard() {
  const { data: scores, isLoading } = useHighscores();

  return (
    <div className="w-full max-w-md bg-black/60 backdrop-blur-md border border-primary/30 p-6 rounded-xl relative overflow-hidden neon-box shadow-2xl">
      {/* Decorative scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none z-0 opacity-50" />
      
      <div className="relative z-10">
        <h2 className="text-2xl text-primary font-display flex items-center justify-center gap-3 mb-6 neon-text">
          <Trophy className="w-6 h-6" /> GLOBAL RANKINGS <Trophy className="w-6 h-6" />
        </h2>

        {isLoading ? (
          <div className="flex justify-center items-center h-48 text-primary">
            <Activity className="w-8 h-8 animate-pulse" />
            <span className="ml-3 font-display animate-pulse">LOADING_DATA...</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {!scores || scores.length === 0 ? (
              <div className="text-center text-primary/50 py-8 font-display">
                <Skull className="w-12 h-12 mx-auto mb-2 opacity-50" />
                NO RECORDS FOUND.<br/>BE THE FIRST.
              </div>
            ) : (
              scores.map((score, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={score.id}
                  className={`
                    flex justify-between items-center p-3 border-b border-primary/20
                    ${idx === 0 ? 'bg-primary/20 border-primary shadow-[inset_0_0_10px_hsla(var(--primary)/0.3)]' : 'bg-black/40 hover:bg-primary/5'}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <span className={`font-display font-bold w-6 text-center ${idx < 3 ? 'text-accent neon-text-pink' : 'text-primary/70'}`}>
                      #{idx + 1}
                    </span>
                    <span className="font-sans text-lg text-white truncate max-w-[150px]">
                      {score.playerName}
                    </span>
                  </div>
                  <span className="font-display font-bold text-primary">
                    {score.score.toLocaleString()}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
