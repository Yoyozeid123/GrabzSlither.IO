import { ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent";
  size?: "sm" | "md" | "lg";
}

export function NeonButton({ 
  children, 
  variant = "primary", 
  size = "md", 
  className = "", 
  ...props 
}: NeonButtonProps) {
  
  const baseClasses = "relative font-display font-bold uppercase tracking-widest overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group";
  
  const variants = {
    primary: "bg-transparent text-primary neon-box hover:bg-primary hover:text-black hover:shadow-[0_0_20px_hsl(var(--primary))]",
    secondary: "bg-transparent text-secondary border border-secondary shadow-[0_0_10px_hsla(var(--secondary)/0.3)] hover:bg-secondary hover:text-black hover:shadow-[0_0_20px_hsl(var(--secondary))]",
    accent: "bg-transparent text-accent neon-box-pink hover:bg-accent hover:text-white hover:shadow-[0_0_20px_hsl(var(--accent))]",
  };
  
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-8 py-3 text-lg",
    lg: "px-12 py-4 text-2xl",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
      {/* Glitch overlay on hover */}
      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0 mix-blend-overlay" />
    </motion.button>
  );
}
