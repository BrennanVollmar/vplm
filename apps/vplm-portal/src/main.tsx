import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app'
import { registerSW } from './sw-reg'
import './styles.css'
import ErrorBoundary from './components/ErrorBoundary'
import ToastProvider from './components/ToastProvider'
import { AuthProvider } from './lib/auth'

// Handle GitHub Pages SPA redirects (see public/404.html)
const redirectPayload = (() => {
  try {
    const raw = sessionStorage.getItem('spa-github-pages:redirect')
    if (!raw) return null
    sessionStorage.removeItem('spa-github-pages:redirect')
    return JSON.parse(raw) as { pathname: string; search?: string; hash?: string }
  } catch {
    return null
  }
})()

if (redirectPayload && window.location.search.includes('redirectedFrom=404')) {
  const baseUrl = window.location.protocol + '//' + window.location.host
  const target = redirectPayload.pathname + (redirectPayload.search || '') + (redirectPayload.hash || '')
  const finalUrl = baseUrl + target.replace(/\/+/g, '/')
  window.history.replaceState(null, '', finalUrl)
}

const root = document.getElementById('root')!
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)

registerSW()
