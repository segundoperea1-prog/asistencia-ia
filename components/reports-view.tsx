"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Download, FileSpreadsheet, Activity, Search, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loadInstitutionSettings } from "@/lib/institution-settings"
import ExcelJS from "exceljs"

type Student = { id: string; nombres: string; curso: string }
type Attendance = { estudiante_id: string; fecha: string; estado: "present" | "absent" | "late"; curso: string }

function formatearFechaCompleta(fechaSql: string) {
  if (!fechaSql) return ""
  const partes = fechaSql.split('-')
  if (partes.length !== 3) return fechaSql
  
  const fecha = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
  return new Intl.DateTimeFormat('es-ES', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  }).format(fecha)
}

function obtenerPesoCurso(nombreCurso: string) {
  const c = nombreCurso.toLowerCase();
  let peso = 0;
  
  if (c.includes("primero") || c.includes("1ro") || c.includes("1")) peso += 100;
  else if (c.includes("segundo") || c.includes("2do") || c.includes("2")) peso += 200;
  else if (c.includes("tercero") || c.includes("3ero") || c.includes("3ro") || c.includes("3")) peso += 300;
  else peso += 900; 

  if (c.includes("ciencia")) peso += 10;
  else if (c.includes("tecnico") || c.includes("técnico") || c.includes("inform")) peso += 20;
  else peso += 30; 

  return peso;
}

export function ReportsView() {
  const [students, setStudents] = useState<Student[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterCourse, setFilterCourse] = useState("ALL")
  const [periodType, setPeriodType] = useState<"MONTH" | "YEAR">("MONTH")
  const [settings, setSettings] = useState(() => loadInstitutionSettings())

  useEffect(() => {
    setSettings(loadInstitutionSettings())
    async function loadData() {
      setLoading(true)
      
      const { data: stdData } = await supabase.from("estudiantes").select("id, nombres, curso")
      if (stdData) setStudents(stdData as Student[])

      const { data: attData } = await supabase.from("asistencias").select("estudiante_id, fecha, estado, curso")
      if (attData) setAttendances(attData as Attendance[])
      
      setLoading(false)
    }
    loadData()
  }, [])

  const availableCourses = useMemo(() => {
    const courses = new Set(students.map(s => s.curso))
    return Array.from(courses).sort((a, b) => obtenerPesoCurso(a) - obtenerPesoCurso(b))
  }, [students])

  const reportData = useMemo(() => {
    let filteredStudents = [...students]
    
    if (filterCourse !== "ALL") {
      filteredStudents = students.filter(s => s.curso === filterCourse)
    }
    
    filteredStudents.sort((a, b) => {
      const pesoA = obtenerPesoCurso(a.curso);
      const pesoB = obtenerPesoCurso(b.curso);
      if (pesoA !== pesoB) return pesoA - pesoB;
      return a.nombres.localeCompare(b.nombres, "es", { sensitivity: "base" });
    });
    
    const filteredAttendances = periodType === "YEAR" 
      ? attendances 
      : attendances.filter(a => a.fecha.startsWith(filterMonth))

    return filteredStudents.map(student => {
      const studentAtts = filteredAttendances.filter(a => a.estudiante_id === student.id)
      const asistenciasOrdenadas = [...studentAtts].sort((a, b) => a.fecha.localeCompare(b.fecha))
      
      const diasFaltas = asistenciasOrdenadas.filter(a => a.estado === "absent").map(a => formatearFechaCompleta(a.fecha))
      const diasAtrasos = asistenciasOrdenadas.filter(a => a.estado === "late").map(a => formatearFechaCompleta(a.fecha))

      const presentCount = studentAtts.filter(a => a.estado === "present").length
      const absentCount = studentAtts.filter(a => a.estado === "absent").length
      const lateCount = studentAtts.filter(a => a.estado === "late").length
      
      const totalRegistros = presentCount + absentCount + lateCount
      const porcentaje = totalRegistros === 0 ? 0 : Math.round(((presentCount + lateCount) / totalRegistros) * 100)

      return {
        id: student.id,
        nombres: student.nombres,
        curso: student.curso,
        presentes: presentCount,
        ausentes: absentCount,
        atrasos: lateCount,
        porcentaje: porcentaje,
        listaFaltas: diasFaltas.length > 0 ? diasFaltas.join(", ") : "Ninguna",
        listaAtrasos: diasAtrasos.length > 0 ? diasAtrasos.join(", ") : "Ninguno"
      }
    })
  }, [students, attendances, filterMonth, filterCourse, periodType])

  const handleDownloadExcel = async () => {
    if (reportData.length === 0) {
      alert("No hay datos para exportar en este filtro.")
      return
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Consolidado Asistencia")

    if (settings.logoBase64 && settings.logoBase64.includes("base64,")) {
      try {
        const base64Data = settings.logoBase64.split("base64,")[1]
        const imageId = workbook.addImage({
          base64: base64Data,
          extension: "png",
        })
        worksheet.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 90, height: 90 }
        })
      } catch (e) {
        console.error("No se pudo cargar el logo en el Excel", e)
      }
    }

    const anioReporte = periodType === "MONTH" ? filterMonth.split('-')[0] : new Date().getFullYear().toString()
    const anioSiguiente = Number(anioReporte) + 1
    
    worksheet.getCell("C1").value = `AÑO LECTIVO ${anioReporte} - ${anioSiguiente}`
    worksheet.getCell("C1").font = { bold: true, size: 12, color: { argb: "1E40AF" } } as any

    worksheet.getCell("C2").value = settings.institutionName?.toUpperCase() || "UNIDAD EDUCATIVA FISCAL MODESTO ENRIQUE SUÁREZ PIMENTEL"
    worksheet.getCell("C2").font = { bold: true, size: 14 } as any

    worksheet.getCell("C3").value = `DOCENTE: ${settings.teacherName?.toUpperCase() || "REPORTE OFICIAL"}`
    worksheet.getCell("C3").font = { name: 'Arial', size: 10, italic: true } as any

    worksheet.getCell("C4").value = `Curso: ${filterCourse === "ALL" ? "Todos los Cursos" : filterCourse}  |  Periodo: ${periodType === "YEAR" ? "Histórico Anual" : filterMonth}`
    worksheet.getCell("C4").font = { size: 11, bold: true, color: { argb: "374151" } } as any

    worksheet.addRow([])
    worksheet.addRow([])

    const headerRow = worksheet.addRow([
      "Apellidos y Nombres",
      "Curso",
      "Total Presentes",
      "Total Atrasos",
      "Total Faltas",
      "Porcentaje Asistencia",
      "Fechas Exactas de Atrasos",
      "Fechas Exactas de Faltas"
    ])

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "00a651" }
      } as any
      cell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 } as any
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true } as any
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} } as any
    })
    worksheet.getRow(headerRow.number).height = 28

    reportData.forEach(row => {
      const dataRow = worksheet.addRow([
        row.nombres,
        row.curso,
        row.presentes,
        row.atrasos,
        row.ausentes,
        `${row.porcentaje}%`,
        row.listaAtrasos,
        row.listaFaltas
      ])

      dataRow.eachCell((cell, colNumber) => {
        cell.border = { top: {style:'thin', color: {argb:'E5E7EB'}}, left: {style:'thin', color: {argb:'E5E7EB'}}, bottom: {style:'thin', color: {argb:'E5E7EB'}}, right: {style:'thin', color: {argb:'E5E7EB'}} } as any
        if (colNumber >= 3 && colNumber <= 6) {
          cell.alignment = { horizontal: "center" } as any
        }
      })
    })

    worksheet.columns.forEach((column, index) => {
      let maxLen = 0
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        // AQUÍ ESTÁ LA CORRECCIÓN: Number(cell.row)
        if (cell.value && Number(cell.row) > 4) {
          const len = cell.value.toString().length
          if (len > maxLen) maxLen = len
        }
      })
      column.width = maxLen < 12 ? 14 : Math.min(maxLen + 3, 40)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    
    const nombreArchivo = `Informe_Asistencia_${filterCourse.replace(/ /g, '_')}_${periodType === "YEAR" ? "Anual" : filterMonth}.xlsx`
    link.setAttribute("download", nombreArchivo)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Activity className="h-10 w-10 animate-spin text-primary" />
          <p className="font-medium text-sm">Generando panel de reportes detallados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-36 lg:p-6 lg:pb-28 max-w-7xl mx-auto w-full">
      
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Reportes Mensuales y Anuales</h1>
        <p className="text-muted-foreground font-medium">
          Genere estadísticas detalladas y exporte los consolidados directamente a Excel con formato oficial.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 border-b border-border bg-muted/20">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-500" /> Opciones de Reporte
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Periodo a consultar</label>
            <select 
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as "MONTH" | "YEAR")}
              className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="MONTH">Mensual</option>
              <option value="YEAR">Todo el año</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Seleccionar Mes</label>
            <Input 
              type="month" 
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="font-medium"
              disabled={periodType === "YEAR"}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Curso o Paralelo</label>
            <select 
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ALL">Todos los cursos en general</option>
              {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <Button 
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
            onClick={handleDownloadExcel}
          >
            <FileSpreadsheet className="w-5 h-5" />
            Descargar en Excel
          </Button>

        </CardContent>
      </Card>

      <Card className="shadow-md flex flex-col overflow-hidden border-border">
        <CardHeader className="bg-muted/10 border-b border-border">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Vista Previa de Datos (Jerárquico y A-Z)</span>
            <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {reportData.length} estudiantes encontrados
            </span>
          </CardTitle>
          <CardDescription>
            Resumen ordenado correspondiente a {periodType === "YEAR" ? "todo el año" : filterMonth}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-auto max-h-[500px]">
          {reportData.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Search className="w-10 h-10 mb-3 text-muted-foreground/40" />
              <p className="font-medium">No hay registros para este filtro.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-3 font-semibold border-b">Estudiante (Jerárquico)</th>
                    <th className="px-4 py-3 font-semibold border-b text-center text-emerald-600">Presentes</th>
                    <th className="px-4 py-3 font-semibold border-b text-center text-amber-600">Atrasos</th>
                    <th className="px-4 py-3 font-semibold border-b text-center text-red-600">Faltas</th>
                    <th className="px-4 py-3 font-semibold border-b text-center">% Asist.</th>
                    <th className="px-4 py-3 font-semibold border-b text-slate-500">Fechas de Faltas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportData.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>
                          <p>{row.nombres}</p>
                          <p className="text-[10px] text-muted-foreground font-normal bg-muted w-max px-1.5 py-0.5 rounded mt-0.5">{row.curso}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-700">{row.presentes}</td>
                      <td className="px-4 py-3 text-center font-semibold text-amber-700">{row.atrasos}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-700">{row.ausentes}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          row.porcentaje >= 80 ? 'bg-emerald-100 text-emerald-800' :
                          row.porcentaje >= 60 ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {row.porcentaje}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-red-600 font-medium max-w-[250px] truncate" title={row.listaFaltas}>
                        {row.listaFaltas}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}