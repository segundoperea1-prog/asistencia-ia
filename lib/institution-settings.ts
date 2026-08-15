"use client"

export type InstitutionSettings = {
  logoBase64: string | null
  teacherName: string
  institutionName: string
  institutionPhone: string
  deceName: string
  decePhone: string
  highlightAlerts: boolean
  language: "es" | "en" | "fr" // <--- Aquí agregamos la opción de idioma
}

export const DEFAULT_INSTITUTION_SETTINGS: InstitutionSettings = {
  logoBase64: null,
  teacherName: "",
  institutionName: "",
  institutionPhone: "",
  deceName: "",
  decePhone: "",
  highlightAlerts: true,
  language: "es", // <--- Aquí definimos que el idioma inicial sea Español
}

const SETTINGS_KEY = "institution_settings"

export function loadInstitutionSettings(): InstitutionSettings {
  if (typeof window === "undefined") return DEFAULT_INSTITUTION_SETTINGS
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_INSTITUTION_SETTINGS, ...parsed }
    }
  } catch (error) {
    console.error("Error loading settings", error)
  }
  return DEFAULT_INSTITUTION_SETTINGS
}

export function saveInstitutionSettings(settings: InstitutionSettings) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error("Error saving settings", error)
  }
}