import type { SubjectLabel } from "@/lib/subjects"
import { INSTITUTION_NAME } from "@/lib/subjects"

export type StudentRecord = {
  id: string
  surnames: string
  givenNames: string
  /** URL opcional de foto real (legacy / compatibilidad) */
  photoUrl?: string
  /** URLs públicas de fotos de rostro (multi-ángulo) */
  fotosRostro?: string[]
  subjects: SubjectLabel[]
  parallel: string
  /** Teléfono del representante (WhatsApp) */
  whatsappNumber: string
  /** Teléfono del representante, si difiere de whatsappNumber */
  parentPhone?: string
  /** Teléfono del estudiante (respaldo si no hay teléfono del representante) */
  studentPhone?: string
  parentName: string
}

export function formatStudentName(
  student: Pick<StudentRecord, "surnames" | "givenNames">
) {
  return `${student.surnames}, ${student.givenNames}`
}

export function getStudentInitials(
  student: Pick<StudentRecord, "surnames" | "givenNames">
) {
  const parts = [...student.surnames.split(" "), ...student.givenNames.split(" ")]
    .filter(Boolean)
    .slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase()).join("")
}

export function buildWhatsAppMessage(
  student: Pick<StudentRecord, "surnames" | "givenNames">
) {
  const fullName = formatStudentName(student)
  return (
    `${INSTITUTION_NAME}\n` +
    `Estimado representante, le saluda el Profe Segundo. Le escribo por motivos de su representado(a) ${fullName}`
  )
}

/** Teléfono del representante; si no existe, usa el del estudiante. */
export function getAttendanceContactPhone(
  student: Pick<StudentRecord, "parentPhone" | "whatsappNumber" | "studentPhone">
) {
  const representative =
    student.parentPhone?.trim() || student.whatsappNumber?.trim()
  if (representative) return representative
  return student.studentPhone?.trim() || ""
}

export function buildAbsentAttendanceMessage(
  student: Pick<StudentRecord, "surnames" | "givenNames">
) {
  return `UNIDAD EDUCATIVA FISCAL MODESTO ENRIQUE SUÁREZ PIMENTEL. Estimado representante, le saluda el Profe Segundo. Le informo que su representado(a) ${formatStudentName(student).toUpperCase()} NO ASISTIÓ a clases el día de hoy.`
}

export function buildLateAttendanceMessage(
  student: Pick<StudentRecord, "surnames" | "givenNames">
) {
  return `UNIDAD EDUCATIVA FISCAL MODESTO ENRIQUE SUÁREZ PIMENTEL. Estimado representante, le saluda el Profe Segundo. Le informo que su representado(a) ${formatStudentName(student).toUpperCase()} LLEGÓ ATRASADO(A) a clases el día de hoy.`
}

/** Normaliza teléfono para wa.me: sin espacios; 0 inicial → prefijo 593. */
export function normalizeWhatsAppPhone(phone: string) {
  const withoutSpaces = phone.replace(/\s/g, "")
  const digits = withoutSpaces.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("0")) {
    return `593${digits.slice(1)}`
  }
  return digits
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const digits = normalizeWhatsAppPhone(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function studentMatchesSearch(
  student: Pick<StudentRecord, "surnames" | "givenNames" | "parentName">,
  query: string
) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const haystack = [
    student.surnames,
    student.givenNames,
    formatStudentName(student),
    student.parentName,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(normalized)
}

export function compareStudents(
  a: Pick<StudentRecord, "surnames" | "givenNames">,
  b: Pick<StudentRecord, "surnames" | "givenNames">
) {
  const bySurname = a.surnames.localeCompare(b.surnames, "es")
  if (bySurname !== 0) return bySurname
  return a.givenNames.localeCompare(b.givenNames, "es")
}

export function parseFullName(fullName: string): {
  surnames: string
  givenNames: string
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 2) {
    return {
      surnames: parts[0] ?? "",
      givenNames: parts.slice(1).join(" ") || parts[0] || "",
    }
  }
  return {
    surnames: parts.slice(0, -2).join(" "),
    givenNames: parts.slice(-2).join(" "),
  }
}

export function sortStudents(students: StudentRecord[]) {
  return [...students].sort(compareStudents)
}
