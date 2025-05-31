'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ConeaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  collapsed?: boolean;
}

export const ConeaLogo: React.FC<ConeaLogoProps> = ({ 
  size = 'md', 
  className = '',
  showText = true,
  collapsed = false
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.div
        className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-[#34D399] to-[#10B981] flex items-center justify-center`}
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        <span className="text-white font-bold text-sm">C</span>
      </motion.div>
      
      {showText && !collapsed && (
        <motion.span 
          className={`font-bold bg-gradient-to-r from-[#34D399] to-[#10B981] bg-clip-text text-transparent ${textSizeClasses[size]}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          Conea
        </motion.span>
      )}
    </div>
  );
};