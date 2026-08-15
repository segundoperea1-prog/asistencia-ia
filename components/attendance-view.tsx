"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Search, Calendar as CalendarIcon, FileText, Image as ImageIcon, CheckCircle2, AlertTriangle, Upload, Activity, Pencil } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type AttendanceRecord = {
  id: number
  estudiante_id: string
  fecha: string
  estado: "present" | "absent" | "late"
  curso: string
  justificacion: string | null
  justificacion_foto_url: string | null
}

type StudentRecord = {
  id: string
  nombres: string
  curso: string
}

type JoinedRecord = AttendanceRecord & {
  studentName: string
}

const STATUS_LABELS = {
  present: { label: "Presente", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  absent: { label: "Ausente", bg: "bg-red-100 text-red-800 border-red-200" },
  late: { label: "Atraso", bg: "bg-amber-100 text-amber-800 border-amber-200" },
}

function formatearFechaEcuador(fechaSql: string | undefined) {
  if (!fechaSql) return ""
  const partes = fechaSql.split('-') 
  if (partes.length !== 3) return fechaSql
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

export function AttendanceView() {
  const [records, setRecords] = useState<JoinedRecord[]>([])
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState("")
  // Ajuste para el nuevo filtro: "ALL_YEAR" o una fecha específica (por defecto hoy)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterCourse, setFilterCourse] = useState("ALL")
  
  const [justifyDialogOpen, setJustifyDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<JoinedRecord | null>(null)
  const [justifyText, setJustifyText] = useState("")
  const [justifyFile, setJustifyFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [recordToEdit, setRecordToEdit] = useState<JoinedRecord | null>(null)
  const [newStatus, setNewStatus] = useState<"present" | "absent" | "late">("present")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const fetchAttendance = async () => {
    setLoading(true)
    const { data: stdData } = await supabase.from("estudiantes").select("id, nombres, curso")
    const studentsMap = new Map((stdData || []).map(s => [s.id, s]))

    const { data: attData } = await supabase
      .from("asistencias")
      .select("*")
      .order("fecha", { ascending: false })

    if (attData) {
      const joined: JoinedRecord[] = attData.map(a => ({
        ...a,
        studentName: studentsMap.get(a.estudiante_id)?.nombres || "Desconocido"
      }))
      setRecords(joined)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAttendance()
  }, [])

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Si el filtro es ALL_YEAR, siempre devuelve true para la fecha
      const matchDate = filterDate === "ALL_YEAR" || record.fecha === filterDate
      const matchCourse = filterCourse === "ALL" || record.curso === filterCourse
      const matchSearch = record.studentName.toLowerCase().includes(search.toLowerCase())
      return matchDate && matchCourse && matchSearch
    }).sort((a, b) => a.studentName.localeCompare(b.studentName, "es"))
  }, [records, search, filterDate, filterCourse])

  const availableCourses = useMemo(() => {
    const courses = new Set(records.map(r => r.curso))
    return Array.from(courses).sort()
  }, [records])

  const handleOpenJustify = (record: JoinedRecord) => {
    setSelectedRecord(record)
    setJustifyText(record.justificacion || "")
    setJustifyFile(null)
    setJustifyDialogOpen(true)
  }

  const handleOpenView = (record: JoinedRecord) => {
    setSelectedRecord(record)
    setViewDialogOpen(true)
  }

  const handleOpenEdit = (record: JoinedRecord) => {
    setRecordToEdit(record)
    setNewStatus(record.estado)
    setEditDialogOpen(true)
  }

  const handleSaveStatus = async () => {
    if (!recordToEdit) return
    setIsUpdatingStatus(true)

    const { error } = await supabase
      .from("asistencias")
      .update({ estado: newStatus })
      .eq("id", recordToEdit.id)

    if (error) {
      alert("Error al actualizar el estado: " + error.message)
    } else {
      setRecords(prev => prev.map(r => 
        r.id === recordToEdit.id 
          ? { ...r, estado: newStatus } 
          : r
      ))
      setEditDialogOpen(false)
    }
    setIsUpdatingStatus(false)
  }

  const handleSaveJustification = async () => {
    if (!selectedRecord) return
    setIsUploading(true)

    let finalPhotoUrl = selectedRecord.justificacion_foto_url

    if (justifyFile) {
      const fileExt = justifyFile.name.split('.').pop()
      const fileName = `${selectedRecord.estudiante_id}_${selectedRecord.fecha}_${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from("justificaciones")
        .upload(fileName, justifyFile, { upsert: true })

      if (uploadError) {
        alert("Error al subir la foto: " + uploadError.message)
        setIsUploading(false)
        return
      }

      const { data: publicData } = supabase.storage
        .from("justificaciones")
        .getPublicUrl(fileName)
      
      finalPhotoUrl = publicData.publicUrl
    }

    const { error: updateError } = await supabase
      .from("asistencias")
      .update({
        justificacion: justifyText,
        justificacion_foto_url: finalPhotoUrl
      })
      .eq("id", selectedRecord.id)

    if (updateError) {
      alert("Error al guardar la justificación.")
    } else {
      setRecords(prev => prev.map(r => 
        r.id === selectedRecord.id 
          ? { ...r, justificacion: justifyText, justificacion_foto_url: finalPhotoUrl }
          : r
      ))
      setJustifyDialogOpen(false)
    }
    
    setIsUploading(false)
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-36 lg:p-6 lg:pb-28 max-w-7xl mx-auto w-full">
      
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Historial de Asistencia</h1>
        <p className="mt-2 text-muted-foreground">
          Gestione las faltas, agregue justificaciones médicas y corrija errores de registro haciendo clic en el estado.
        </p>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 grid gap-4 sm:grid-cols-3">
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fecha a consultar</label>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  type="date" 
                  value={filterDate === "ALL_YEAR" ? "" : filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  disabled={filterDate === "ALL_YEAR"}
                  className="pl-9"
                />
              </div>
              {/* Botón para alternar entre fecha específica y Todo el año */}
              <Button 
                variant={filterDate === "ALL_YEAR" ? "default" : "outline"}
                className={filterDate === "ALL_YEAR" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                onClick={() => setFilterDate(filterDate === "ALL_YEAR" ? new Date().toISOString().split('T')[0] : "ALL_YEAR")}
              >
                Todo el año
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Curso</label>
            <select 
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ALL">Todos los cursos</option>
              {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Buscar Alumno</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Escriba un nombre..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Activity className="h-8 w-8 animate-spin text-primary mb-4" />
          <p>Cargando historial...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg bg-muted/20">
          <CalendarIcon className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No hay registros para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecords.map((record) => {
            const isIssue = record.estado === "absent" || record.estado === "late";
            const isJustified = !!record.justificacion || !!record.justificacion_foto_url;

            return (
              <Card key={record.id} className={`overflow-hidden transition-all ${isJustified ? 'border-indigo-200 bg-indigo-50/10' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="pr-2">
                      <p className="font-bold text-sm text-foreground line-clamp-1" title={record.studentName}>
                        {record.studentName}
                      </p>
                      <p className="text-xs text-muted-foreground">{record.curso}</p>
                      {/* MOSTRAR FECHA EN HISTORIAL (Útil si se ve "Todo el año") */}
                      <p className="text-[10px] font-mono mt-1 text-slate-500">{formatearFechaEcuador(record.fecha)}</p>
                    </div>
                    
                    <button 
                      onClick={() => handleOpenEdit(record)}
                      title="Clic para corregir asistencia"
                      className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded border uppercase tracking-wider transition-all hover:opacity-75 hover:shadow-md cursor-pointer shrink-0 ${STATUS_LABELS[record.estado].bg}`}
                    >
                      {STATUS_LABELS[record.estado].label}
                      <Pencil className="h-3 w-3 opacity-60" />
                    </button>
                  </div>

                  {isIssue && (
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      {isJustified ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                          onClick={() => handleOpenView(record)}
                        >
                          <FileText className="w-4 h-4 mr-2" /> Ver Justificación
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleOpenJustify(record)}
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" /> Justificar Falta
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Corregir Asistencia</DialogTitle>
            <DialogDescription className="font-medium text-blue-600">
              {recordToEdit?.studentName} • {formatearFechaEcuador(recordToEdit?.fecha)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Estado Correcto</label>
            <select 
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as any)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="present">Presente</option>
              <option value="late">Atraso</option>
              <option value="absent">Ausente (Falta)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-3">
              Al guardar, este registro se actualizará en los reportes y estadísticas.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveStatus} disabled={isUpdatingStatus} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isUpdatingStatus ? "Guardando..." : "Guardar Corrección"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={justifyDialogOpen} onOpenChange={setJustifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir Justificación Médica</DialogTitle>
            <DialogDescription className="font-medium text-indigo-600">
              {selectedRecord?.studentName} • Fecha: {formatearFechaEcuador(selectedRecord?.fecha)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo o Descripción</label>
              <Input 
                placeholder="Ej. Cita médica en el IESS, Calamidad doméstica..." 
                value={justifyText}
                onChange={(e) => setJustifyText(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Foto del Certificado (Opcional)</label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  id="cert-upload"
                  onChange={(e) => setJustifyFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="cert-upload" className="cursor-pointer flex flex-col items-center">
                  {justifyFile ? (
                    <>
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                      <span className="text-sm font-medium text-emerald-600">Archivo seleccionado: {justifyFile.name}</span>
                      <span className="text-xs text-muted-foreground mt-1">Clic para cambiar</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium text-blue-600">Subir foto o escanear</span>
                      <span className="text-xs text-muted-foreground mt-1">JPG, PNG o PDF</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setJustifyDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveJustification} disabled={isUploading || (!justifyText && !justifyFile)}>
              {isUploading ? "Guardando..." : "Guardar Respaldo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" /> Detalle de Justificación
            </DialogTitle>
            <DialogDescription className="font-medium text-indigo-600">
              {selectedRecord?.studentName} • Fecha: {formatearFechaEcuador(selectedRecord?.fecha)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="bg-muted/30 p-3 rounded-md border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Motivo Registrado:</p>
              <p className="text-sm text-foreground">{selectedRecord?.justificacion || "Sin descripción de texto."}</p>
            </div>

            {selectedRecord?.justificacion_foto_url && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evidencia Fotográfica:</p>
                <div className="rounded-md border border-border overflow-hidden bg-black/5 flex justify-center">
                  <img 
                    src={selectedRecord.justificacion_foto_url} 
                    alt="Certificado" 
                    className="max-h-[300px] object-contain"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2"
                  onClick={() => window.open(selectedRecord.justificacion_foto_url || "", "_blank")}
                >
                  <ImageIcon className="w-4 h-4 mr-2" /> Ver Foto en Grande
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setViewDialogOpen(false)
              handleOpenJustify(selectedRecord!)
            }}>
              Editar Justificación
            </Button>
            <Button onClick={() => setViewDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}