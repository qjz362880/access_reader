import React, { useState, useEffect } from 'react';
import Reader from './components/Reader';
import Toolbar from './components/Toolbar';
import Loupe from './components/Loupe';
import { DEFAULT_SETTINGS, ReaderSettings, Highlight } from './types';
import { SAMPLE_TEXT, THEME_STYLES } from './constants';

// Declare globals for the CDN libraries
declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
  }
}

const App: React.FC = () => {
  const [content, setContent] = useState<string>(SAMPLE_TEXT);
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    const saved = localStorage.getItem('access-reader-settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  const [hoveredText, setHoveredText] = useState<string>('');
  
  // Map paragraph index to annotation text
  const [annotations, setAnnotations] = useState<Record<number, string>>({});
  
  // Map paragraph index to list of highlights
  const [highlights, setHighlights] = useState<Record<number, Highlight[]>>({});

  // Persist settings
  useEffect(() => {
    localStorage.setItem('access-reader-settings', JSON.stringify(settings));
  }, [settings]);

  // Handle global key shortcuts for zoom
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setSettings(s => ({ ...s, fontSize: Math.min(s.fontSize + 2, 72) }));
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '-')) {
        e.preventDefault();
        setSettings(s => ({ ...s, fontSize: Math.max(s.fontSize - 2, 12) }));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // --- Global Magnifier Logic ---
  useEffect(() => {
    if (!settings.isLoupeActive) {
      setHoveredText('');
      return;
    }

    const extractWord = (text: string, offset: number) => {
      // Improved word extraction that handles boundaries better
      if (!text) return '';
      const isWordChar = (char: string) => /[\w\u00C0-\u00FF\u4e00-\u9fff]/.test(char);
      
      let start = offset;
      let end = offset;
      
      // If we clicked strictly between words, check surrounding
      if (!isWordChar(text[start]) && start > 0 && isWordChar(text[start-1])) {
          start--;
      }
      
      while (start > 0 && isWordChar(text[start - 1])) start--;
      while (end < text.length && isWordChar(text[end])) end++;
      
      const word = text.slice(start, end).trim();
      // Only return if it's a meaningful chunk
      return word.length > 0 ? word : '';
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      let foundText = '';

      // 1. Try Standard Range API (Best for text nodes)
      // @ts-ignore
      if (document.caretRangeFromPoint) {
        // @ts-ignore
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
          foundText = extractWord(range.startContainer.textContent || '', range.startOffset);
        }
      } 
      // Fallback for some browsers
      // @ts-ignore
      else if (document.caretPositionFromPoint) {
         // @ts-ignore
         const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
         if (pos && pos.offsetNode.nodeType === Node.TEXT_NODE) {
           foundText = extractWord(pos.offsetNode.textContent || '', pos.offset);
         }
      }

      // 2. If no text node found, check for interactive elements (Buttons, Labels, Headers)
      if (!foundText) {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
        if (el) {
          const tagName = el.tagName;
          if (['BUTTON', 'LABEL', 'A', 'H1', 'H2', 'H3', 'SPAN', 'MARK'].includes(tagName)) {
             foundText = el.innerText || el.getAttribute('aria-label') || '';
             // Limit length for UI elements to avoid massive blocks
             if (foundText.length > 50) foundText = foundText.substring(0, 50) + '...';
          } 
          // REMOVED: Greedy INPUT/TEXTAREA fallback that grabbed the whole value/placeholder.
          // Now we rely on the caretRange logic above. If it fails (e.g. placeholder), we show nothing,
          // which is better than showing the entire placeholder text.
        }
      }

      setHoveredText(foundText);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [settings.isLoupeActive]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnnotations({});
    setHighlights({});

    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      handlePdfUpload(file);
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      fileName.endsWith('.docx')
    ) {
      handleDocxUpload(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          setContent(text);
          window.scrollTo(0, 0);
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePdfUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result;
      if (window.pdfjsLib && arrayBuffer) {
        try {
          const loadingTask = window.pdfjsLib.getDocument(arrayBuffer);
          const pdf = await loadingTask.promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n\n';
          }
          setContent(fullText);
          window.scrollTo(0, 0);
        } catch (error) {
          console.error("Error reading PDF:", error);
          alert("Could not read PDF file.");
        }
      } else {
        alert("PDF library not loaded yet.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDocxUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result;
      if (window.mammoth && arrayBuffer) {
        window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
          .then((result: any) => {
            setContent(result.value);
            window.scrollTo(0, 0);
          })
          .catch((err: any) => {
            console.error("Error reading Word file:", err);
            alert("Could not read Word file.");
          });
      } else {
        alert("Word document library not loaded yet.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateAnnotation = (index: number, text: string) => {
    setAnnotations(prev => ({ ...prev, [index]: text }));
  };

  const addHighlight = (index: number, start: number, end: number, text: string) => {
    setHighlights(prev => {
      const current = prev[index] || [];
      return {
        ...prev,
        [index]: [...current, { start, end, text, id: Date.now().toString() }]
      };
    });
  };

  const removeHighlight = (paragraphIndex: number, id: string) => {
     setHighlights(prev => {
      const current = prev[paragraphIndex] || [];
      return {
        ...prev,
        [paragraphIndex]: current.filter(h => h.id !== id)
      };
     });
  };

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 overflow-hidden ${THEME_STYLES[settings.theme]}`}>
      <div className="flex-1 overflow-hidden relative">
        <Reader 
          content={content} 
          settings={settings} 
          onUpdateSettings={setSettings}
          annotations={annotations}
          onUpdateAnnotation={updateAnnotation}
          highlights={highlights}
          onAddHighlight={addHighlight}
          onRemoveHighlight={removeHighlight}
        />
      </div>
      
      <Loupe 
        activeText={hoveredText} 
        theme={settings.theme} 
        visible={settings.isLoupeActive && !!hoveredText}
      />

      <Toolbar 
        settings={settings} 
        onUpdateSettings={setSettings} 
        onFileUpload={handleFileUpload}
      />
    </div>
  );
};

export default App;