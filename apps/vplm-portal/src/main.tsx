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
    const url = new URL(window.location.href)
    const redirectParam = url.searchParams.get('p')
    if (!redirectParam) return
    const restoredPath = redirectParam
      .replace(/~and~/g, '&')
      .replace(/\/+/g, '/')
    const newPath = restoredPath.startsWith('/') ? restoredPath : `/${restoredPath}`
    url.searchParams.delete('p')
    const remainingSearch = url.searchParams.toString()
    const finalUrl = `${newPath}${remainingSearch ? `?${remainingSearch}` : ''}${url.hash}`
    window.history.replaceState(null, '', finalUrl)
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
