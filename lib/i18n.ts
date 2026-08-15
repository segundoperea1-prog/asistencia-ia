export const translations = {
    es: {
      present: "Presente",
      absent: "Ausente",
      late: "Atraso",
      save: "Guardar",
      saveAttendance: "Guardar Asistencia del Día",
      students: "Estudiantes",
      settings: "Configuración",
      reports: "Reportes",
    },
    en: {
      present: "Present",
      absent: "Absent",
      late: "Late",
      save: "Save",
      saveAttendance: "Save Daily Attendance",
      students: "Students",
      settings: "Settings",
      reports: "Reports",
    },
    fr: {
      present: "Présent",
      absent: "Absent",
      late: "En retard",
      save: "Enregistrer",
      saveAttendance: "Enregistrer la présence",
      students: "Étudiants",
      settings: "Paramètres",
      reports: "Rapports",
    }
  }
  
  export type Language = keyof typeof translations;