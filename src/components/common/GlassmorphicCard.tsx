import React from 'react';
import { motion } from 'framer-motion';

interface GlassmorphicCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  onClick?: () => void;
  role?: string;
  'aria-label'?: string;
  tabIndex?: number;
}

export const GlassmorphicCard: React.FC<GlassmorphicCardProps> = ({
  children,
  className = '',
  delay = 0,
  onClick,
  role,
  'aria-label': ariaLabel,
  tabIndex
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      onClick={onClick}
      role={role}
      aria-label={ariaLabel}
      tabIndex={onClick ? tabIndex ?? 0 : tabIndex}
      className={`
        backdrop-blur-lg bg-white/10 
        border border-white/20 
        rounded-xl shadow-xl 
        p-6
        ${onClick ? 'cursor-pointer hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] focus:ring-offset-2 focus:ring-offset-gray-900 transition-all' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};