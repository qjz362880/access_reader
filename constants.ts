import { ThemeMode } from './types';

export const THEME_STYLES = {
  [ThemeMode.LIGHT]: 'bg-[#ffffff] text-gray-900 selection:bg-blue-200 selection:text-blue-900',
  [ThemeMode.DARK]: 'bg-[#1a1a1a] text-gray-200 selection:bg-gray-600 selection:text-white',
  [ThemeMode.SEPIA]: 'bg-[#f4ecd8] text-[#5b4636] selection:bg-[#d8cba8] selection:text-[#3e3025]',
  [ThemeMode.HIGH_CONTRAST]: 'bg-black text-[#ffff00] selection:bg-[#ffff00] selection:text-black border-[#ffff00]',
  [ThemeMode.INK]: 'bg-[#f7f7f7] text-black selection:bg-[#d4d4d4] selection:text-black',
};

export const SAMPLE_TEXT = `Welcome to AccessReader.

This assistive tool is designed to create a personalized, accessible reading environment tailored to your needs. To get started, use the "Open File" button at the bottom to load a .txt, .pdf, or .docx document.

🔍 Magnification & Study Tools
• Magnifier: Enable the lens in the sidebar to view text under your cursor at high magnification.
• Marker Mode: Highlight specific words or sentences within a paragraph.
• Notes: Click any paragraph to select it, then add your personal notes in the sidebar.

🔊 Read Aloud & Audio
Located in the Right Sidebar:
• Continuous Reading: Click "Read All" to start a hands-free session. The app will read the text and automatically scroll to the next paragraph until finished.
• Play Paragraph: Listen to just the currently selected text block.
• Voice Selection: Choose your preferred speech voice from the available system options.

🧠 Bionic Reading & Focus Tools
Located in the Bottom Toolbar:
• Bionic Reading: Toggle this to highlight the initial letters of words. This guides your eye through the text (artificial fixation), helping to increase reading speed and focus, especially for ADHD.
• Focus Mode: Dims all text except the paragraph you are currently reading.
• Hover Zoom: Automatically enlarges the text block you are hovering over.

🎨 Appearance Customization
• Themes: High Contrast (Yellow/Black), E-Ink (Paper-like), Sepia, Dark, and Light.
• Typography: Adjust font size and font family (Sans, Serif, Mono).

🎤 Voice Control
Enable "Microphone" in the Right Sidebar to control the app hands-free:
• Navigation: Say "Next" or "Previous" to jump between paragraphs.
• Reading: Say "Read All" to start continuous reading, or "Stop" to pause.
• Modes: Say "Magnifier On/Off", "Focus Mode On/Off", or "Bionic On/Off".

Keyboard Shortcuts:
• Arrow Keys: Navigate between paragraphs.
• Spacebar: Scroll down.
• Ctrl + / -: Adjust overall interface scale.
`;