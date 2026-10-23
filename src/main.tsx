import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {WorkspaceAccessGate} from './components/WorkspaceAccessGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceAccessGate />
  </StrictMode>,
);
