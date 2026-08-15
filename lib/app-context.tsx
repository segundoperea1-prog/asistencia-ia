"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import type { SubjectLabel } from "@/lib/subjects"
import { createDefaultSubjects } from "@/lib/subjects"

export type Student = {
  id: string
  surnames: string
  givenNames: string
  photo: string
  subjects: SubjectLabel[]
  parallel: string
  whatsappNumber: string
  parentName: string
}

export type AttendanceRecord = {
  id: string
  studentId: string
  date: string
  status: "present" | "absent" | "late"
  observation?: string
}

export type Course = {
  id: string
  name: string
  grade: string
}

type AppContextType = {
  isAuthenticated: boolean
  setIsAuthenticated: (value: boolean) => void
  students: Student[]
  setStudents: (students: Student[]) => void
  addStudent: (student: Student) => void
  removeStudent: (id: string) => void
  courses: Course[]
  selectedCourse: string
  setSelectedCourse: (courseId: string) => void
  attendanceRecords: AttendanceRecord[]
  addAttendanceRecord: (record: AttendanceRecord) => void
  periodStart: string
  periodEnd: string
  setPeriodStart: (date: string) => void
  setPeriodEnd: (date: string) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

const initialCourses: Course[] = [
  { id: "1", name: "1er Grado - A", grade: "1" },
  { id: "2", name: "2do Grado - A", grade: "2" },
  { id: "3", name: "3er Grado - A", grade: "3" },
  { id: "4", name: "4to Grado - A", grade: "4" },
  { id: "5", name: "5to Grado - A", grade: "5" },
  { id: "6", name: "6to Grado - A", grade: "6" },
]

const defaultSubjects = createDefaultSubjects()

const initialStudents: Student[] = [
  // Biología
  { id: "bio-1", surnames: "Mendoza Vera", givenNames: "María Gabriela", photo: "", subjects: defaultSubjects, parallel: "1ro A", whatsappNumber: "593991234501", parentName: "Patricia Vera" },
  { id: "bio-2", surnames: "Chávez Pino", givenNames: "Sebastián Andrés", photo: "", subjects: defaultSubjects, parallel: "1ro A", whatsappNumber: "593992345602", parentName: "Roberto Chávez" },
  { id: "bio-3", surnames: "Torres Núñez", givenNames: "Valentina Isabel", photo: "", subjects: defaultSubjects, parallel: "1ro B", whatsappNumber: "593993456703", parentName: "Lucía Núñez" },
  { id: "bio-4", surnames: "Salazar Ruiz", givenNames: "Diego Alejandro", photo: "", subjects: defaultSubjects, parallel: "2do A", whatsappNumber: "593994567804", parentName: "Fernando Salazar" },
  { id: "bio-5", surnames: "Herrera Castro", givenNames: "Camila Sofía", photo: "", subjects: defaultSubjects, parallel: "2do B", whatsappNumber: "593995678905", parentName: "Andrea Castro" },
  { id: "bio-6", surnames: "Villacís Mora", givenNames: "Mateo Josué", photo: "", subjects: defaultSubjects, parallel: "3ro A", whatsappNumber: "593996789006", parentName: "Jorge Villacís" },
  { id: "bio-7", surnames: "Aguirre León", givenNames: "Isabella Fernanda", photo: "", subjects: defaultSubjects, parallel: "4to A", whatsappNumber: "593997890107", parentName: "Mónica León" },
  // Emprendimiento
  { id: "emp-1", surnames: "Pérez Rodríguez", givenNames: "Juan Carlos", photo: "", subjects: defaultSubjects, parallel: "1ro A", whatsappNumber: "593998901208", parentName: "Luis Pérez" },
  { id: "emp-2", surnames: "Martínez Silva", givenNames: "Ana Lucía", photo: "", subjects: defaultSubjects, parallel: "2do A", whatsappNumber: "593999012309", parentName: "Rosa Silva" },
  { id: "emp-3", surnames: "Sánchez Torres", givenNames: "Carlos Eduardo", photo: "", subjects: defaultSubjects, parallel: "2do B", whatsappNumber: "593990123410", parentName: "Pedro Sánchez" },
  { id: "emp-4", surnames: "Fernández Ruiz", givenNames: "Lucía Alejandra", photo: "", subjects: defaultSubjects, parallel: "3ro A", whatsappNumber: "593991234511", parentName: "María Ruiz" },
  { id: "emp-5", surnames: "Guzmán Ortiz", givenNames: "Andrés Felipe", photo: "", subjects: defaultSubjects, parallel: "3ro B", whatsappNumber: "593992345612", parentName: "Claudia Ortiz" },
  { id: "emp-6", surnames: "Rivadeneira Paz", givenNames: "Daniela Paola", photo: "", subjects: defaultSubjects, parallel: "4to A", whatsappNumber: "593993456713", parentName: "Héctor Rivadeneira" },
  // Computación
  { id: "gc-1", surnames: "Delgado Arias", givenNames: "Santiago Xavier", photo: "", subjects: defaultSubjects, parallel: "1ro A", whatsappNumber: "593994567814", parentName: "Verónica Arias" },
  { id: "gc-2", surnames: "Cedeño Bravo", givenNames: "Natalia Estefanía", photo: "", subjects: defaultSubjects, parallel: "1ro B", whatsappNumber: "593995678915", parentName: "Ricardo Cedeño" },
  { id: "gc-3", surnames: "Zambrano Viteri", givenNames: "Emilio Rafael", photo: "", subjects: defaultSubjects, parallel: "2do A", whatsappNumber: "593996789016", parentName: "Silvia Viteri" },
  { id: "gc-4", surnames: "Reyes Paredes", givenNames: "Gabriela Antonella", photo: "", subjects: defaultSubjects, parallel: "3ro A", whatsappNumber: "593997890117", parentName: "Miguel Reyes" },
  { id: "gc-5", surnames: "Palacios Jaramillo", givenNames: "Tomás Ignacio", photo: "", subjects: defaultSubjects, parallel: "3ro B", whatsappNumber: "593998901218", parentName: "Elena Jaramillo" },
  { id: "gc-6", surnames: "Alcívar Montenegro", givenNames: "Sofía Michelle", photo: "", subjects: defaultSubjects, parallel: "4to A", whatsappNumber: "593999012319", parentName: "Francisco Alcívar" },
  { id: "gc-7", surnames: "Intriago Mero", givenNames: "Benjamín Nicolás", photo: "", subjects: defaultSubjects, parallel: "5to A", whatsappNumber: "593990123420", parentName: "Gladys Mero" },
]

function getTodayDate() {
  return new Date().toISOString().split("T")[0]
}

const initialAttendanceRecords: AttendanceRecord[] = [
  { id: "bio-1-today", studentId: "bio-1", date: getTodayDate(), status: "present" },
  { id: "bio-2-today", studentId: "bio-2", date: getTodayDate(), status: "present" },
  { id: "bio-4-today", studentId: "bio-4", date: getTodayDate(), status: "late" },
  { id: "bio-5-today", studentId: "bio-5", date: getTodayDate(), status: "absent" },
  { id: "emp-1-today", studentId: "emp-1", date: getTodayDate(), status: "present" },
  { id: "emp-3-today", studentId: "emp-3", date: getTodayDate(), status: "absent" },
  { id: "gc-1-today", studentId: "gc-1", date: getTodayDate(), status: "present" },
  { id: "gc-4-today", studentId: "gc-4", date: getTodayDate(), status: "late" },
]

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [students, setStudents] = useState<Student[]>(initialStudents)
  const [courses] = useState<Course[]>(initialCourses)
  const [selectedCourse, setSelectedCourse] = useState<string>("1")
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(initialAttendanceRecords)
  const [periodStart, setPeriodStart] = useState("2024-09-01")
  const [periodEnd, setPeriodEnd] = useState("2025-07-15")

  const addStudent = (student: Student) => {
    setStudents((prev) => [...prev, student])
  }

  const removeStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id))
  }

  const addAttendanceRecord = (record: AttendanceRecord) => {
    setAttendanceRecords((prev) => {
      const existing = prev.findIndex(
        (r) => r.studentId === record.studentId && r.date === record.date
      )
      if (existing !== -1) {
        const updated = [...prev]
        updated[existing] = record
        return updated
      }
      return [...prev, record]
    })
  }

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        students,
        setStudents,
        addStudent,
        removeStudent,
        courses,
        selectedCourse,
        setSelectedCourse,
        attendanceRecords,
        addAttendanceRecord,
        periodStart,
        periodEnd,
        setPeriodStart,
        setPeriodEnd,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}
