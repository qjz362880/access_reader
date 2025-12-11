import React, { useEffect, useState } from 'react';
import { ThemeMode } from '../types';

interface LoupeProps {
  activeText: string;
  theme: ThemeMode;
  visible: boolean;
}

const Loupe: React.FC<LoupeProps> = ({ activeText, theme, visible }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Initial size
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!visible || !activeText) return null;

  // Configuration for size and offset
  const LOUPE_SIZE = 256; // 16rem
  const OFFSET = 20;

  // Calculate position logic to stay on screen
  let left = position.x + OFFSET;
  let top = position.y + OFFSET;

  // If going off right edge, flip to left of cursor
  if (left + LOUPE_SIZE > windowSize.width) {
    left = position.x - LOUPE_SIZE - OFFSET;
  }

  // If going off bottom edge, flip to above cursor
  if (top + LOUPE_SIZE > windowSize.height) {
    top = position.y - LOUPE_SIZE - OFFSET;
  }

  // Visual styles for the lens
  const isHighContrast = theme === ThemeMode.HIGH_CONTRAST;
  
  const containerStyle = {
    left: left,
    top: top,
  };

  const lensClass = isHighContrast 
    ? 'bg-black border-4 border-yellow-400 text-yellow-400 shadow-[0_0_0_2px_rgba(0,0,0,1)]' 
    : 'bg-white border-4 border-gray-300 text-gray-900 shadow-2xl';

  return (
    <div
      className={`fixed z-[100] w-64 h-64 rounded-full pointer-events-none flex items-center justify-center overflow-hidden ${lensClass}`}
      style={containerStyle}
    >
      {/* Glass reflection effect */}
      {!isHighContrast && (
        <div className="absolute top-4 left-4 w-16 h-8 bg-white opacity-20 rounded-full blur-sm transform -rotate-45"></div>
      )}
      
      <div className="p-6 text-center break-words w-full">
        <p className="text-4xl font-bold leading-tight">
          {activeText}
        </p>
      </div>
    </div>
  );
};

export default Loupe;