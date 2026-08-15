"use client"

import { useEffect, useState, useMemo } from "react"
import { Camera, Printer, MessageCircle, ScanLine, X, Users, Plus, Pencil, Upload, Save, Search, Megaphone, CheckCircle, Copy, FileSpreadsheet, Award, BookOpen, Paperclip, Cloud, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QRCodeSVG } from "qrcode.react"
import { Scanner } from '@yudiel/react-qr-scanner'
import { loadInstitutionSettings } from "@/lib/institution-settings"

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby6TkL7QdmKRAunsHW5416ySrK13xuYtAdrZVnyDDIni2jeKf5EWaBCcRLgcTSh4lI/exec";

type ActividadNube = {
  colIndex: number;
  tituloCompleto: string;
  alumnos: { nombre: string; nota: string }[];
}

type MateriaNube = {
  nombreHoja: string;
  nombreMateria: string;
  actividades: ActividadNube[];
}

type CursoNube = {
  curso: string;
  materias: MateriaNube[];
}

function normalizarTexto(texto: string) {
  if (!texto) return "";
  return texto.toString()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^\w\s]/g, "") 
    .replace(/\s+/g, " ") 
    .trim();
}

function coincidenNombres(nombreDB: string, nombreExcel: string) {
  if (!nombreDB || !nombreExcel) return false;
  const normDB = normalizarTexto(nombreDB);
  const normEx = normalizarTexto(nombreExcel);

  if (normDB === normEx || normDB.includes(normEx) || normEx.includes(normDB)) return true;

  const wordsDB = normDB.split(" ").filter(w => w.length > 2);
  const wordsEx = normEx.split(" ").filter(w => w.length > 2);

  if (wordsDB.length === 0 || wordsEx.length === 0) return false;

  const isDbShorter = wordsDB.length <= wordsEx.length;
  const shortest = isDbShorter ? wordsDB : wordsEx;
  const longestStr = isDbShorter ? normEx : normDB;

  const todasCoinciden = shortest.every(w => longestStr.includes(w));
  if (todasCoinciden) return true;

  let coincidencias = 0;
  for (const w of shortest) {
    if (longestStr.includes(w)) coincidencias++;
  }
  
  if (shortest.length >= 3 && coincidencias >= shortest.length - 1) return true;

  return false;
}

function formatearTituloActividad(tituloCompleto: string) {
  if (!tituloCompleto) return "";

  const partes = tituloCompleto.split(" - ");
  if (partes.length >= 2) {
    const actividad = partes[0].trim();
    const textoFechaLimpio = partes.slice(1).join(" - ").replace(/\s*\(.*\)\s*/g, "").trim();

    const fechaObj = new Date(textoFechaLimpio);
    if (!isNaN(fechaObj.getTime())) {
      const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
      const fechaEs = fechaObj.toLocaleDateString('es-ES', opciones);
      const fechaCapitalizada = fechaEs.charAt(0).toUpperCase() + fechaEs.slice(1);
      return `${actividad} - ${fechaCapitalizada}`;
    }
  }

  const textoLimpio = tituloCompleto.replace(/\s*\(.*\)\s*/g, "").trim();
  const fechaObj = new Date(textoLimpio);
  if (!isNaN(fechaObj.getTime())) {
    const fechaEs = fechaObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return fechaEs.charAt(0).toUpperCase() + fechaEs.slice(1);
  }

  return tituloCompleto;
}

async function subirFotoASupabase(base64String: string) {
  if (!base64String.startsWith("data:image")) {
    return base64String;
  }

  try {
    const response = await fetch(base64String);
    const blob = await response.blob();
    const nombreArchivo = `foto_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;

    const { error } = await supabase.storage
      .from('fotos_estudiantes')
      .upload(nombreArchivo, blob, { contentType: 'image/jpeg', upsert: false });

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from('fotos_estudiantes')
      .getPublicUrl(nombreArchivo);

    return publicData.publicUrl;
  } catch (error) {
    console.error("Error subiendo imagen a Storage:", error);
    throw new Error("No se pudo subir la foto al servidor.");
  }
}

export function StudentsView() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("Todos");
  
  const [estatusAlerta, setEstatusAlerta] = useState<Record<string, string>>({});
  const [escaneandoQR, setEscaneandoQR] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [ultimoEscaneado, setUltimoEscaneado] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("UNIDAD EDUCATIVA FISCAL MODESTO ENRIQUE SUÁREZ PIMENTEL.\n\nEstimados padres de familia:\n");

  const [isGradesModalOpen, setIsGradesModalOpen] = useState(false);
  const [cargandoNube, setCargandoNube] = useState(false);
  const [datosNube, setDatosNube] = useState<CursoNube[]>([]);
  
  const [indiceCursoSeleccionado, setIndiceCursoSeleccionado] = useState<number>(0);
  const [indiceMateriaSeleccionada, setIndiceMateriaSeleccionada] = useState<number>(0);
  const [columnaSeleccionada, setColumnaSeleccionada] = useState<number | null>(null);

  const [notificadosIndividuales, setNotificadosIndividuales] = useState<Set<string>>(new Set());
  const [notificadosNotas, setNotificadosNotas] = useState<Set<string>>(new Set());
  const [ocultarEnviados, setOcultarEnviados] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const [nombre, setNombre] = useState("");
  const [curso, setCurso] = useState("1ro Ciencias");
  const [telRepresentante, setTelRepresentante] = useState("");
  const [telEstudiante, setTelEstudiante] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");

  const [settings, setSettings] = useState(() => loadInstitutionSettings());
  const [fechaActual, setFechaActual] = useState("Cargando fecha...");

  const COURSE_ORDER: Record<string, number> = {
    "1ro Ciencias": 1, "2do Ciencias": 2, "3ro Ciencias": 3,
    "1ro Técnico": 4, "2do Técnico": 5, "3ro Técnico": 6,
  };

  useEffect(() => {
    const date = new Date();
    const str = date.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    setFechaActual(str.charAt(0).toUpperCase() + str.slice(1));

    setSettings(loadInstitutionSettings());
    async function loadStudentsAndAttendance() {
      try {
        setLoading(true);
        const hoyISO = new Date().toISOString().split('T')[0];
        
        const [studentsRes, asistenciaRes] = await Promise.all([
          supabase.from("estudiantes").select("*"),
          supabase.from("asistencias").select("*").eq("fecha", hoyISO)
        ]);

        setStudents(studentsRes.data || []);

        if (!asistenciaRes.error && asistenciaRes.data) {
          const mapaAsistencia: Record<string, string> = {};
          asistenciaRes.data.forEach((registro: any) => {
            let estadoPantalla = "";
            if (registro.estado === "present") estadoPantalla = "Presente";
            else if (registro.estado === "late") estadoPantalla = "Atrasado";
            else if (registro.estado === "absent") estadoPantalla = "Ausente";
            
            if (estadoPantalla) {
              mapaAsistencia[registro.estudiante_id] = estadoPantalla;
            }
          });
          setEstatusAlerta(mapaAsistencia);
        }
      } catch (err) {
        console.error("Error al cargar datos:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStudentsAndAttendance();
  }, []);

  const sendWhatsApp = (estudiante: any, status: string) => {
    const telefonoParaEnviar = estudiante?.telefono_representante || estudiante?.telefono_estudiante;
    if (!telefonoParaEnviar) {
      alert("Este estudiante no tiene ningún número registrado en su perfil.");
      return;
    }
    const formattedPhone = String(telefonoParaEnviar).replace(/\D/g, "");
    const instName = settings.institutionName?.toUpperCase() || "UNIDAD EDUCATIVA FISCAL MODESTO ENRIQUE SUÁREZ PIMENTEL";
    const docName = settings.teacherName || "El Docente";

    const message = `${instName}\n\nEstimado representante, le informamos que el estudiante ${estudiante.nombres} ha sido marcado como: *${status}* el día de hoy.\n\nAtentamente,\n${docName}`;
    
    window.open(`https://wa.me/593${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
    setNotificadosIndividuales(prev => new Set(prev).add(estudiante.id));
  };

  const cargarNotasDesdeNube = async () => {
    try {
      setCargandoNube(true);
      setIsGradesModalOpen(true);

      const response = await fetch(GOOGLE_SCRIPT_URL);
      if (!response.ok) throw new Error("No se pudo conectar con el servidor de Google Drive.");

      const data: CursoNube[] = await response.json();
      if (!data || data.length === 0) {
        alert("No se encontraron archivos válidos en la carpeta de Google Drive.");
        setIsGradesModalOpen(false);
        return;
      }

      setDatosNube(data);
      setIndiceCursoSeleccionado(0);
      setIndiceMateriaSeleccionada(0);
      setColumnaSeleccionada(data[0]?.materias[0]?.actividades[0]?.colIndex || null);
    } catch (err: any) {
      alert("Error al cargar notas desde Google Drive: " + err.message);
      setIsGradesModalOpen(false);
    } finally {
      setCargandoNube(false);
    }
  };

  const cambiarCursoNube = (idxCurso: number) => {
    setIndiceCursoSeleccionado(idxCurso);
    setIndiceMateriaSeleccionada(0);
    setColumnaSeleccionada(datosNube[idxCurso]?.materias[0]?.actividades[0]?.colIndex || null);
  };

  const cambiarMateriaNube = (idxMateria: number) => {
    setIndiceMateriaSeleccionada(idxMateria);
    setColumnaSeleccionada(datosNube[indiceCursoSeleccionado]?.materias[idxMateria]?.actividades[0]?.colIndex || null);
  };

  const printCredential = (s: any) => {
    const printWindow = window.open('', '_blank');
    const qrSvg = document.getElementById(`qr-hidden-${s.id}`)?.innerHTML;
    printWindow?.document.write(`
      <html>
        <head><title>Credencial - ${s.nombres}</title>
          <style>body { font-family: sans-serif; text-align: center; padding: 40px; } .card { border: 2px solid #000; border-radius: 15px; padding: 20px; width: 350px; margin: 0 auto; } .school-name { font-weight: bold; font-size: 18px; color: #1e40af; margin-bottom: 10px; } .student-name { font-size: 20px; margin: 15px 0; border-top: 1px solid #ccc; padding-top: 10px; } .course { color: #666; font-size: 16px; margin-bottom: 20px; } .qr-zone svg { width: 150px; height: 150px; }</style>
        </head>
        <body onload="window.print()">
          <div class="card">
            <div class="school-name">UNIDAD EDUCATIVA FISCAL<br>MODESTO ENRIQUE SUÁREZ PIMENTEL</div>
            <div class="student-name">${s.nombres}</div>
            <div class="course">${s.curso}</div>
            <div class="qr-zone">${qrSvg}</div>
            <p style="font-size: 10px; margin-top: 20px;">Credencial Estudiantil Oficial</p>
          </div>
        </body>
      </html>
    `);
    printWindow?.document.close();
  };

  const procesarCodigoQR = (codigo: string) => {
    if (codigo === ultimoEscaneado) return;
    const estudiante = students.find(s => s.id === codigo);
    if (estudiante) {
      setUltimoEscaneado(estudiante.id);
      setEstatusAlerta(prev => ({...prev, [estudiante.id]: "Presente"}));
      setMensajeExito(`¡${estudiante.nombres} marcado PRESENTE!`);
      setTimeout(() => { setMensajeExito(""); setUltimoEscaneado(""); }, 2500);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * (MAX_WIDTH / img.width);
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setFotoUrl(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setNombre(""); setCurso("1ro Ciencias"); setTelRepresentante(""); setTelEstudiante(""); setFotoUrl("");
    setIsAddModalOpen(true);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalFotoUrl = fotoUrl ? await subirFotoASupabase(fotoUrl) : "";
      const newStudent = { nombres: nombre, curso, telefono_representante: telRepresentante, telefono_estudiante: telEstudiante, fotos_rostro: finalFotoUrl ? [finalFotoUrl] : [] };
      const { data, error } = await supabase.from("estudiantes").insert([newStudent]).select();
      if (error) throw error;
      if (data) setStudents(prev => [...prev, data[0]]);
      setIsAddModalOpen(false);
      alert("Estudiante agregado correctamente");
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const openEditModal = (student: any) => {
    setSelectedStudent(student);
    setNombre(student.nombres || ""); setCurso(student.curso || "1ro Ciencias"); setTelRepresentante(student.telefono_representante || ""); setTelEstudiante(student.telefono_estudiante || ""); setFotoUrl(student.fotos_rostro?.[0] || "");
    setIsEditModalOpen(true);
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
      let finalFotoUrl = fotoUrl ? await subirFotoASupabase(fotoUrl) : "";
      const updatedData = { nombres: nombre, curso, telefono_representante: telRepresentante, telefono_estudiante: telEstudiante, fotos_rostro: finalFotoUrl ? [finalFotoUrl] : [] };
      const { error } = await supabase.from("estudiantes").update(updatedData).eq("id", selectedStudent.id);
      if (error) throw error;
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, ...updatedData } : s));
      setIsEditModalOpen(false); setSelectedStudent(null);
      alert("Estudiante actualizado correctamente");
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("¿Desea eliminar a este estudiante?")) return;
    try {
      const { error } = await supabase.from("estudiantes").delete().eq("id", id);
      if (error) throw error;
      setStudents(prev => prev.filter(s => s.id !== id));
      setIsEditModalOpen(false); setSelectedStudent(null);
      alert("Estudiante eliminado");
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const finalizarAsistenciaJornada = async () => {
    const hoyISO = new Date().toISOString().split('T')[0];
    if (!confirm(`¿Guardar asistencia de la fecha: ${fechaActual}?`)) return;

    const recordsToInsert = Object.keys(estatusAlerta).map(estudianteId => {
      let estadoDB = "present";
      if (estatusAlerta[estudianteId] === "Atrasado") estadoDB = "late";
      else if (estatusAlerta[estudianteId] === "Ausente") estadoDB = "absent";
      const sInfo = students.find(s => s.id === estudianteId);
      return { estudiante_id: estudianteId, fecha: hoyISO, estado: estadoDB, curso: sInfo?.curso || "Sin curso" };
    });

    if (recordsToInsert.length === 0) {
      alert("No ha marcado asistencia de ningún alumno.");
      return;
    }

    try {
      const studentIds = recordsToInsert.map(r => r.estudiante_id);
      await supabase.from("asistencias").delete().eq("fecha", hoyISO).in("estudiante_id", studentIds);
      const { error } = await supabase.from("asistencias").insert(recordsToInsert);
      if (error) throw error;
      alert("¡Asistencia guardada con éxito!");
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const filteredStudents = useMemo(() => {
    let listaFiltro = [...students];
    if (ocultarEnviados) listaFiltro = listaFiltro.filter(s => !notificadosIndividuales.has(s.id));
    return listaFiltro
      .filter(s => (filterCourse === "Todos" || s.curso === filterCourse) && (s.nombres?.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => (COURSE_ORDER[a.curso] || 99) - (COURSE_ORDER[b.curso] || 99) || (a.nombres || "").localeCompare(b.nombres || ""));
  }, [students, search, filterCourse, ocultarEnviados, notificadosIndividuales]);

  const cursoActualObj = datosNube[indiceCursoSeleccionado] || null;
  const materiaActualObj = cursoActualObj?.materias[indiceMateriaSeleccionada] || null;
  const actividadActualObj = materiaActualObj?.actividades.find(a => a.colIndex === columnaSeleccionada) || null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 border-solid"></div>
        <p className="text-lg font-bold text-slate-600">Cargando Panel...</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6 bg-slate-50 min-h-screen relative overflow-x-hidden">
      
      {escaneandoQR && (
        <div className="fixed inset-0 z-[999] bg-slate-900/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
            <div className="p-4 bg-slate-100 flex justify-between items-center border-b">
              <h3 className="text-xl font-bold text-slate-800">Escáner de Credenciales</h3>
              <Button variant="destructive" onClick={() => setEscaneandoQR(false)}>
                <X className="mr-2 h-4 w-4"/> Cerrar
              </Button>
            </div>
            <div className="relative w-full bg-black">
              <Scanner onScan={(result: any) => { if (result && result.length > 0) procesarCodigoQR(result[0].rawValue); }} />
            </div>
            <div className="p-6 h-32 flex items-center justify-center text-center bg-white">
              {mensajeExito ? (
                <div className="bg-green-100 text-green-800 p-4 rounded-xl font-bold text-lg w-full">{mensajeExito}</div>
              ) : (
                <p className="text-slate-500 text-lg font-medium">Apunte la cámara al código QR.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUBE NOTAS */}
      {isGradesModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="p-4 sm:p-6 bg-purple-600 text-white flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Cloud className="h-6 w-6"/> Central de Calificaciones Nube (Google Drive)
              </h3>
              <Button variant="ghost" size="icon" className="text-white hover:bg-purple-700" onClick={() => setIsGradesModalOpen(false)}>
                <X className="h-5 w-5"/>
              </Button>
            </div>

            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6">
              {cargandoNube ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <RefreshCw className="animate-spin h-12 w-12 text-purple-600"/>
                  <p className="text-base font-bold text-slate-700">Descargando notas desde Google Drive...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="text-xs font-bold text-purple-800 uppercase">🏫 Archivo / Curso:</label>
                      <select className="w-full border-2 border-purple-300 rounded-lg h-10 px-3 bg-white font-bold text-slate-800 mt-1 text-xs" value={indiceCursoSeleccionado} onChange={(e) => cambiarCursoNube(Number(e.target.value))}>
                        {datosNube.map((c, idx) => <option key={idx} value={idx}>{c.curso}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-purple-700 uppercase">📚 Materia:</label>
                      <select className="w-full border border-slate-300 rounded-lg h-10 px-3 bg-white font-bold text-slate-800 mt-1 text-xs" value={indiceMateriaSeleccionada} onChange={(e) => cambiarMateriaNube(Number(e.target.value))}>
                        {cursoActualObj?.materias.map((m, idx) => <option key={idx} value={idx}>{m.nombreMateria}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">📝 Tarea:</label>
                      <select className="w-full border border-slate-300 rounded-lg h-10 px-3 bg-white font-bold text-slate-800 mt-1 text-xs" value={columnaSeleccionada || ""} onChange={(e) => setColumnaSeleccionada(Number(e.target.value))}>
                        {materiaActualObj?.actividades.map(a => <option key={a.colIndex} value={a.colIndex}>{formatearTituloActividad(a.tituloCompleto)}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 p-3 border-b flex justify-between items-center">
                      <span className="font-bold text-sm text-slate-700">Materia: <span className="text-purple-700">{materiaActualObj?.nombreMateria}</span></span>
                      <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full">{actividadActualObj?.alumnos.length || 0} Alumnos</span>
                    </div>
                    <ul className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                      {!actividadActualObj || actividadActualObj.alumnos.length === 0 ? (
                        <li className="p-6 text-center text-slate-500">No hay estudiantes cargados.</li>
                      ) : (
                        actividadActualObj.alumnos.map((item, idx) => {
                          const estudianteDB = students.find(s => coincidenNombres(s.nombres, item.nombre));
                          const claveNotif = `${item.nombre}_${indiceCursoSeleccionado}_${indiceMateriaSeleccionada}_${columnaSeleccionada}`;
                          const yaNotificadoNota = notificadosNotas.has(claveNotif);
                          const telefonoParaEnviar = estudianteDB?.telefono_representante || estudianteDB?.telefono_estudiante;
                          const mensajeNota = `UNIDAD EDUCATIVA FISCAL MODESTO ENRIQUE SUÁREZ PIMENTEL\n\nEstimado representante, calificación de *${item.nombre}*:\n\n📚 *Materia:* ${materiaActualObj?.nombreMateria}\n📝 *Actividad:* ${formatearTituloActividad(actividadActualObj?.tituloCompleto || "")}\n📊 *Calificación:* ${item.nota} / 10\n\nAtentamente,\n${settings.teacherName || "El Docente"}`;

                          return (
                            <li key={idx} className={`p-3 flex justify-between items-center ${yaNotificadoNota ? 'bg-slate-50 opacity-70' : 'hover:bg-slate-50'}`}>
                              <div className="min-w-0 flex-1 pr-4">
                                <p className="font-bold text-sm truncate">{item.nombre}</p>
                                <p className="text-xs text-slate-500">Nota: <span className="text-purple-700 font-bold">{item.nota}</span> • Rep: <span className="font-mono">{telefonoParaEnviar || 'Sin número'}</span></p>
                              </div>
                              <Button size="sm" className={yaNotificadoNota ? 'bg-slate-200 text-slate-500' : 'bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold'} disabled={!telefonoParaEnviar || yaNotificadoNota} onClick={() => {
                                if (telefonoParaEnviar) {
                                  window.open(`https://wa.me/593${String(telefonoParaEnviar).replace(/\D/g, "")}?text=${encodeURIComponent(mensajeNota)}`, '_blank');
                                  setNotificadosNotas(prev => new Set(prev).add(claveNotif));
                                }
                              }}>
                                {yaNotificadoNota ? <><CheckCircle className="w-4 h-4 mr-1"/> Notificado</> : <><MessageCircle className="w-4 h-4 mr-1"/> Enviar Nota</>}
                              </Button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 shrink-0">
              <Button className="w-full bg-slate-800 text-white font-bold" onClick={() => setIsGradesModalOpen(false)}>Cerrar Módulo Nube</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MENSAJE MANUAL */}
      {isNotifyModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="p-4 bg-slate-100 flex justify-between items-center border-b">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Megaphone className="h-5 w-5 text-amber-600"/> Mensaje Manual</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsNotifyModalOpen(false)}><X className="h-5 w-5"/></Button>
            </div>
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4">
              <textarea className="w-full border rounded-xl p-3 bg-white font-medium min-h-[100px] outline-none" value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} />
              <div className="border rounded-xl overflow-hidden">
                <ul className="divide-y max-h-[300px] overflow-y-auto">
                  {filteredStudents.map(s => {
                    const yaEnviado = notificadosIndividuales.has(s.id);
                    const tel = s.telefono_representante || s.telefono_estudiante;
                    return (
                      <li key={s.id} className={`p-3 flex justify-between items-center ${yaEnviado ? 'opacity-70 bg-slate-50' : ''}`}>
                        <div><p className="font-bold text-sm">{s.nombres}</p><p className="text-xs text-slate-500">Rep: {tel || 'Sin número'}</p></div>
                        <Button size="sm" className={yaNotificadoNota => yaEnviado ? 'bg-slate-200 text-slate-500' : 'bg-[#25D366] text-white'} disabled={!tel || yaEnviado} onClick={() => {
                          if (tel) {
                            window.open(`https://wa.me/593${String(tel).replace(/\D/g, "")}?text=${encodeURIComponent(bulkMessage)}`, '_blank');
                            setNotificadosIndividuales(prev => new Set(prev).add(s.id));
                          }
                        }}>
                          {yaEnviado ? 'Enviado' : 'Enviar'}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50"><Button className="w-full bg-slate-800 text-white font-bold" onClick={() => setIsNotifyModalOpen(false)}>Cerrar</Button></div>
          </div>
        </div>
      )}

      {/* MODALES CRUD */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 bg-slate-100 flex justify-between items-center border-b">
              <h3 className="text-xl font-bold">Agregar Estudiante</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)}><X className="h-5 w-5"/></Button>
            </div>
            <form onSubmit={handleAddStudent} className="p-4 space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 border-2 border-dashed rounded-xl bg-slate-50">
                {fotoUrl ? <img src={fotoUrl} className="w-24 h-24 rounded-full object-cover" /> : <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-xs">Sin Foto</div>}
                <input type="file" id="file-add" accept="image/*" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" onClick={() => document.getElementById("file-add")?.click()}><Upload className="mr-2 h-4 w-4" /> Subir Foto</Button>
              </div>
              <div><label className="text-sm font-semibold">Nombres</label><Input required value={nombre} onChange={e => setNombre(e.target.value)} /></div>
              <div><label className="text-sm font-semibold">Curso</label><select className="w-full border rounded-lg h-10 px-3 bg-white" value={curso} onChange={e => setCurso(e.target.value)}>{Object.keys(COURSE_ORDER).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="text-sm font-semibold">Teléfono Representante</label><Input value={telRepresentante} onChange={e => setTelRepresentante(e.target.value)} /></div>
              <div><label className="text-sm font-semibold">Teléfono Estudiante</label><Input value={telEstudiante} onChange={e => setTelEstudiante(e.target.value)} /></div>
              <div className="pt-4 flex gap-3"><Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button><Button type="submit" className="bg-blue-600 text-white flex-1 font-bold">Guardar</Button></div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 bg-slate-100 flex justify-between items-center border-b">
              <h3 className="text-xl font-bold">Editar Estudiante</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsEditModalOpen(false)}><X className="h-5 w-5"/></Button>
            </div>
            <form onSubmit={handleEditStudent} className="p-4 space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 border-2 border-dashed rounded-xl bg-slate-50">
                {fotoUrl ? <img src={fotoUrl} className="w-24 h-24 rounded-full object-cover" /> : <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-xs">Sin Foto</div>}
                <input type="file" id="file-edit" accept="image/*" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" onClick={() => document.getElementById("file-edit")?.click()}><Upload className="mr-2 h-4 w-4" /> Subir Foto</Button>
              </div>
              <div><label className="text-sm font-semibold">Nombres</label><Input required value={nombre} onChange={e => setNombre(e.target.value)} /></div>
              <div><label className="text-sm font-semibold">Curso</label><select className="w-full border rounded-lg h-10 px-3 bg-white" value={curso} onChange={e => setCurso(e.target.value)}>{Object.keys(COURSE_ORDER).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="text-sm font-semibold">Teléfono Representante</label><Input value={telRepresentante} onChange={e => setTelRepresentante(e.target.value)} /></div>
              <div><label className="text-sm font-semibold">Teléfono Estudiante</label><Input value={telEstudiante} onChange={e => setTelEstudiante(e.target.value)} /></div>
              <div className="pt-4 flex justify-between">
                <Button type="button" variant="destructive" onClick={() => handleDeleteStudent(selectedStudent.id)}>Eliminar</Button>
                <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button><Button type="submit" className="bg-blue-600 text-white font-bold">Actualizar</Button></div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PANEL SUPERIOR DE BOTONES */}
      <div className="flex flex-col gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Estudiantes</h1>
          <div className="flex items-center text-blue-600 bg-blue-50 px-4 py-2 rounded-full font-semibold text-sm border">
            <Users className="w-4 h-4 mr-2" /> Total: {students.length} Estudiantes
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 w-full">
          <Button onClick={() => alert("Módulo de Cámara IA pausado temporalmente. ¡Mañana lo activamos con éxito!")} className="bg-indigo-600 hover:bg-indigo-700 h-12 w-full">
            <Camera className="mr-2 h-5 w-5"/> Cámara IA
          </Button>
          <Button onClick={() => setEscaneandoQR(true)} className="bg-blue-600 hover:bg-blue-700 h-12 w-full">
            <ScanLine className="mr-2 h-5 w-5"/> Cámara QR
          </Button>
          <Button onClick={() => window.print()} className="bg-emerald-700 hover:bg-emerald-800 h-12 w-full">
            <Printer className="mr-2 h-5 w-5"/> Imprimir Curso
          </Button>
          <Button onClick={() => setIsNotifyModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 h-12 w-full">
            <Megaphone className="mr-2 h-5 w-5"/> Mensaje Manual
          </Button>
          <Button onClick={cargarNotasDesdeNube} className="bg-purple-600 hover:bg-purple-700 h-12 w-full text-white font-bold">
            <Cloud className="mr-2 h-5 w-5"/> Notificar Notas (Nube)
          </Button>
          <Button onClick={openAddModal} className="bg-green-600 hover:bg-green-700 h-12 w-full">
            <Plus className="mr-2 h-5 w-5"/> Agregar
          </Button>
        </div>
      </div>

      {/* BUSCADOR Y FILTROS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input className="h-12 text-base bg-white w-full" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="border rounded-md px-4 h-12 bg-white w-full sm:w-64" value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
            <option value="Todos">Todos los cursos</option>
            {Object.keys(COURSE_ORDER).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* TARJETAS DE ESTUDIANTES */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredStudents.map((s, index) => (
          <div key={s.id} className="bg-white p-4 sm:p-6 rounded-3xl border shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 bg-slate-200 rounded-full overflow-hidden border-2 flex-shrink-0">
                  {s.fotos_rostro?.[0] ? <img src={s.fotos_rostro[0]} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full font-bold text-slate-400">{index + 1}</span>}
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-900 uppercase">{s.nombres}</h2>
                  <p className="text-xs text-slate-500">{s.curso}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Rep: {s.telefono_representante || 'N/D'}</p>
                </div>
              </div>
              <Button onClick={() => openEditModal(s)} variant="ghost" size="icon"><Pencil className="h-5 w-5" /></Button>
            </div>

            <div id={`qr-hidden-${s.id}`} className="hidden"><QRCodeSVG value={s.id} size={200} /></div>

            <Button onClick={() => printCredential(s)} variant="secondary" className="w-full h-10 bg-slate-100 text-xs">
               <Printer className="mr-2 h-4 w-4" /> Generar Credencial
            </Button>

            <div className="grid grid-cols-3 gap-1">
              {["Presente", "Atrasado", "Ausente"].map(estado => (
                <Button key={estado} onClick={() => setEstatusAlerta(prev => ({...prev, [s.id]: estado}))} className={`h-10 text-xs font-bold ${estatusAlerta[s.id] === estado ? (estado === "Presente" ? "bg-green-600 text-white" : estado === "Atrasado" ? "bg-amber-500 text-white" : "bg-red-600 text-white") : "bg-slate-100 text-slate-700"}`}>
                  {estado}
                </Button>
              ))}
            </div>
            
            <Button variant="outline" className="w-full h-10 font-bold text-xs text-green-700 border-green-600 hover:bg-green-50" onClick={() => sendWhatsApp(s, estatusAlerta[s.id] || "Recordatorio")}>
              <MessageCircle className="mr-2 h-4 w-4"/> WhatsApp Directo
            </Button>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 p-4 bg-slate-900 rounded-2xl text-white flex justify-between items-center shadow-2xl">
        <span className="font-bold">Fecha: {fechaActual}</span>
        <Button onClick={finalizarAsistenciaJornada} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
            <Save className="mr-2"/> Guardar Asistencia
        </Button>
      </div>

    </div>
  )
}