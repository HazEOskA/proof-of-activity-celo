import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import MainnetDeploy from './MainnetDeploy.tsx'

const showMainnetDeploy = new URLSearchParams(window.location.search).get('deploy') === 'mainnet'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showMainnetDeploy ? <MainnetDeploy /> : <App />}
  </StrictMode>,
)
