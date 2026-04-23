import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../lib/utils';

interface AnimatedButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}) => {
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    secondary: "bg-amber-400 text-slate-900 hover:bg-amber-500",
    outline: "bg-transparent border border-slate-200 text-slate-600 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100"
  };

  return (
    <motion.button
      whileHover={{ 
        x: 4, 
        transition: { type: "spring", stiffness: 400, damping: 10 } 
      }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex items-center justify-center font-bold uppercase tracking-widest text-[10px] transition-colors rounded-xl px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default AnimatedButton;
