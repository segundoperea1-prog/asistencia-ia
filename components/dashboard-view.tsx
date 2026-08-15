"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, UserCheck, UserX, Clock, AlertTriangle, MessageCircle, Activity, TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { normalizeWhatsAppPhone } from "@/lib/student-utils"
import { Button } from "@/components/ui/button"
import { loadInstitutionSettings } from "@/lib/institution-settings"

type Student = { id: string; nombres: string; curso: string; telefono_representante: string | null }
type Attendance = { estudiante_id: string; fecha: string; estado: "present" | "absent" | "late"; curso: string }

export function DashboardView() {
  const [students, setStudents] = useState<Student[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [settings, setSettings] = useState(() => loadInstitutionSettings())

  useEffect(() => {
    setSettings(loadInstitutionSettings())
    async function loadData() {
      try {
        setLoading(true)
        const { data: stdData, error: stdErr } = await supabase
          .from("estudiantes")
          .select("id, nombres, curso, telefono_representante")
        
        if (stdErr) throw stdErr
        if (stdData) setStudents(stdData as Student[])

        const date = new Date()
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]

        const { data: attData, error: attErr } = await supabase
          .from("asistencias")
          .select("estudiante_id, fecha, estado, curso")
          .gte("fecha", firstDay)

        if (attErr) throw attErr
        if (attData) setAttendances(attData as Attendance[])
        
      } catch (err: any) {
        setErrorMsg("Hubo un problema al conectar con la base de datos.")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const todayStr = new Date().toISOString().split('T')[0]
  const todayAttendances = attendances.filter(a => a.fecha === todayStr)
  
  const presentCount = todayAttendances.filter(a => a.estado === "present").length
  const absentCount = todayAttendances.filter(a => a.estado === "absent").length
  const lateCount = todayAttendances.filter(a => a.estado === "late").length

  const deceAlerts = useMemo(() => {
    const issues: Record<string, { absent: number; late: number; student: Student }> = {}
    
    attendances.forEach(a => {
      if (a.estado === "absent" || a.estado === "late") {
        if (!issues[a.estudiante_id]) {
          const student = students.find(s => s.id === a.estudiante_id)
          if (student) {
            issues[a.estudiante_id] = { absent: 0, late: 0, student }
          }
        }
        if (issues[a.estudiante_id]) {
          if (a.estado === "absent") issues[a.estudiante_id].absent++
          if (a.estado === "late") issues[a.estudiante_id].late++
        }
      }
    })

    return Object.values(issues)
      .filter(record => (record.absent + record.late) >= 2)
      .sort((a, b) => (b.absent + b.late) - (a.absent + a.late))
  }, [attendances, students])

  const courseStats = useMemo(() => {
    const stats: Record<string, { total: number; present: number }> = {}
    students.forEach(s => {
      if (!stats[s.curso]) stats[s.curso] = { total: 0, present: 0 }
      stats[s.curso].total++
    })
    todayAttendances.forEach(a => {
       if (stats[a.curso]) {
         if (a.estado === "present" || a.estado === "late") {
             stats[a.curso].present++
         }
       }
    })
    return Object.entries(stats).map(([curso, data]) => {
        const percentage = data.total === 0 ? 0 : Math.round((data.present / data.total) * 100)
        return { curso, percentage, total: data.total, present: data.present }
    }).sort((a, b) => a.curso.localeCompare(b.curso, "es"))
  }, [students, todayAttendances])

  const todayDateFormatted = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const displayDate = todayDateFormatted.charAt(0).toUpperCase() + todayDateFormatted.slice(1);

  if (loading) return <div className="flex h-full items-center justify-center p-6"><Activity className="h-10 w-10 animate-spin text-primary" /></div>

  return (
    <div className="flex flex-col gap-6 p-4 pb-36 lg:p-6 lg:pb-28 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Panel de Control</h1>
        <p className="text-muted-foreground font-medium">Radiografía en vivo • <span className="text-emerald-600 dark:text-emerald-400">{displayDate}</span></p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{students.length}</div></CardContent></Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Presentes Hoy</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{presentCount}</div></CardContent></Card>
        <Card className="border-l-4 border-l-red-500 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ausentes Hoy</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{absentCount}</div></CardContent></Card>
        <Card className="border-l-4 border-l-amber-500 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Atrasos Hoy</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{lateCount}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-red-100 shadow-md flex flex-col">
          <CardHeader className="bg-red-50/50 border-b border-red-100">
            {/* AQUÍ EL CAMBIO A VICERRECTORADO */}
            <CardTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="w-5 h-5" /> Radar Vicerrectorado (Alertas)</CardTitle>
            <CardDescription>Estudiantes con 2 o más faltas/atrasos en este mes.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
            {deceAlerts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">¡Todo en orden!</div>
            ) : (
              <ul className="divide-y divide-border">
                {deceAlerts.map((alert) => {
                  const repPhone = alert.student.telefono_representante?.trim() || "";
                  const totalIncidencias = alert.absent + alert.late;
                  
                  return (
                    <li key={alert.student.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm whitespace-normal break-words">{alert.student.nombres}</p>
                        <p className="text-xs text-muted-foreground">{alert.student.curso}</p>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold mt-1">
                          {alert.absent > 0 && <span className="bg-red-100 text-red-700 px-2 rounded-full">{alert.absent} Faltas</span>}
                          {alert.late > 0 && <span className="bg-amber-100 text-amber-700 px-2 rounded-full">{alert.late} Atrasos</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <Button size="sm" className="bg-[#25D366] hover:bg-[#20bd5a] flex-1 sm:flex-none" onClick={() => {
                          const d = normalizeWhatsAppPhone(repPhone);
                          // Mensaje de WhatsApp actualizado a Vicerrectorado
                          const msg = `Estimado representante de ${alert.student.nombres}: informamos que acumula ${totalIncidencias} incidencias (${alert.absent} faltas, ${alert.late} atrasos). Favor justificar al Vicerrectorado.`;
                          window.open(`https://wa.me/${d}?text=${encodeURIComponent(msg)}`, "_blank");
                        }}>Notificar Rep.</Button>
                        
                        {settings.decePhone && (
                          <Button size="sm" variant="outline" className="border-rose-500 text-rose-600 flex-1 sm:flex-none" onClick={() => {
                            const d = normalizeWhatsAppPhone(settings.decePhone);
                            // Mensaje de WhatsApp interno actualizado a Vicerrectorado
                            const msg = `Reporte Vicerrectorado: El estudiante ${alert.student.nombres} del curso ${alert.student.curso} acumula ${totalIncidencias} incidencias (${alert.absent} faltas y ${alert.late} atrasos). Solicitamos su intervención.`;
                            window.open(`https://wa.me/${d}?text=${encodeURIComponent(msg)}`, "_blank");
                          }}>Notificar Vicerrectorado</Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md flex flex-col">
            <CardHeader className="border-b border-border bg-muted/20"><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-500" /> Termómetro por Curso</CardTitle></CardHeader>
            <CardContent className="p-4">
               {courseStats.map((stat) => (
                   <div key={stat.curso} className="mb-4">
                       <div className="flex justify-between text-sm mb-1"><span className="font-bold">{stat.curso}</span><span>{stat.percentage}%</span></div>
                       <div className="h-3 w-full bg-secondary rounded-full"><div className={`h-full ${stat.percentage < 70 ? 'bg-red-500' : 'bg-emerald-500'} rounded-full`} style={{ width: `${stat.percentage}%` }}></div></div>
                   </div>
               ))}
            </CardContent>
        </Card>
      </div>
    </div>
  )
}