
  import { createRoot } from 'react-dom/client';
  import App from './App';
  import './index.css';

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(error => {
          console.error('[service-worker] registration failed', error);
        });
    });
  }

  createRoot(document.getElementById('root')!).render(<App />);
  