import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {applyColorTheme, resolveStoredAccentPreset, resolveStoredColorTheme} from './lib/theme.ts';

if (typeof window !== 'undefined') {
  applyColorTheme(resolveStoredColorTheme(window.localStorage), resolveStoredAccentPreset(window.localStorage));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
