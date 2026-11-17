import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './store/store.jsx';
import { ToastProvider } from './components/ui.jsx';
import './styles.css';

const kok = document.getElementById('root');
kok.dataset.ok = '1';
createRoot(kok).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);
