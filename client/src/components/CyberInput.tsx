import { InputHTMLAttributes, forwardRef } from "react";

export const CyberInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <div className="relative w-full">
        <input
          ref={ref}
          className={`
            w-full bg-background/80 border-2 border-primary/50 text-primary 
            font-display text-xl py-3 px-4 outline-none
            placeholder:text-primary/30 transition-all duration-300
            focus:border-primary focus:shadow-[0_0_15px_hsla(var(--primary)/0.5)]
            focus:bg-primary/5
            ${className}
          `}
          {...props}
        />
        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary pointer-events-none" />
      </div>
    );
  }
);

CyberInput.displayName = "CyberInput";
