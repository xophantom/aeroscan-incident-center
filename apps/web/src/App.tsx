import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/toast/ToastProvider'
import { OccurrencesPage } from './features/occurrences/OccurrencesPage'

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <OccurrencesPage />
      </ToastProvider>
    </ErrorBoundary>
  )
}
