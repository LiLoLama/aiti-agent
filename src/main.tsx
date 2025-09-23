import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import { loadAgentSettings } from './utils/storage';
import { applyColorScheme } from './utils/theme';
import { AuthProvider } from './context/AuthContext';

if (typeof window !== 'undefined') {
  const initialSettings = loadAgentSettings();
  applyColorScheme(initialSettings.colorScheme);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename="/agent">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
