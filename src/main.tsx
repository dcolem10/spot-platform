import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapAmplify } from './lib/amplifyConfig';
import App from './App';
import './styles/global.css';

bootstrapAmplify();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
