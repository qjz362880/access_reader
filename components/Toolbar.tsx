import React, { useState } from 'react';
import { ReaderSettings, ThemeMode, FontFamily } from '../types';

interface ToolbarProps {
  settings: ReaderSettings;
  onUpdateSettings: (s: ReaderSettings) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ settings, onUpdateSettings, onFileUpload }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  const update = (key: keyof ReaderSettings, value: any) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  // Match styles exactly with Reader.tsx sidebar logic for consistency
  const getThemeStyles = () => {
    switch (settings.theme) {
      case ThemeMode.HIGH_CONTRAST:
        return 'bg-black border-t border-yellow-400 text-yellow-400';
      case ThemeMode.DARK:
        return 'bg-gray-900 border-t border-gray-700 text-gray-200';
      case ThemeMode.SEPIA:
        return 'bg-[#f4ecd8] border-t border-[#d8cba8] text-[#5b4636]';
      case ThemeMode.INK:
        return 'bg-white border-t border-gray-300 text-black';
      case ThemeMode.LIGHT:
      default:
        return 'bg-gray-50 border-t border-gray-200 text-gray-800';
    }
  };

  const themeClasses = getThemeStyles();
  const buttonBorderClass = settings.theme === ThemeMode.LIGHT || settings.theme === ThemeMode.INK ? 'border-gray-300' : 'border-current';

  // Specific styling for the "Open File" button based on theme
  const getFileButtonClass = () => {
    if (settings.theme === ThemeMode.HIGH_CONTRAST) {
      return 'bg-yellow-400 text-black hover:bg-yellow-300 border border-transparent';
    }
    if (settings.theme === ThemeMode.INK) {
      return 'bg-black text-white hover:bg-gray-800 ring-1 ring-black';
    }
    if (settings.theme === ThemeMode.SEPIA) {
        return 'bg-[#5b4636] text-[#f4ecd8] hover:bg-[#3e3025]';
    }
    return 'bg-blue-600 text-white hover:bg-blue-700';
  };

  // Specific accent color for checkboxes
  const getCheckboxClass = () => {
    if (settings.theme === ThemeMode.INK) {
      return 'text-black accent-black border-gray-500';
    }
    if (settings.theme === ThemeMode.HIGH_CONTRAST) {
      return 'text-yellow-400 accent-yellow-400 border-yellow-400';
    }
    if (settings.theme === ThemeMode.SEPIA) {
        return 'text-[#5b4636] accent-[#5b4636]';
    }
    return 'text-blue-600 accent-blue-600';
  };

  return (
    <div className={`
      fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out
      ${isVisible ? 'translate-y-0' : 'translate-y-[calc(100%-1px)]'}
    `}>
      {/* Toggle Handle */}
      <div className="absolute -top-8 right-4 flex justify-end">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className={`
            h-8 px-4 rounded-t-lg text-xs font-bold uppercase tracking-wider border-t border-x
            flex items-center gap-2 shadow-sm
            ${themeClasses}
            ${buttonBorderClass}
          `}
          aria-label={isVisible ? "Hide Toolbar" : "Show Toolbar"}
        >
          {isVisible ? (
            <>
              <span>Hide</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </>
          ) : (
            <>
              <span>Controls</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            </>
          )}
        </button>
      </div>

      {/* Main Toolbar */}
      <div className={`
        p-4 flex flex-col gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]
        ${themeClasses}
      `}>
        <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-4">
          
          {/* File Upload */}
          <div className="flex items-center gap-2">
             <label className={`
               px-4 py-2 rounded font-medium cursor-pointer transition-colors shadow-sm
               ${getFileButtonClass()}
             `}>
               Open File
               <input type="file" accept=".txt,.pdf,.docx" onChange={onFileUpload} className="hidden" />
             </label>
             <span className="text-xs opacity-70 hidden sm:inline-block">Supports .txt, .pdf, .docx</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
              {/* Font Controls - Updated Visuals */}
              <div className="flex items-center gap-3 rounded-lg px-3 py-1.5 border-2 border-current border-opacity-40 hover:border-opacity-100 transition-colors">
                 <button 
                   onClick={() => update('fontSize', Math.max(12, settings.fontSize - 2))}
                   className="w-8 h-8 flex items-center justify-center rounded hover:bg-current hover:bg-opacity-20 font-bold active:scale-95 transition-transform"
                   aria-label="Decrease Font Size"
                 >
                   A-
                 </button>
                 <span className="min-w-[3ch] text-center font-mono font-bold text-lg">{settings.fontSize}</span>
                 <button 
                   onClick={() => update('fontSize', Math.min(64, settings.fontSize + 2))}
                   className="w-8 h-8 flex items-center justify-center rounded hover:bg-current hover:bg-opacity-20 font-bold active:scale-95 transition-transform"
                   aria-label="Increase Font Size"
                 >
                   A+
                 </button>
              </div>

              {/* Theme Toggle - Updated with visible borders */}
              <div className="flex items-center gap-3 border-l-2 border-current border-opacity-10 pl-6">
                {(Object.values(ThemeMode) as ThemeMode[]).map((mode) => (
                   <button
                     key={mode}
                     onClick={() => update('theme', mode)}
                     className={`
                       w-8 h-8 rounded-full transition-all border-2
                       ${settings.theme === mode 
                          ? 'scale-110 border-current ring-2 ring-offset-2 ring-offset-transparent ring-current/50' 
                          : 'border-current border-opacity-30 hover:border-opacity-80 hover:scale-105'
                       }
                       ${mode === ThemeMode.LIGHT ? 'bg-white' : ''}
                       ${mode === ThemeMode.DARK ? 'bg-gray-900' : ''}
                       ${mode === ThemeMode.SEPIA ? 'bg-[#f4ecd8]' : ''}
                       ${mode === ThemeMode.HIGH_CONTRAST ? 'bg-black' : ''}
                       ${mode === ThemeMode.INK ? 'bg-[#f7f7f7]' : ''}
                     `}
                     title={`Theme: ${mode}`}
                   />
                ))}
              </div>

              {/* Font Family */}
              <select 
                value={settings.fontFamily}
                onChange={(e) => update('fontFamily', e.target.value)}
                className={`
                  p-2 pr-8 rounded border-2 bg-transparent font-medium cursor-pointer appearance-none hover:bg-current hover:bg-opacity-5
                  ${settings.theme === ThemeMode.HIGH_CONTRAST ? 'border-yellow-400 text-yellow-400' : 'border-gray-300'}
                  ${settings.theme === ThemeMode.DARK ? 'border-gray-600' : ''}
                  ${settings.theme === ThemeMode.INK ? 'border-black text-black' : ''}
                `}
                style={{ 
                    backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.7rem top 50%',
                    backgroundSize: '0.65rem auto',
                }}
              >
                <option value={FontFamily.SANS} className="text-black">Sans Serif</option>
                <option value={FontFamily.SERIF} className="text-black">Serif</option>
                <option value={FontFamily.MONO} className="text-black">Monospace</option>
              </select>

              {/* Toggles */}
              <div className="flex items-center gap-6 text-sm font-bold border-l-2 border-current border-opacity-10 pl-4">
                <label className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100">
                  <input 
                    type="checkbox" 
                    checked={settings.isFocusMode} 
                    onChange={(e) => update('isFocusMode', e.target.checked)}
                    className={`w-4 h-4 rounded ${getCheckboxClass()}`}
                  />
                  Focus Mode
                </label>
                <label className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100">
                  <input 
                    type="checkbox" 
                    checked={settings.isHoverZoom} 
                    onChange={(e) => update('isHoverZoom', e.target.checked)}
                    className={`w-4 h-4 rounded ${getCheckboxClass()}`}
                  />
                  Hover Zoom
                </label>
                <label className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100">
                  <input 
                    type="checkbox" 
                    checked={settings.isBionicReading} 
                    onChange={(e) => update('isBionicReading', e.target.checked)}
                    className={`w-4 h-4 rounded ${getCheckboxClass()}`}
                  />
                  Bionic Reading
                </label>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Toolbar;