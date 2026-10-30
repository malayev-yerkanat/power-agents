import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LanguageProvider } from './i18n';
import './styles.css';
import './encounter.css';
import './workspace-polish.css';
import './city-backdrop.css';
import './city-workspace.css';
import './document.css';
import '@xyflow/react/dist/style.css';
import './flows/flows.css';

createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider><App /></LanguageProvider></StrictMode>);
