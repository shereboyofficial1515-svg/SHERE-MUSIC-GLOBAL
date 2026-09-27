import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ErrorBoundary from './components/layout/ErrorBoundary.jsx';
import { PageLoader } from './components/ui/Feedback.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { PreferencesProvider } from './context/PreferencesContext.jsx';
import { PlayerProvider } from './context/PlayerContext.jsx';
import { DownloadProvider } from './context/DownloadContext.jsx';
import { LibraryProvider } from './context/LibraryContext.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/music.css';
import './styles/player.css';
import './styles/video.css';
import './styles/settings.css';
import './styles/admin.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <SettingsProvider>
            <AuthProvider>
              <PreferencesProvider>
                <PlayerProvider>
                  <DownloadProvider>
                    <LibraryProvider>
                      <Suspense fallback={<PageLoader />}>
                        <App />
                      </Suspense>
                    </LibraryProvider>
                  </DownloadProvider>
                </PlayerProvider>
              </PreferencesProvider>
            </AuthProvider>
          </SettingsProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
