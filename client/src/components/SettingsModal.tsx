import { motion } from "framer-motion";
import { Settings, Volume2, VolumeX, Music } from "lucide-react";
import { useState, useEffect } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [musicVolume, setMusicVolume] = useState(30);
  const [sfxVolume, setSfxVolume] = useState(50);
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>('high');

  useEffect(() => {
    // Load settings from localStorage
    const savedMusic = localStorage.getItem('musicVolume');
    const savedSfx = localStorage.getItem('sfxVolume');
    const savedQuality = localStorage.getItem('graphicsQuality');
    
    if (savedMusic) setMusicVolume(parseInt(savedMusic));
    if (savedSfx) setSfxVolume(parseInt(savedSfx));
    if (savedQuality) setGraphicsQuality(savedQuality as any);
  }, []);

  const handleMusicChange = (value: number) => {
    setMusicVolume(value);
    localStorage.setItem('musicVolume', value.toString());
    window.dispatchEvent(new CustomEvent('musicVolumeChange', { detail: value / 100 }));
  };

  const handleSfxChange = (value: number) => {
    setSfxVolume(value);
    localStorage.setItem('sfxVolume', value.toString());
    window.dispatchEvent(new CustomEvent('sfxVolumeChange', { detail: value / 100 }));
  };

  const handleQualityChange = (quality: 'low' | 'medium' | 'high') => {
    setGraphicsQuality(quality);
    localStorage.setItem('graphicsQuality', quality);
    window.dispatchEvent(new CustomEvent('graphicsQualityChange', { detail: quality }));
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card p-8 rounded-2xl neon-box max-w-md w-full border-2 border-primary/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-display text-primary flex items-center gap-2">
            <Settings className="w-8 h-8" /> SETTINGS
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Music Volume */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white font-display flex items-center gap-2">
                <Music className="w-5 h-5" /> Music Volume
              </label>
              <span className="text-primary font-bold">{musicVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume}
              onChange={(e) => handleMusicChange(parseInt(e.target.value))}
              className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* SFX Volume */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white font-display flex items-center gap-2">
                {sfxVolume > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                Sound Effects
              </label>
              <span className="text-primary font-bold">{sfxVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVolume}
              onChange={(e) => handleSfxChange(parseInt(e.target.value))}
              className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Graphics Quality */}
          <div>
            <label className="text-white font-display mb-3 block">Graphics Quality</label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((quality) => (
                <button
                  key={quality}
                  onClick={() => handleQualityChange(quality)}
                  className={`
                    py-2 px-4 rounded border-2 transition-all font-display text-sm uppercase
                    ${graphicsQuality === quality
                      ? 'border-primary bg-primary/20 text-primary shadow-[0_0_15px_hsla(var(--primary)/0.5)]'
                      : 'border-primary/30 bg-background/50 text-primary/60 hover:border-primary/50'
                    }
                  `}
                >
                  {quality}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-white/40 text-center pt-4 border-t border-white/10">
            Settings are saved automatically
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
