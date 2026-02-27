import { ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CyberButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
}

export function CyberButton({ 
  children, 
  className, 
  variant = "primary", 
  size = "md",
  ...props 
}: CyberButtonProps) {
  
  const variants = {
    primary: "bg-primary/10 border-primary text-primary hover:bg-primary/20 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]",
    secondary: "bg-secondary/10 border-secondary text-secondary hover:bg-secondary/20 hover:shadow-[0_0_20px_hsl(var(--secondary)/0.4)]",
    danger: "bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20 hover:shadow-[0_0_20px_hsl(var(--destructive)/0.4)]",
    ghost: "border-transparent text-foreground hover:text-primary hover:border-primary/50",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-xl font-bold",
    xl: "px-12 py-6 text-2xl font-bold tracking-widest",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative uppercase font-display tracking-wider border-2 rounded-none transition-colors duration-200 overflow-hidden group",
        "before:absolute before:inset-0 before:w-full before:h-full before:-z-10 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:before:animate-[shimmer_1.5s_infinite]",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {/* Corner decorations */}
      <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-current opacity-50" />
      <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-current opacity-50" />
      
      {children}
    </motion.button>
  );
}
