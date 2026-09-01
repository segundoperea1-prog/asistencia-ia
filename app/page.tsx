"use client"

import { useState } from "react"
// IMPORTACIÓN CON LLAVES
import { LoginScreen } from "@/components/login-screen"
import { StudentsView } from "@/components/students-view"

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />
  }

  return <StudentsView />
}