import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'
import 'leaflet/dist/leaflet.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key")
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: '#007aff',
          colorBackground: '#1c1c1e',
          colorText: '#ffffff',
          colorTextSecondary: 'rgba(255, 255, 255, 0.6)',
          colorInputBackground: 'rgba(118, 118, 128, 0.12)',
          colorInputText: '#ffffff',
        },
        elements: {
          card: "bg-bg-secondary border border-border shadow-xl",
          navbar: "hidden",
          headerTitle: "text-text-primary",
          headerSubtitle: "text-text-secondary",
          socialButtonsBlockButton: "bg-bg-tertiary border-border text-text-primary hover:bg-bg-elevated",
          formFieldLabel: "text-text-secondary",
          formFieldInput: "bg-input-bg border-input-border text-text-primary",
          footerActionLink: "text-accent-blue hover:text-accent-blue-hover",
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/ui">
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>,
)
