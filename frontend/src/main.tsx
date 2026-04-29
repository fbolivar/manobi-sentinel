import ReactDOM from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './lib/push';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.PROD) {
  window.addEventListener('load', () => { registerServiceWorker(); });
}
