"use client"

import { AppProvider, useApp } from "@/lib/app-context"
import { LoginScreen } from "@/components/login-screen"
import { MainLayout } from "@/components/main-layout"

function AppContent() {
  const { isAuthenticated } = useApp()

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <MainLayout />
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
