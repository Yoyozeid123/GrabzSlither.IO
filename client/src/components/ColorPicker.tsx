import { motion } from "framer-motion";

interface ColorPickerProps {
  selectedHue: number;
  onChange: (hue: number) => void;
}

const HUES = [0, 30, 60, 120, 180, 240, 280, 320];

export function ColorPicker({ selectedHue, onChange }: ColorPickerProps) {
  return (
    <div className="w-full">
      <p className="font-display text-primary/80 mb-3 text-sm tracking-widest text-center">SELECT YOUR SNAKE</p>
      <div className="flex flex-wrap gap-4 justify-center">
        {HUES.map((hue) => (
          <motion.button
            key={hue}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(hue)}
            className={`
              w-12 h-12 rounded-full transition-all duration-200
              ${selectedHue === hue ? 'scale-110 shadow-[0_0_15px_currentColor] ring-2 ring-white border-2 border-transparent' : 'border-2 border-transparent hover:border-white/50'}
            `}
            style={{ 
              backgroundColor: `hsl(${hue}, 100%, 50%)`,
              color: `hsl(${hue}, 100%, 50%)` 
            }}
            aria-label={`Select hue ${hue}`}
          />
        ))}
      </div>
    </div>
  );
}
