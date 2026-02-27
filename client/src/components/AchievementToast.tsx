import { motion, AnimatePresence } from "framer-motion";
import { Achievement } from "@/lib/achievements";

interface AchievementToastProps {
  achievement: Achievement | null;
  onClose: () => void;
}

export function AchievementToast({ achievement, onClose }: AchievementToastProps) {
  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="fixed top-24 right-4 z-50 bg-card/95 backdrop-blur-xl border-2 border-primary rounded-lg p-4 shadow-[0_0_30px_hsla(var(--primary)/0.5)] min-w-[300px]"
          onAnimationComplete={() => {
            setTimeout(onClose, 3000);
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-5xl">{achievement.icon}</div>
            <div className="flex-1">
              <div className="text-primary font-display text-sm tracking-widest">ACHIEVEMENT UNLOCKED</div>
              <div className="text-white font-bold text-lg">{achievement.name}</div>
              <div className="text-white/60 text-sm">{achievement.description}</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
