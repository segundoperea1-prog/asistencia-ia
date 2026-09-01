"use client"

import { supabase } from "@/lib/supabase"

export type InstitutionSettings = {
  logoBase64: string | null
  teacherName: string
  institutionName: string
  institutionPhone: string
  deceName: string
  decePhone: string
  highlightAlerts: boolean
  language: "es" | "en" | "fr"
}

export const DEFAULT_INSTITUTION_SETTINGS: InstitutionSettings = {
  logoBase64: null,
  teacherName: "",
  institutionName: "",
  institutionPhone: "",
  deceName: "",
  decePhone: "",
  highlightAlerts: true,
  language: "es",
}

// Carga los datos desde la nube de Supabase
export async function loadInstitutionSettings(): Promise<InstitutionSettings> {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .eq('id', 1)
      .single()

    if (data && !error) {
      return {
        logoBase64: data.logo_base64 || null,
        teacherName: data.nombre_docente || "",
        institutionName: data.nombre_institucion || "",
        institutionPhone: data.telefono_institucion || "",
        deceName: data.encargado_vicerrectorado || "",
        decePhone: data.telefono_vicerrectorado || "",
        highlightAlerts: data.resaltar_alertas ?? true,
        language: (data.idioma as "es" | "en" | "fr") || "es",
      }
    }
  } catch (error) {
    console.error("Error al cargar configuración desde la nube", error)
  }
  return DEFAULT_INSTITUTION_SETTINGS
}

// Guarda los datos en la nube de Supabase
export async function saveInstitutionSettings(settings: InstitutionSettings): Promise<boolean> {
  try {
    const payload = {
      id: 1, // ID único para la configuración global
      logo_base64: settings.logoBase64,
      nombre_docente: settings.teacherName,
      nombre_institucion: settings.institutionName,
      telefono_institucion: settings.institutionPhone,
      encargado_vicerrectorado: settings.deceName,
      telefono_vicerrectorado: settings.decePhone,
      resaltar_alertas: settings.highlightAlerts,
      idioma: settings.language
    }

    const { error } = await supabase.from('configuracion').upsert(payload)
    
    if (error) throw error
    return true
  } catch (error) {
    console.error("Error al guardar configuración en la nube", error)
    return false
  }
}