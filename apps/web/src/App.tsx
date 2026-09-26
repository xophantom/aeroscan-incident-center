import { ToastProvider } from './components/ui/toast/ToastProvider'
import { OccurrencesPage } from './features/occurrences/OccurrencesPage'

export function App() {
  return (
    <ToastProvider>
      <OccurrencesPage />
    </ToastProvider>
  )
}
