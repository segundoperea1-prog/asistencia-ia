export const INSTITUTION_NAME =
  "UNIDAD EDUCATIVA FISCAL MODESTO ENRIQUE SUÁREZ PIMENTEL"

export const DEFAULT_PARALLEL = "1ro de Ciencias"

export const FIRST_BT_PARALLEL = "1ro BT"

export const SECOND_BT_PARALLEL = "2do BT"

export const THIRD_BT_PARALLEL = "3ro BT"

/** Las tres materias que cursan todos los estudiantes de 1ro de Ciencias */
export const ALL_STUDENT_SUBJECTS = [
  "Biología",
  "Emprendimiento y Gestión",
  "Computación",
] as const

export type SubjectLabel = (typeof ALL_STUDENT_SUBJECTS)[number]

export function createDefaultSubjects(): SubjectLabel[] {
  return [...ALL_STUDENT_SUBJECTS]
}

export const SECOND_PARALLEL = "2do Ciencias"

export const THIRD_PARALLEL = "3ro Ciencias"

function parseParallelGrade(parallel: string) {
  const lower = parallel.toLowerCase()
  const gradeMatch = parallel.match(/\b(1ro|2do|3ro|4to|5to|6to)\b/i)
  return {
    isCiencias: lower.includes("ciencias"),
    isBt: /\bbt\b/i.test(parallel) || lower.includes("bt"),
    grade: gradeMatch?.[1].toLowerCase() ?? null,
  }
}

/** Materias que cursa un estudiante según su paralelo (Ciencias / BT). */
export function getSubjectsForParallel(parallel: string): SubjectLabel[] {
  const { isCiencias, isBt, grade } = parseParallelGrade(parallel)
  const base: SubjectLabel[] = ["Biología", "Emprendimiento y Gestión"]

  if (!isCiencias && !isBt) {
    return [...ALL_STUDENT_SUBJECTS]
  }

  if (isCiencias && (grade === "1ro" || grade === "2do")) {
    return [...base, "Computación"]
  }

  return base
}
