import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import App from './App.tsx';
import {LogsPage} from './components/LogsPage.tsx';
import {ComplaintPage} from './components/ComplaintPage.tsx';
import {ComplaintsDashboard} from './components/ComplaintsDashboard.tsx';
import {ChooserPage} from './components/ChooserPage.tsx';
import {RootRedirect} from './components/RootRedirect.tsx';
import './index.css';
import './i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Bare `/` (and any unrecognized path) defers to the `prod_release`
            flag (see RootRedirect): /ask until the flag is flipped to 'Y'
            in Supabase, /root (the chooser) after. A direct link to a
            specific event (/e/:joinCode) bypasses this entirely and goes
            straight to that event's Q&A, unaffected either way. */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/root" element={<ChooserPage />} />
        <Route path="/ask" element={<App />} />
        <Route path="/e/:joinCode" element={<App />} />
        <Route path="/complain" element={<ComplaintPage />} />
        <Route path="/dashboard" element={<ComplaintsDashboard />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
