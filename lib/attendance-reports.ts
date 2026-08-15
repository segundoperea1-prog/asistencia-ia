import type { AttendanceRecord } from "@/lib/app-context"
import { supabase } from "@/lib/supabase"

export type AttendanceReportRow = {
  id: string
  estudianteId: string
  nombre: string
  curso: string
  estado: AttendanceRecord["status"]
}

type AsistenciaDbRow = {
  id: string
  estado: AttendanceRecord["status"]
  curso: string
  estudiante_id: string
  estudiantes: {
    nombres: string
    curso: string
  } | null
}

export async function fetchAttendanceByDateAndCourse(
  fecha: string,
  curso: string
): Promise<AttendanceReportRow[]> {
  const { data, error } = await supabase
    .from("asistencias")
    .select(
      `
      id,
      estado,
      curso,
      estudiante_id,
      estudiantes (
        nombres,
        curso
      )
    `
    )
    .eq("fecha", fecha)
    .eq("curso", curso)

  if (error) throw error

  const rows = ((data ?? []) as unknown as AsistenciaDbRow[]).map((row) => ({
    id: row.id,
    estudianteId: row.estudiante_id,
    nombre: row.estudiantes?.nombres ?? "Sin nombre",
    curso: row.curso || row.estudiantes?.curso || curso,
    estado: row.estado,
  }))

  return rows.sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  )
}

export type AttendanceAlertRow = {
  estudianteId: string
  nombre: string
  curso: string
  ausencias: number
  atrasos: number
}

export type AlertPeriod = "semanal" | "mensual" | "trimestral" | "anual"

export const ALERT_PERIOD_DAYS: Record<AlertPeriod, number | null> = {
  semanal: 7,
  mensual: 30,
  trimestral: 90,
  anual: null,
}

export const ALERT_PERIOD_LABELS: Record<AlertPeriod, string> = {
  semanal: "Semanal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  anual: "Anual",
}

type AsistenciaAlertDbRow = {
  estudiante_id: string
  estado: AttendanceRecord["status"]
  curso: string
  estudiantes: {
    nombres: string
    curso: string
  } | null
}

function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - (days - 1))
  return date.toISOString().split("T")[0]
}

export type CourseAttendanceSummary = {
  curso: string
  present: number
  late: number
  absent: number
  total: number
}

export async function fetchAttendanceSummaryByDate(
  fecha: string
): Promise<CourseAttendanceSummary[]> {
  const { data, error } = await supabase
    .from("asistencias")
    .select("estado, curso")
    .eq("fecha", fecha)

  if (error) throw error

  const byCourse = new Map<
    string,
    { present: number; late: number; absent: number }
  >()

  for (const row of data ?? []) {
    const curso = row.curso as string
    const current = byCourse.get(curso) ?? { present: 0, late: 0, absent: 0 }
    if (row.estado === "present") current.present += 1
    else if (row.estado === "late") current.late += 1
    else if (row.estado === "absent") current.absent += 1
    byCourse.set(curso, current)
  }

  return [...byCourse.entries()]
    .map(([curso, counts]) => ({
      curso,
      ...counts,
      total: counts.present + counts.late + counts.absent,
    }))
    .sort((a, b) =>
      a.curso.localeCompare(b.curso, "es", { sensitivity: "base" })
    )
}

export type WeeklyTrackingAlert = {
  estudianteId: string
  nombre: string
  curso: string
  ausencias: number
  atrasos: number
  totalIncidencias: number
}

export type WeekRange = {
  start: string
  end: string
}

function toDateString(date: Date) {
  return date.toISOString().split("T")[0]
}

/** Semana lectiva actual: lunes a viernes de la semana que contiene la fecha de referencia. */
export function getCurrentWeekRange(referenceDate?: string): WeekRange {
  const ref = referenceDate
    ? new Date(`${referenceDate}T12:00:00`)
    : new Date()
  const day = ref.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(ref)
  monday.setDate(ref.getDate() + diffToMonday)

  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  return {
    start: toDateString(monday),
    end: toDateString(friday),
  }
}

const WEEKLY_ALERT_THRESHOLD = 2

export async function fetchWeeklyTrackingAlerts(
  referenceDate?: string
): Promise<WeeklyTrackingAlert[]> {
  const { start, end } = getCurrentWeekRange(referenceDate)

  const { data, error } = await supabase
    .from("asistencias")
    .select(
      `
      estudiante_id,
      estado,
      curso,
      estudiantes (
        nombres,
        curso
      )
    `
    )
    .gte("fecha", start)
    .lte("fecha", end)
    .in("estado", ["absent", "late"])

  if (error) throw error

  const counts = new Map<
    string,
    {
      nombre: string
      curso: string
      ausencias: number
      atrasos: number
    }
  >()

  for (const row of (data ?? []) as unknown as AsistenciaAlertDbRow[]) {
    const current = counts.get(row.estudiante_id) ?? {
      nombre: row.estudiantes?.nombres ?? "Sin nombre",
      curso: row.curso || row.estudiantes?.curso || "Sin curso",
      ausencias: 0,
      atrasos: 0,
    }

    if (row.estado === "absent") current.ausencias += 1
    if (row.estado === "late") current.atrasos += 1

    counts.set(row.estudiante_id, current)
  }

  return [...counts.entries()]
    .map(([estudianteId, stats]) => ({
      estudianteId,
      ...stats,
      totalIncidencias: stats.ausencias + stats.atrasos,
    }))
    .filter((row) => row.totalIncidencias >= WEEKLY_ALERT_THRESHOLD)
    .sort((a, b) => {
      if (b.totalIncidencias !== a.totalIncidencias) {
        return b.totalIncidencias - a.totalIncidencias
      }
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    })
}

export async function fetchAttendanceAlerts(
  curso: string,
  period: AlertPeriod
): Promise<AttendanceAlertRow[]> {
  const endDate = new Date().toISOString().split("T")[0]

  let query = supabase
    .from("asistencias")
    .select(
      `
      estudiante_id,
      estado,
      curso,
      estudiantes (
        nombres,
        curso
      )
    `
    )
    .eq("curso", curso)
    .lte("fecha", endDate)
    .in("estado", ["absent", "late"])

  if (period !== "anual") {
    const days = ALERT_PERIOD_DAYS[period]!
    const startDate = getDateDaysAgo(days)
    query = query.gte("fecha", startDate)
  }

  const { data, error } = await query

  if (error) throw error

  const counts = new Map<
    string,
    {
      nombre: string
      curso: string
      ausencias: number
      atrasos: number
    }
  >()

  for (const row of (data ?? []) as unknown as AsistenciaAlertDbRow[]) {
    const current = counts.get(row.estudiante_id) ?? {
      nombre: row.estudiantes?.nombres ?? "Sin nombre",
      curso: row.curso || row.estudiantes?.curso || curso,
      ausencias: 0,
      atrasos: 0,
    }

    if (row.estado === "absent") current.ausencias += 1
    if (row.estado === "late") current.atrasos += 1

    counts.set(row.estudiante_id, current)
  }

  return [...counts.entries()]
    .map(([estudianteId, stats]) => ({
      estudianteId,
      ...stats,
    }))
    .filter((row) => row.ausencias > 0 || row.atrasos > 0)
    .sort((a, b) => {
      const totalA = a.ausencias + a.atrasos
      const totalB = b.ausencias + b.atrasos
      if (totalB !== totalA) return totalB - totalA
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    })
}
