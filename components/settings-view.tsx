"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, CheckCircle2, ImagePlus, Save, Settings2, ShieldAlert, Globe, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DEFAULT_INSTITUTION_SETTINGS, loadInstitutionSettings, saveInstitutionSettings, type InstitutionSettings } from "@/lib/institution-settings"

export function SettingsView() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState<InstitutionSettings>(DEFAULT_INSTITUTION_SETTINGS)
  const [savedMessage, setSavedMessage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Carga asíncrona desde la nube al iniciar el panel
  useEffect(() => {
    loadInstitutionSettings().then(data => setSettings(data))
  }, [])

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") setSettings((prev) => ({ ...prev, logoBase64: result }))
    }
    reader.readAsDataURL(file)
  }

  // Guardado asíncrono hacia la nube
  const handleSave = async () => {
    setIsSaving(true)
    const success = await saveInstitutionSettings(settings)
    setIsSaving(false)
    
    if (success) {
      setSavedMessage(true)
      window.setTimeout(() => setSavedMessage(false), 3000)
    } else {
      alert("Error de conexión al guardar en la nube.")
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-24 lg:p-6 lg:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración en la Nube</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tus datos institucionales están protegidos y persistentes.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Datos Institucionales</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium">Logo Institucional</p>
              <button onClick={() => fileInputRef.current?.click()} className={cn("flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors", settings.logoBase64 && "border-solid border-primary")}>
                {settings.logoBase64 ? <img src={settings.logoBase64} className="h-full w-full object-contain p-1 rounded-lg" /> : <ImagePlus className="h-8 w-8 text-muted-foreground" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            <div className="space-y-2"><label className="text-sm font-medium">Nombre Docente</label><Input value={settings.teacherName} onChange={(e) => setSettings({...settings, teacherName: e.target.value})} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Nombre Institución</label><Input value={settings.institutionName} onChange={(e) => setSettings({...settings, institutionName: e.target.value})} /></div>
            <div className="space-y-2"><label className="text-sm font-medium flex items-center gap-2"><Phone className="h-4 w-4" /> Teléfono Institucional</label><Input value={settings.institutionPhone} onChange={(e) => setSettings({...settings, institutionPhone: e.target.value})} /></div>

            <div className="space-y-3 pt-4 border-t border-border mt-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-rose-700"><ShieldAlert className="h-4 w-4" /> Dpto. Vicerrectorado</h3>
              <div className="space-y-2"><label className="text-xs font-medium">Encargado(a)</label><Input value={settings.deceName} onChange={(e) => setSettings({...settings, deceName: e.target.value})} /></div>
              <div className="space-y-2"><label className="text-xs font-medium">WhatsApp Vicerrectorado</label><Input value={settings.decePhone} placeholder="Ej: 0987654321" onChange={(e) => setSettings({...settings, decePhone: e.target.value})} /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary"/> Preferencias</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <label className="flex items-center gap-3 p-4 bg-muted/20 rounded-lg cursor-pointer">
              <input type="checkbox" checked={settings.highlightAlerts} onChange={(e) => setSettings({...settings, highlightAlerts: e.target.checked})} />
              <span className="text-sm">Resaltar alertas de asistencia</span>
            </label>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2"><Globe className="h-4 w-4" /> Idioma del Sistema</label>
              <select value={settings.language} onChange={(e) => setSettings({...settings, language: e.target.value as any})} className="w-full p-2 border rounded-md bg-background text-sm">
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center pt-4">
        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8">
          <Save className="h-5 w-5" /> {isSaving ? "Guardando..." : "Guardar en la Nube"}
        </Button>
        {savedMessage && (
          <span className="flex items-center gap-2 text-sm font-bold text-emerald-600 animate-in fade-in">
            <CheckCircle2 className="h-5 w-5" /> Sincronización exitosa
          </span>
        )}
      </div>
    </div>
  )
}