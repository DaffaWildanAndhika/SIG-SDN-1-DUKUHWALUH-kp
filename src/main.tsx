/**
 * main.tsx
 * Titik masuk (entry point) utama untuk aplikasi React.
 * Menghubungkan komponen utama App ke elemen DOM dengan ID 'root' dan mengaktifkan StrictMode.
 */
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
