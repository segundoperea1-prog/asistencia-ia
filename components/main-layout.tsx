"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  X,
  Calendar,
  Upload,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { useApp } from "@/lib/app-context"
import { DashboardView } from "@/components/dashboard-view"
import { StudentsView } from "@/components/students-view"
import { AttendanceView } from "@/components/attendance-view"
import { ReportsView } from "@/components/reports-view"
import { SettingsView } from "@/components/settings-view"

type View = "dashboard" | "students" | "attendance" | "reports" | "schedule" | "settings"

const navItems = [
  { id: "dashboard" as View, label: "Panel de Control", icon: LayoutDashboard },
  { id: "students" as View, label: "Estudiantes", icon: Users },
  { id: "attendance" as View, label: "Asistencia", icon: ClipboardCheck },
  { id: "reports" as View, label: "Reportes", icon: FileBarChart },
  { id: "schedule" as View, label: "Horario", icon: Calendar },
  { id: "settings" as View, label: "Configuración", icon: Settings },
]

// --- Nueva Pantalla de Horario Inteligente ---
function ScheduleView() {
  const [scheduleImage, setScheduleImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar la foto al iniciar desde la memoria del navegador
  useEffect(() => {
    const savedImage = localStorage.getItem("profe_horario_img")
    if (savedImage) setScheduleImage(savedImage)
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setScheduleImage(base64String)
        localStorage.setItem("profe_horario_img", base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="flex flex-col h-full p-4 lg:p-6 pb-24 bg-background">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Mi Horario de Clases</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          {scheduleImage ? <RefreshCw className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {scheduleImage ? "Cambiar Foto" : "Subir Horario"}
        </Button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageChange} 
        accept="image/*" 
        className="hidden" 
      />

      <div className="flex-1 bg-muted/30 rounded-2xl overflow-hidden border-2 border-dashed border-border flex items-center justify-center relative">
        {scheduleImage ? (
          <img 
            src={scheduleImage} 
            alt="Mi Horario" 
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <div className="text-center p-8">
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-10 h-10 text-primary" />
            </div>
            <p className="text-xl font-semibold mb-2">Su horario aparecerá aquí</p>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Presione el botón de arriba para seleccionar la foto de su horario.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Resto del Layout (Sin cambios pero integrado) ---
export function MainLayout() {
  const { setIsAuthenticated } = useApp()
  const [currentView, setCurrentView] = useState<View>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    setIsAuthenticated(false)
  }

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-start gap-3">
          <Image src="/Logo_modesto-fondo.png" alt="Escudo" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
          <div className="min-w-0">
            <h2 className="font-semibold text-sidebar-foreground text-xs leading-snug line-clamp-3">
              Unidad Educativa Fiscal Modesto Enrique Suárez Pimentel
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <Image src="/El_profe_Segundo_fondo.png" alt="Profe" width={24} height={24} className="h-6 w-6 shrink-0 rounded-full object-cover" />
              <p className="text-xs text-sidebar-foreground/70">Profe Segundo</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setCurrentView(item.id); onNavigate?.(); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                currentView === item.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </ScrollArea>

      <div className="p-3 border-t border-sidebar-border">
        <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )

  const renderView = () => {
    switch (currentView) {
      case "dashboard": return <DashboardView />
      case "students": return <StudentsView />
      case "attendance": return <AttendanceView />
      case "reports": return <ReportsView />
      case "schedule": return <ScheduleView />
      case "settings": return <SettingsView />
      default: return <DashboardView />
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2 min-w-0">
              <Image src="/Logo_modesto-fondo.png" alt="Escudo" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-xs leading-tight line-clamp-2">
                  U.E.F Modesto Enrique Suárez Pimentel
                </p>
              </div>
            </div>
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar">
                <SheetTitle className="sr-only">Menú</SheetTitle>
                <SidebarContent onNavigate={() => setSidebarOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{renderView()}</main>

        <nav className="lg:hidden sticky bottom-0 bg-background/95 backdrop-blur border-t border-border">
          <div className="flex items-center justify-around px-2 h-16">
            {navItems.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  currentView === item.id ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}