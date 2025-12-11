import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ReaderSettings, ThemeMode, Highlight } from '../types';

interface ReaderProps {
  content: string;
  settings: ReaderSettings;
  onUpdateSettings: (s: ReaderSettings) => void;
  annotations: Record<number, string>;
  onUpdateAnnotation: (index: number, text: string) => void;
  highlights: Record<number, Highlight[]>;
  onAddHighlight: (index: number, start: number, end: number, text: string) => void;
  onRemoveHighlight: (index: number, id: string) => void;
}

// Polyfill for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const Reader: React.FC<ReaderProps> = ({ 
  content, 
  settings, 
  onUpdateSettings,
  annotations,
  onUpdateAnnotation,
  highlights,
  onAddHighlight,
  onRemoveHighlight
}) => {
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [hoveredParagraphIndex, setHoveredParagraphIndex] = useState<number | null>(null);
  const [isMarkerMode, setIsMarkerMode] = useState(false);
  
  // Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // TTS State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Voice Control State
  const [isVoiceControlActive, setIsVoiceControlActive] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState<string>('');
  const recognitionRef = useRef<any>(null);
  
  // Ref to track active state for the closure inside onend
  const isVoiceControlActiveRef = useRef(isVoiceControlActive);

  // Refs to handle TTS continuity logic without closure staleness
  const isContinuousRef = useRef(false);
  const isAutoAdvancingRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  // Sync isVoiceControlActive state to Ref
  useEffect(() => {
    isVoiceControlActiveRef.current = isVoiceControlActive;
  }, [isVoiceControlActive]);

  // Parse content into paragraphs
  useEffect(() => {
    const splitText = content.split('\n').filter(line => line.trim().length > 0);
    setParagraphs(splitText);
    setActiveParagraphIndex(null); 
    handleStop(); // Reset speech on content load
  }, [content]);

  // Load Voices
  useEffect(() => {
    const loadVoices = () => {
        const available = window.speechSynthesis.getVoices();
        setVoices(available);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // --- TTS Logic ---

  const speakText = (index: number) => {
    if (index < 0 || index >= paragraphs.length) return;

    window.speechSynthesis.cancel();
    
    const text = paragraphs[index];
    const utterance = new SpeechSynthesisUtterance(text);
    
    const selectedVoice = voices.find(v => v.voiceURI === settings.speechVoiceURI);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
        // If continuous mode is on and we are not at the end
        if (isContinuousRef.current && index < paragraphs.length - 1) {
            isAutoAdvancingRef.current = true;
            setActiveParagraphIndex(index + 1);
            // The useEffect on activeParagraphIndex will trigger the next speech
        } else {
            // Finished or stopped naturally
            setIsSpeaking(false);
            isContinuousRef.current = false;
        }
    };

    utterance.onerror = () => {
        setIsSpeaking(false);
        isContinuousRef.current = false;
    };
    
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSpeakCurrent = () => {
    if (activeParagraphIndex === null) return;
    isContinuousRef.current = false; // Single paragraph mode
    speakText(activeParagraphIndex);
  };

  const handleSpeakAll = () => {
    if (activeParagraphIndex === null) {
        // Start from beginning if nothing selected
        setActiveParagraphIndex(0);
        isContinuousRef.current = true;
        isAutoAdvancingRef.current = true; // Trigger logic in useEffect
    } else {
        isContinuousRef.current = true;
        speakText(activeParagraphIndex);
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    isContinuousRef.current = false;
    isAutoAdvancingRef.current = false;
  };

  // Watch for active paragraph changes
  useEffect(() => {
    if (activeParagraphIndex === null) return;

    if (isAutoAdvancingRef.current) {
        // Case 1: Change was triggered by the auto-reader
        isAutoAdvancingRef.current = false; // Reset flag
        
        // Scroll to new paragraph
        paragraphRefs.current[activeParagraphIndex]?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        // Continue speaking
        speakText(activeParagraphIndex);
    } else {
        // Case 2: Change was manual (user clicked or used arrows)
        // If speaking, we should stop (unless we want to immediately read the clicked one, 
        // but standard behavior usually stops previous audio on nav)
        if (isSpeaking) {
            handleStop();
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeParagraphIndex]);


  // --- Voice Control Logic ---
  
  // We use a ref to hold the command processor so the SpeechRecognition callback 
  // can always call the latest version of the function (avoiding stale closures).
  const processCommandRef = useRef<(cmd: string) => void>(() => {});

  const processCommand = useCallback((command: string) => {
      setLastVoiceCommand(command);
      
      // Navigation
      if (command.includes('next')) {
          setActiveParagraphIndex(prev => {
              const current = prev === null ? -1 : prev;
              const next = Math.min(paragraphs.length - 1, current + 1);
              if (next !== prev) {
                  // Manually scroll if we change index (the effect usually handles it but explicit here ensures feedback)
                  paragraphRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              return next;
          });
      }
      else if (command.includes('previous') || command.includes('back')) {
          setActiveParagraphIndex(prev => {
              const current = prev === null ? 0 : prev;
              const next = Math.max(0, current - 1);
              if (next !== prev) {
                  paragraphRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              return next;
          });
      }
      // Reading
      else if (command.includes('read all') || command.includes('start reading')) {
          handleSpeakAll();
      }
      else if (command.includes('stop') || command.includes('pause')) {
          handleStop();
      }
      // Modes
      else if (command.includes('magnifier on')) {
          onUpdateSettings({ ...settings, isLoupeActive: true });
      }
      else if (command.includes('magnifier off')) {
          onUpdateSettings({ ...settings, isLoupeActive: false });
      }
      else if (command.includes('focus mode on') || command.includes('focus on')) {
          onUpdateSettings({ ...settings, isFocusMode: true });
      }
      else if (command.includes('focus mode off') || command.includes('focus off')) {
          onUpdateSettings({ ...settings, isFocusMode: false });
      }
      else if (command.includes('bionic on') || command.includes('bionic reading on')) {
          onUpdateSettings({ ...settings, isBionicReading: true });
      }
      else if (command.includes('bionic off') || command.includes('bionic reading off')) {
          onUpdateSettings({ ...settings, isBionicReading: false });
      }
  }, [paragraphs, settings, onUpdateSettings, handleSpeakAll, handleStop]);

  // Update the ref whenever the processor changes
  useEffect(() => {
      processCommandRef.current = processCommand;
  }, [processCommand]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
        const results = event.results;
        const lastResult = results[results.length - 1];
        if (lastResult.isFinal) {
            const transcript = lastResult[0].transcript.trim().toLowerCase();
            console.log('Voice Command Received:', transcript);
            // Call the ref to get fresh state
            processCommandRef.current(transcript);
        }
    };

    recognition.onend = () => {
        // If it stops but state is still active (via ref), restart it (keep alive)
        if (isVoiceControlActiveRef.current) {
            try { recognition.start(); } catch (e) { /* ignore already started errors */ }
        }
    };

    recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
            setIsVoiceControlActive(false);
            alert("Microphone access blocked. Please allow permissions.");
        }
    };

    recognitionRef.current = recognition;
    
    return () => {
        if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []); // Run once on mount

  // Handle Toggle Effect
  useEffect(() => {
      const recognition = recognitionRef.current;
      if (!recognition) return;

      if (isVoiceControlActive) {
          try { 
              recognition.start(); 
              setLastVoiceCommand('');
          } catch (e) { console.log('Recognition already started'); }
      } else {
          try { recognition.stop(); } catch (e) { /* ignore */ }
      }
  }, [isVoiceControlActive]);


  // Handle Dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT';
      
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        const scrollContainer = containerRef.current;
        if(scrollContainer) {
             scrollContainer.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });
        }
      }
      
      if (isInput) return;

      if (e.key === 'ArrowDown' || e.key === 'n') {
         if (paragraphs.length > 0) {
           setActiveParagraphIndex(prev => {
             const next = (prev === null) ? 0 : Math.min(paragraphs.length - 1, prev + 1);
             paragraphRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
             return next;
           });
         }
      }

      if (e.key === 'ArrowUp' || e.key === 'p') {
        if (paragraphs.length > 0) {
           setActiveParagraphIndex(prev => {
             const next = (prev === null) ? 0 : Math.max(0, prev - 1);
             paragraphRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
             return next;
           });
         }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paragraphs]);

  // --- Styling Logic ---

  const containerStyle = {
    fontFamily: settings.fontFamily === 'mono' ? 'monospace' : settings.fontFamily === 'serif' ? 'serif' : 'sans-serif',
    lineHeight: settings.lineHeight,
    letterSpacing: `${settings.letterSpacing}em`,
  };

  const getParagraphStyle = (index: number) => {
    const isActive = activeParagraphIndex === index;
    const isFocusMode = settings.isFocusMode;
    
    let opacity = 1;
    if (isFocusMode && activeParagraphIndex !== null && !isActive) {
      opacity = 0.2;
    }

    return {
      opacity,
      fontSize: `${settings.fontSize}px`,
      cursor: isMarkerMode ? 'text' : 'pointer'
    };
  };

  const getZoomOverlayClass = () => {
    // Styles for the popped-out zoomed paragraph
    switch(settings.theme) {
      case ThemeMode.HIGH_CONTRAST: 
        return 'bg-black border-2 border-yellow-400 text-yellow-400 shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)] shadow-yellow-900/50'; 
      case ThemeMode.DARK: 
        return 'bg-gray-800 text-gray-100 border border-gray-600 shadow-2xl shadow-black/80';
      case ThemeMode.SEPIA: 
        return 'bg-[#eaddc5] text-[#3e3025] border border-[#d8cba8] shadow-xl shadow-[#3e3025]/20';
      case ThemeMode.INK: 
        return 'bg-white text-black border-2 border-black shadow-2xl';
      default: 
        // Light mode: Slight tint to distinguish from background
        return 'bg-white text-gray-900 border border-blue-200 shadow-2xl shadow-blue-900/20 ring-1 ring-blue-100';
    }
  };

  const getActiveBorderClass = (index: number) => {
    if (activeParagraphIndex !== index) return 'border-transparent border-l-4';
    
    if (settings.theme === ThemeMode.HIGH_CONTRAST) {
      return 'border-l-4 border-yellow-400 bg-yellow-900/20';
    }
    if (settings.theme === ThemeMode.INK) {
       return 'border-l-4 border-black bg-gray-100';
    }
    return 'border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-900/20';
  };

  // --- Text Interaction ---

  const handleParagraphClick = (index: number) => {
    setActiveParagraphIndex(index);
  };

  const handleSelection = (index: number) => {
    if (!isMarkerMode) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    
    const paragraphNode = paragraphRefs.current[index];
    if (!paragraphNode) return;

    if (paragraphNode.contains(range.commonAncestorContainer)) {
         preSelectionRange.selectNodeContents(paragraphNode);
         preSelectionRange.setEnd(range.startContainer, range.startOffset);
         const start = preSelectionRange.toString().length;
         const text = selection.toString();
         onAddHighlight(index, start, start + text.length, text);
    }
    
    selection.removeAllRanges();
  };

  // --- Rendering Text with Highlights and Bionic Reading ---

  const applyBionicReading = (text: string) => {
    if (!settings.isBionicReading) return text;
    
    // Split by spaces to preserve words
    return text.split(/(\s+)/).map((part, i) => {
      // If it's whitespace, return as is
      if (/^\s+$/.test(part)) return part;
      
      const length = part.length;
      let boldLength = 0;
      
      // Heuristic for fixation point
      if (length === 1) boldLength = 1;
      else if (length <= 3) boldLength = 1;
      else if (length <= 5) boldLength = 2;
      else boldLength = Math.ceil(length * 0.4);

      const prefix = part.slice(0, boldLength);
      const suffix = part.slice(boldLength);

      return (
        <React.Fragment key={i}>
          <b className="font-extrabold">{prefix}</b>
          <span className="opacity-60">{suffix}</span>
        </React.Fragment>
      );
    });
  };

  const renderParagraphContent = (text: string, index: number) => {
    const paragraphHighlights = highlights[index];
    // If no highlights, apply bionic reading to the whole text
    if (!paragraphHighlights || paragraphHighlights.length === 0) {
      return settings.isBionicReading ? applyBionicReading(text) : text;
    }

    const sorted = [...paragraphHighlights].sort((a, b) => a.start - b.start);
    const nodes = [];
    let lastIndex = 0;

    sorted.forEach((h, i) => {
      if (h.start < lastIndex) return; 

      // Text before highlight
      if (h.start > lastIndex) {
        const preText = text.slice(lastIndex, h.start);
        nodes.push(
            <span key={`text-${i}`}>
                {settings.isBionicReading ? applyBionicReading(preText) : preText}
            </span>
        );
      }

      let highlightClass = 'bg-yellow-200 dark:bg-yellow-700/50';
      if (settings.theme === ThemeMode.HIGH_CONTRAST) highlightClass = 'bg-yellow-600 text-black';
      if (settings.theme === ThemeMode.INK) highlightClass = 'bg-gray-300 border-b-2 border-black';

      // Highlighted text
      const highlightedText = text.slice(h.start, h.end);
      nodes.push(
        <mark key={h.id} className={`${highlightClass} px-0.5 rounded-sm`}>
          {settings.isBionicReading ? applyBionicReading(highlightedText) : highlightedText}
        </mark>
      );
      
      lastIndex = h.end;
    });

    // Text after last highlight
    if (lastIndex < text.length) {
      const postText = text.slice(lastIndex);
      nodes.push(
        <span key="text-end">
            {settings.isBionicReading ? applyBionicReading(postText) : postText}
        </span>
      );
    }

    return nodes;
  };

  // --- Side Panel Styles ---
  
  const getSidePanelClass = () => {
    switch(settings.theme) {
      case ThemeMode.HIGH_CONTRAST: return 'bg-black border-l border-yellow-400 text-yellow-400';
      case ThemeMode.DARK: return 'bg-gray-900 border-l border-gray-700 text-gray-200';
      case ThemeMode.SEPIA: return 'bg-[#f4ecd8] border-l border-[#d8cba8] text-[#5b4636]';
      case ThemeMode.INK: return 'bg-white border-l border-gray-300 text-black';
      default: return 'bg-gray-50 border-l border-gray-200 text-gray-800';
    }
  };

  const getTextAreaClass = () => {
    switch(settings.theme) {
      case ThemeMode.HIGH_CONTRAST: return 'bg-gray-900 text-yellow-400 border-yellow-400 placeholder-yellow-700';
      case ThemeMode.DARK: return 'bg-gray-800 text-white border-gray-600 placeholder-gray-400';
      case ThemeMode.INK: return 'bg-white text-black border-black placeholder-gray-500 ring-1 ring-transparent focus:ring-black';
      case ThemeMode.SEPIA: return 'bg-[#fffdf5] text-[#463529] border-[#d8cba8] placeholder-[#9c8672]';
      default: return 'bg-white text-gray-900 border-gray-300 placeholder-gray-400';
    }
  };

  const getHighlightCardClass = () => {
    switch(settings.theme) {
      case ThemeMode.HIGH_CONTRAST: return 'bg-yellow-900 border-yellow-400 text-yellow-100';
      case ThemeMode.DARK: return 'bg-gray-800 border-gray-600 text-gray-100';
      case ThemeMode.SEPIA: return 'bg-[#eaddc5] border-[#d8cba8] text-[#3e3025]';
      case ThemeMode.INK: return 'bg-white border-black text-black shadow-none ring-1 ring-black';
      default: return 'bg-yellow-50 border-yellow-200 text-gray-900 shadow-sm';
    }
  };

  const getSecondaryButtonClass = (isActive: boolean) => {
    const base = "w-full py-3 px-4 rounded-lg font-medium flex items-center justify-between gap-3 transition-all border opacity-90 hover:opacity-100 mb-2";
    
    if (isActive) {
      if (settings.theme === ThemeMode.HIGH_CONTRAST) return `${base} bg-yellow-900/50 text-yellow-400 border-yellow-400`;
      if (settings.theme === ThemeMode.INK) return `${base} bg-gray-200 text-black border-black`;
      return `${base} bg-blue-50 text-blue-700 border-blue-200`;
    }
    
    return `${base} bg-transparent border-current opacity-60 hover:opacity-100`;
  };

  const getProminentButtonClass = (isActive: boolean) => {
    const base = "w-full py-5 px-5 rounded-xl font-bold flex items-center justify-between gap-4 transition-all border-2 mb-6 shadow-md group relative overflow-hidden transform hover:scale-[1.02]";
    
    if (isActive) {
      if (settings.theme === ThemeMode.HIGH_CONTRAST) return `${base} bg-yellow-400 text-black border-yellow-400 ring-2 ring-yellow-400 ring-offset-2 ring-offset-black`;
      if (settings.theme === ThemeMode.INK) return `${base} bg-black text-white border-black ring-2 ring-black ring-offset-2`;
      if (settings.theme === ThemeMode.SEPIA) return `${base} bg-[#5b4636] text-[#f4ecd8] border-[#5b4636] ring-2 ring-[#5b4636] ring-offset-2 ring-offset-[#f4ecd8]`;
      return `${base} bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500 ring-offset-2`;
    }
    
    // Inactive but prominent
    if (settings.theme === ThemeMode.HIGH_CONTRAST) return `${base} bg-transparent text-yellow-400 border-yellow-400 hover:bg-yellow-900/30`;
    if (settings.theme === ThemeMode.INK) return `${base} bg-white text-black border-black hover:bg-gray-100`;
    if (settings.theme === ThemeMode.SEPIA) return `${base} bg-[#f4ecd8] text-[#5b4636] border-[#5b4636] hover:bg-[#eaddc5]`;
    return `${base} bg-white text-blue-600 border-blue-600 hover:bg-blue-50`;
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT: Text Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-12 pb-32 lg:px-16 scroll-smooth focus:outline-none"
        style={containerStyle}
        tabIndex={0}
      >
        {paragraphs.map((text, index) => {
          const hasAnnotation = !!annotations[index];
          const hasHighlights = highlights[index] && highlights[index].length > 0;
          const isZoomed = settings.isHoverZoom && hoveredParagraphIndex === index;
          
          return (
            <div 
              key={index} 
              className={`relative mb-8 transition-all duration-300 ${getActiveBorderClass(index)} pl-4 rounded-r-lg group`}
              onMouseEnter={() => setHoveredParagraphIndex(index)}
              onMouseLeave={() => setHoveredParagraphIndex(null)}
            >
              {/* ORIGINAL PARAGRAPH (Placeholder when zoomed) */}
              <p
                ref={el => { paragraphRefs.current[index] = el; }}
                className={`transition-opacity duration-200`}
                style={{
                    ...getParagraphStyle(index),
                    opacity: isZoomed ? 0 : getParagraphStyle(index).opacity
                }}
                onMouseUp={() => handleSelection(index)}
                onClick={() => handleParagraphClick(index)}
              >
                {renderParagraphContent(text, index)}
              </p>

              {/* ZOOM POP-OUT OVERLAY */}
              {isZoomed && (
                <div 
                    className={`
                        absolute -top-4 -left-2 w-[calc(100%+2rem)] p-6 rounded-lg z-50
                        ${getZoomOverlayClass()}
                    `}
                    onMouseUp={() => handleSelection(index)}
                    onClick={() => handleParagraphClick(index)}
                >
                    <p style={{
                         ...getParagraphStyle(index),
                         fontSize: `${settings.fontSize * 1.35}px`,
                         opacity: 1,
                         lineHeight: settings.lineHeight,
                         whiteSpace: 'normal', 
                         overflowWrap: 'break-word'
                    }}>
                        {renderParagraphContent(text, index)}
                    </p>
                </div>
              )}

              {/* Indicators */}
              <div className="absolute top-0 -right-4 flex flex-col gap-1">
                 {hasAnnotation && (
                  <span className="text-3xl" title="Has annotation">📝</span>
                )}
                 {hasHighlights && (
                  <span className="text-xl opacity-70" title="Has highlights">🖍</span>
                )}
              </div>
            </div>
          );
        })}
        {paragraphs.length === 0 && (
          <div className="text-center opacity-50 mt-20">No content. Use toolbar to open file.</div>
        )}
      </div>

      {/* Resize Handle */}
      {isSidebarOpen && (
        <div 
          className="w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-30"
          onMouseDown={() => setIsDragging(true)}
        />
      )}

      {/* Toggle Button */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className={`
             absolute right-0 top-20 z-40 p-3 rounded-l-lg shadow-lg border-y border-l transition-colors
             ${settings.theme === ThemeMode.HIGH_CONTRAST ? 'bg-black border-yellow-400 text-yellow-400' : 'bg-white border-gray-300 text-gray-600 hover:text-blue-600'}
          `}
          title="Open Sidebar"
        >
          ◀
        </button>
      )}

      {/* RIGHT: Annotation & Tools Panel */}
      {isSidebarOpen && (
      <div 
        style={{ width: sidebarWidth }} 
        className={`flex flex-col p-6 shadow-xl z-20 overflow-y-auto pb-32 flex-shrink-0 relative ${getSidePanelClass()}`}
      >
        <button
           onClick={() => setIsSidebarOpen(false)}
           className="absolute top-4 left-2 p-1 opacity-50 hover:opacity-100"
           title="Collapse Sidebar"
        >
          ▶
        </button>

        {/* Tool Header */}
        <div className="mb-6 border-b border-current border-opacity-20 pb-4 pl-6">
           <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
             <span>Reader Tools</span>
           </h2>
           
           {/* Primary Actions */}
           <div className="flex flex-col">
             
             {/* MAGNIFIER - PROMINENT */}
             <button 
               onClick={() => onUpdateSettings({...settings, isLoupeActive: !settings.isLoupeActive})}
               className={getProminentButtonClass(settings.isLoupeActive)}
             >
               <div className="flex items-center gap-4">
                 <span className="text-3xl">🔍</span>
                 <div className="flex flex-col items-start text-left">
                   <span className="leading-tight text-lg">Magnifier</span>
                   <span className="text-xs opacity-80 font-normal">Large text follows cursor</span>
                 </div>
               </div>
               
               {/* Badge/State Indicator */}
               <div className="flex flex-col items-end gap-1">
                 <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full ${settings.isLoupeActive ? 'bg-white/20' : 'bg-current/10'}`}>
                    FEATURED
                 </span>
                 <div className={`w-3 h-3 rounded-full ${settings.isLoupeActive ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'border-2 border-current opacity-30'}`}></div>
               </div>
             </button>

             {/* MARKER - SECONDARY */}
             <button 
               onClick={() => setIsMarkerMode(!isMarkerMode)}
               className={getSecondaryButtonClass(isMarkerMode)}
             >
               <div className="flex items-center gap-3">
                 <span className="text-xl">🖍</span>
                 <span className="font-bold">Marker Mode</span>
               </div>
               <span className="text-xs uppercase font-bold tracking-wider opacity-70">
                 {isMarkerMode ? "ON" : "OFF"}
               </span>
             </button>

             {/* VOICE CONTROL - NEW */}
             <div className="mt-4 pt-4 border-t border-current border-opacity-10">
               <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-80 flex items-center justify-between">
                   <span>Voice Control</span>
                   {isVoiceControlActive && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">LISTENING</span>}
               </h3>
               
               <button 
                   onClick={() => setIsVoiceControlActive(!isVoiceControlActive)}
                   className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-between gap-3 transition-all border
                      ${isVoiceControlActive 
                          ? 'bg-red-500 text-white border-red-500 hover:bg-red-600' 
                          : 'bg-transparent border-current opacity-60 hover:opacity-100'
                      }
                   `}
               >
                   <div className="flex items-center gap-3">
                       <span className="text-xl">{isVoiceControlActive ? '🎙' : '🔇'}</span>
                       <span className="font-bold">{isVoiceControlActive ? 'Microphone On' : 'Microphone Off'}</span>
                   </div>
               </button>
               
               {isVoiceControlActive && (
                  <div className="mt-2 p-2 rounded bg-black/5 text-xs font-mono opacity-70 text-center min-h-[1.5em]">
                      {lastVoiceCommand ? `"${lastVoiceCommand}"` : "Say 'Next', 'Read All', etc..."}
                  </div>
               )}
             </div>

             {/* TTS / READING MODE */}
             <div className="mt-4 pt-4 border-t border-current border-opacity-10">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-80 flex items-center gap-2">
                    <span>Read Aloud</span>
                    {isSpeaking && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>}
                </h3>
                
                {/* Voice Selection */}
                <div className="mb-3">
                    <select 
                        value={settings.speechVoiceURI}
                        onChange={(e) => onUpdateSettings({...settings, speechVoiceURI: e.target.value})}
                        className={`w-full p-2 rounded border text-sm appearance-none cursor-pointer ${getTextAreaClass()}`}
                        aria-label="Select Voice"
                    >
                        <option value="">Default Voice</option>
                        {voices.map(v => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                                {v.name} ({v.lang})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-2">
                    {!isSpeaking ? (
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSpeakCurrent}
                                disabled={activeParagraphIndex === null}
                                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border font-bold transition-all text-sm
                                    ${activeParagraphIndex === null ? 'opacity-50 cursor-not-allowed border-current bg-transparent' : 'bg-transparent border-current opacity-80 hover:opacity-100 hover:bg-current hover:bg-opacity-5'}
                                `}
                                title="Read only the current paragraph"
                            >
                                <span>▶</span> Paragraph
                            </button>
                            <button 
                                onClick={handleSpeakAll}
                                className={`flex-[1.5] flex items-center justify-center gap-2 p-3 rounded-lg border font-bold transition-all
                                    ${settings.theme === ThemeMode.HIGH_CONTRAST ? 'bg-yellow-400 text-black border-yellow-400 hover:bg-yellow-500' : ''}
                                    ${settings.theme === ThemeMode.INK ? 'bg-black text-white border-black hover:bg-gray-800' : ''}
                                    ${settings.theme === ThemeMode.SEPIA ? 'bg-[#5b4636] text-[#f4ecd8] border-[#5b4636] hover:bg-[#3e3025]' : ''}
                                    ${(settings.theme === ThemeMode.LIGHT || settings.theme === ThemeMode.DARK) ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : ''}
                                `}
                                title="Read continuously from current position"
                            >
                                <span>▶▶</span> Read All
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={handleStop}
                            className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg border font-bold transition-all border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
                        >
                            <span>⏹</span> Stop Reading
                        </button>
                    )}
                </div>
                {activeParagraphIndex === null && !isSpeaking && (
                    <p className="text-xs opacity-60 mt-2 text-center">Select a paragraph to start.</p>
                )}
             </div>

           </div>
        </div>

        {/* Context Information */}
        {activeParagraphIndex !== null ? (
           <div className="flex-1 flex flex-col">
             <div className="mb-4 opacity-70 text-sm font-mono border-b border-current border-opacity-10 pb-2">
               Paragraph #{activeParagraphIndex + 1}
             </div>
             
             {/* Annotation Input */}
             <label className="block text-sm font-bold uppercase tracking-wider mb-2">
               Notes
             </label>
             <textarea
               className={`w-full p-4 rounded-lg border text-base focus:outline-none focus:ring-2 transition-colors shadow-inner ${getTextAreaClass()}`}
               rows={8}
               placeholder="Type your notes for this paragraph here..."
               value={annotations[activeParagraphIndex] || ''}
               onChange={(e) => onUpdateAnnotation(activeParagraphIndex, e.target.value)}
             />

             {/* Highlights List */}
             {highlights[activeParagraphIndex] && highlights[activeParagraphIndex].length > 0 && (
               <div className="mt-8">
                 <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-80 flex items-center gap-2">
                   <span>Highlights</span>
                   <span className="text-xs bg-current bg-opacity-20 px-2 rounded-full">{highlights[activeParagraphIndex].length}</span>
                 </h3>
                 <div className="space-y-3">
                   {highlights[activeParagraphIndex].map(h => (
                     <div key={h.id} className={`p-3 rounded-md border flex gap-3 items-start relative group ${getHighlightCardClass()}`}>
                       <span className="text-xl leading-none opacity-50 mt-1">❝</span>
                       <span className="flex-1 text-sm italic leading-relaxed">{h.text}</span>
                       <button 
                         onClick={() => onRemoveHighlight(activeParagraphIndex, h.id)}
                         className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1 font-bold absolute top-1 right-1"
                         title="Remove highlight"
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                       </button>
                     </div>
                   ))}
                 </div>
               </div>
             )}

           </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-50 text-center mt-4">
            <span className="text-4xl mb-4">👈</span>
            <p className="max-w-[200px]">Click a paragraph on the left to add notes.</p>
            
            {/* Summary of notes */}
            {Object.keys(annotations).length > 0 && (
               <div className="mt-12 w-full text-left">
                 <h3 className="border-b border-current pb-2 mb-4 font-bold">All Notes</h3>
                 <ul className="space-y-3 text-sm">
                   {Object.keys(annotations).map(key => (
                     <li key={key} className="truncate cursor-pointer hover:underline group" onClick={() => setActiveParagraphIndex(Number(key))}>
                       <span className="font-mono opacity-50 mr-2">#{Number(key)+1}</span>
                       <span className="group-hover:text-blue-500 transition-colors">{annotations[Number(key)]}</span>
                     </li>
                   ))}
                 </ul>
               </div>
            )}
          </div>
        )}

      </div>
      )}
    </div>
  );
};

export default Reader;