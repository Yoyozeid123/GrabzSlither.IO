import { useHighscores } from "@/hooks/use-highscores";
import { motion } from "framer-motion";
import { Trophy, Activity, Terminal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LeaderboardPanel() {
  const { data: scores, isLoading, error } = useHighscores();

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-black/60 backdrop-blur-md border border-primary/30 p-6 rounded-lg shadow-[0_0_30px_hsl(var(--primary)/0.15)] w-full max-w-sm h-[400px] flex flex-col"
    >
      <div className="flex items-center gap-3 border-b border-primary/30 pb-4 mb-4">
        <Trophy className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-display text-primary text-glow m-0 tracking-widest">Global Top 10</h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-6 w-32 bg-primary/10" />
                <Skeleton className="h-6 w-12 bg-primary/10" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-destructive/80 font-mono text-center">
            <Activity className="w-8 h-8 mb-2 opacity-50" />
            <p>Database Offline</p>
            <p className="text-xs mt-1">Unable to fetch secure logs</p>
          </div>
        ) : scores && scores.length > 0 ? (
          <div className="space-y-3 font-mono">
            {scores.slice(0, 10).map((score, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={score.id} 
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className={`w-6 font-bold ${idx === 0 ? 'text-secondary text-glow-pink' : idx < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                    #{idx + 1}
                  </span>
                  <span className="text-foreground/90 truncate max-w-[180px] group-hover:text-white transition-colors">
                    {score.playerName}
                  </span>
                </div>
                <span className={`font-bold ${idx === 0 ? 'text-secondary' : 'text-primary'}`}>
                  {score.score}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-primary/50 font-mono text-center">
            <Terminal className="w-8 h-8 mb-2 opacity-50" />
            <p>NO RECORDS FOUND</p>
            <p className="text-xs mt-1">Be the first to upload.</p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 255, 0, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.5); border-radius: 4px; }
      `}} />
    </motion.div>
  );
}
