import { BrowserRouter, Routes, Route } from 'react-router'
import Layout from './components/Layout'
import HomePage from './features/home/HomePage'
import InventoryPage from './features/inventory/InventoryPage'
import ShoppingListPage from './features/shopping-list/ShoppingListPage'
import RecipesPage from './features/recipes/RecipesPage'
import WochenplanPage from './features/mealplan/WochenplanPage'
import SettingsPage from './features/settings/SettingsPage'
import { AuthProvider, useAuth } from './lib/AuthProvider'
import { hasSupabaseConfig } from './lib/supabaseClient'
import SupabaseSetupNotice from './features/auth/SupabaseSetupNotice'
import AuthPage from './features/auth/AuthPage'

// Erst wenn Supabase konfiguriert UND eine Sitzung vorhanden ist, wird die
// eigentliche App (mit Navigation) angezeigt – davor Einrichtungs-Hinweis
// bzw. Login/Registrierung.
function AppRoutes() {
  const { session, loading } = useAuth()

  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <SupabaseSetupNotice />
      </div>
    )
  }

  if (loading) {
    return <p className="p-6 text-sm text-stone-400">Lade …</p>
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <AuthPage />
      </div>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/utensilien" element={<InventoryPage />} />
        <Route path="/einkaufsliste" element={<ShoppingListPage />} />
        <Route path="/rezepte" element={<RecipesPage />} />
        <Route path="/wochenplan" element={<WochenplanPage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
