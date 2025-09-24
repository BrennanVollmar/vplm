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
(function handleGithubPagesRedirect() {
  try {
    const search = window.location.search
    if (search.startsWith('?/')) {
      const redirect = search.substring(2)
      const parts = redirect.split('&')
      const pathRaw = decodeURIComponent(parts[0] || '')
      const path = pathRaw ? (pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`) : '/'
      const querySegments = parts.slice(1).map((segment) =>
        decodeURIComponent(segment.replace(/~and~/g, '&'))
      ).filter(Boolean)
      const queryString = querySegments.length ? `?${querySegments.join('&')}` : ''
      const newUrl = `${path}${queryString}${window.location.hash}`
      window.history.replaceState(null, '', newUrl)
    }
  } catch (err) {
    console.warn('GitHub Pages redirect handling failed', err)
  }
})()

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
