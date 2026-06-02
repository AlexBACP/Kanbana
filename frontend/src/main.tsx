import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installAutoCapitalize } from './utils/autoCapitalize'

// Capitalización automática global de inputs (nombres y textos)
installAutoCapitalize()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
