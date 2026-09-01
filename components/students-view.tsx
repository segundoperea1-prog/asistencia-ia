"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Printer, MessageCircle, ScanLine, X, Users, Plus, Pencil, Upload, Save, Search, Megaphone, CheckCircle, Cloud, RefreshCw, WifiOff, Wifi, CloudOff } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QRCodeSVG } from "qrcode.react"
import { Scanner } from '@yudiel/react-qr-scanner'
import { loadInstitutionSettings } from "@/lib/institution-settings"

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby6TkL7QdmKRAunsHW5416ySrK13xuYtAdrZVnyDDIni2jeKf5EWaBCcRLgcTSh4lI/exec";

type ActividadNube = { colIndex: number; tituloCompleto: string; alumnos: { nombre: string; nota: string }[]; }
type MateriaNube = { nombreHoja: string; nombreMateria: string; actividades: ActividadNube[]; }
type CursoNube = { curso: string; materias: MateriaNube[]; }

function normalizarTexto(texto: string) {
  if (!texto) return "";
  return texto.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
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
  for (const w of shortest) { if (longestStr.includes(w)) coincidencias++; }
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
      const fechaEs = fechaObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      return `${actividad} - ${fechaEs.charAt(0).toUpperCase() + fechaEs.slice(1)}`;
    }
  }
  return tituloCompleto;
}

async function subirFotoASupabase(base64String: string) {
  if (!base64String.startsWith("data:image")) return base64String;
  try {
    const response = await fetch(base64String);
    const blob = await response.blob();
    const nombreArchivo = `foto_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
    const { error } = await supabase.storage.from('fotos_estudiantes').upload(nombreArchivo, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    const { data: publicData } = supabase.storage.from('fotos_estudiantes').getPublicUrl(nombreArchivo);
    return publicData.publicUrl;
  } catch (error) {
    console.error("Error Storage:", error);
    throw new Error("Fallo en la subida perimetral de la foto.");
  }
}

export function StudentsView() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("Todos");
  
  const [estatusAlerta, setEstatusAlerta] = useState<Record<string, string>>({});
  const [escaneandoQR, setEscaneandoQR] = useState(false);
  
  // ESTADOS DE ARQUITECTURA OFFLINE
  const [registrosOffline, setRegistrosOffline] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); // Estado para animar la sincronización automática

  const [mensajeExito, setMensajeExito] = useState("");
  const [ultimoEscaneado, setUltimoEscaneado] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("Esc de Educ Básica Fiscomisional Madre del Salvador.\n\nEstimados padres de familia:\n");

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

  // MONITOR DE RED Y CARGA INICIAL
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const colaGuardada = localStorage.getItem('asistencias_offline');
    if (colaGuardada) {
      setRegistrosOffline(JSON.parse(colaGuardada));
    }

    const date = new Date();
    const str = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    setFechaActual(str.charAt(0).toUpperCase() + str.slice(1));
    setSettings(loadInstitutionSettings());

    async function loadStudentsAndAttendance() {
      try {
        setLoading(true);
        if (navigator.onLine) {
          const hoyISO = new Date().toISOString().split('T')[0];
          const [studentsRes, asistenciaRes] = await Promise.all([
            supabase.from("estudiantes").select("*"),
            supabase.from("asistencias").select("*").eq("fecha", hoyISO)
          ]);
          
          if (studentsRes.data) {
            setStudents(studentsRes.data);
            localStorage.setItem('estudiantes_cache', JSON.stringify(studentsRes.data));
          }

          if (!asistenciaRes.error && asistenciaRes.data) {
            const mapaAsistencia: Record<string, string> = {};
            asistenciaRes.data.forEach((registro: any) => {
              let estadoPantalla = "";
              if (registro.estado === "present") estadoPantalla = "Presente";
              else if (registro.estado === "late") estadoPantalla = "Atrasado";
              else if (registro.estado === "absent") estadoPantalla = "Ausente";
              if (estadoPantalla) mapaAsistencia[registro.estudiante_id] = estadoPantalla;
            });
            setEstatusAlerta(mapaAsistencia);
          }
        } else {
          const cache = localStorage.getItem('estudiantes_cache');
          if (cache) setStudents(JSON.parse(cache));
        }
      } catch (err) {
        console.error("Error BD:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStudentsAndAttendance();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // LÓGICA DE SINCRONIZACIÓN AUTOMÁTICA SILENCIOSA
  const sincronizarConNube = useCallback(async () => {
    if (!isOnline || registrosOffline.length === 0 || isSyncing) return;

    try {
      setIsSyncing(true);
      const hoyISO = new Date().toISOString().split('T')[0];
      const studentIds = registrosOffline.map(r => r.estudiante_id);
      
      // Limpiar y preparar
      await supabase.from("asistencias").delete().eq("fecha", hoyISO).in("estudiante_id", studentIds);
      const registrosParaBD = registrosOffline.map(({ nombres, ...resto }) => resto);
      
      const { error } = await supabase.from("asistencias").insert(registrosParaBD);
      if (error) throw error;

      // Limpiar cola silenciosamente
      setRegistrosOffline([]);
      localStorage.removeItem('asistencias_offline');
      
    } catch (err: any) {
      console.error("Error en sincronización en segundo plano:", err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, registrosOffline, isSyncing]);

  // EL OBSERVADOR: Dispara la sincronización en cuanto hay internet y datos
  useEffect(() => {
    if (isOnline && registrosOffline.length > 0 && !isSyncing) {
      sincronizarConNube();
    }
  }, [isOnline, registrosOffline, isSyncing, sincronizarConNube]);

  // MOTOR OFFLINE-FIRST: Guardar asistencia
  const registrarAsistenciaLocal = (estudianteId: string, estado: string) => {
    const hoyISO = new Date().toISOString().split('T')[0];
    const sInfo = students.find(s => s.id === estudianteId);
    
    setEstatusAlerta(prev => ({...prev, [estudianteId]: estado}));

    let estadoDB = "present";
    if (estado === "Atrasado") estadoDB = "late";
    else if (estado === "Ausente") estadoDB = "absent";

    const nuevoRegistro = {
      estudiante_id: estudianteId,
      fecha: hoyISO,
      estado: estadoDB,
      curso: sInfo?.curso || "Sin curso",
      nombres: sInfo?.nombres || "Desconocido"
    };

    setRegistrosOffline(prev => {
      const colaLimpia = prev.filter(r => r.estudiante_id !== estudianteId);
      const nuevaCola = [...colaLimpia, nuevoRegistro];
      localStorage.setItem('asistencias_offline', JSON.stringify(nuevaCola));
      return nuevaCola;
    });
  };

  // ESCÁNER QR DETERMINISTA
  const procesarCodigoQR = (codigo: string) => {
    if (codigo === ultimoEscaneado) return;
    const estudiante = students.find(s => s.id === codigo);
    if (estudiante) {
      setUltimoEscaneado(estudiante.id); 
      registrarAsistenciaLocal(estudiante.id, "Presente");
      
      setMensajeExito(`¡${estudiante.nombres} marcado PRESENTE!`);
      if (navigator.vibrate) navigator.vibrate(100);
      setTimeout(() => { setMensajeExito(""); setUltimoEscaneado(""); }, 1500);
    }
  };

  const sendWhatsApp = (estudiante: any, status: string) => {
    const telefonoParaEnviar = estudiante?.telefono_representante || estudiante?.telefono_estudiante;
    if (!telefonoParaEnviar) return alert("Estudiante sin número registrado.");
    
    // El método replace limpia el número, dejando solo los dígitos.
    const formattedPhone = String(telefonoParaEnviar).replace(/\D/g, "");
    
    const instName = settings.institutionName?.toUpperCase() || "ESC DE EDUC BÁSICA FISCOMISIONAL MADRE DEL SALVADOR";
    const docName = settings.teacherName || "El Docente";
    const message = `${instName}\n\nEstimado representante, le informamos que el estudiante ${estudiante.nombres} ha sido marcado como: *${status}* el día de hoy.\n\nAtentamente,\n${docName}`;
    
    // Aquí está la corrección: Se genera el enlace usando el formattedPhone directamente (que ya incluye el 593 desde la base de datos).
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
    
    setNotificadosIndividuales(prev => new Set(prev).add(estudiante.id));
  };

  const cargarNotasDesdeNube = async () => {
    if(!isOnline) return alert("Requiere conexión a internet.");
    try {
      setCargandoNube(true); setIsGradesModalOpen(true);
      const response = await fetch(GOOGLE_SCRIPT_URL);
      if (!response.ok) throw new Error("Fallo en la conexión con Google Drive.");
      const data: CursoNube[] = await response.json();
      if (!data || data.length === 0) return alert("Carpeta vacía o sin permisos.");
      setDatosNube(data); setIndiceCursoSeleccionado(0); setIndiceMateriaSeleccionada(0);
      setColumnaSeleccionada(data[0]?.materias[0]?.actividades[0]?.colIndex || null);
    } catch (err: any) { alert("Error al cargar notas: " + err.message); setIsGradesModalOpen(false); } finally { setCargandoNube(false); }
  };

  const cambiarCursoNube = (idxCurso: number) => { setIndiceCursoSeleccionado(idxCurso); setIndiceMateriaSeleccionada(0); setColumnaSeleccionada(datosNube[idxCurso]?.materias[0]?.actividades[0]?.colIndex || null); };
  const cambiarMateriaNube = (idxMateria: number) => { setIndiceMateriaSeleccionada(idxMateria); setColumnaSeleccionada(datosNube[indiceCursoSeleccionado]?.materias[idxMateria]?.actividades[0]?.colIndex || null); };

  const printCredential = (s: any) => {
    const printWindow = window.open('', '_blank');
    const qrSvg = document.getElementById(`qr-hidden-${s.id}`)?.innerHTML;
    printWindow?.document.write(`<html><head><title>Credencial - ${s.nombres}</title><style>body { font-family: sans-serif; text-align: center; padding: 40px; } .card { border: 2px solid #000; border-radius: 15px; padding: 20px; width: 350px; margin: 0 auto; } .school-name { font-weight: bold; font-size: 18px; color: #1e40af; margin-bottom: 10px; } .student-name { font-size: 20px; margin: 15px 0; border-top: 1px solid #ccc; padding-top: 10px; } .course { color: #666; font-size: 16px; margin-bottom: 20px; } .qr-zone svg { width: 150px; height: 150px; }</style></head><body onload="window.print()"><div class="card"><div class="school-name">ESC DE EDUC BÁSICA FISCOMISIONAL<br>MADRE DEL SALVADOR</div><div class="student-name">${s.nombres}</div><div class="course">${s.curso}</div><div class="qr-zone">${qrSvg}</div><p style="font-size: 10px; margin-top: 20px;">Credencial Oficial</p></div></body></html>`);
    printWindow?.document.close();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250; canvas.width = MAX_WIDTH; canvas.height = img.height * (MAX_WIDTH / img.width);
          const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setFotoUrl(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => { setNombre(""); setCurso("1ro Ciencias"); setTelRepresentante(""); setTelEstudiante(""); setFotoUrl(""); setIsAddModalOpen(true); };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!isOnline) return alert("Se requiere internet para añadir estudiantes.");
    try {
      let finalFotoUrl = fotoUrl ? await subirFotoASupabase(fotoUrl) : "";
      const newStudent = { nombres: nombre, curso, telefono_representante: telRepresentante, telefono_estudiante: telEstudiante, fotos_rostro: finalFotoUrl ? [finalFotoUrl] : [] };
      const { data, error } = await supabase.from("estudiantes").insert([newStudent]).select();
      if (error) throw error;
      if (data) setStudents(prev => [...prev, data[0]]);
      setIsAddModalOpen(false); alert("Estudiante agregado correctamente");
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const openEditModal = (student: any) => {
    setSelectedStudent(student); setNombre(student.nombres || ""); setCurso(student.curso || "1ro Ciencias"); setTelRepresentante(student.telefono_representante || ""); setTelEstudiante(student.telefono_estudiante || ""); setFotoUrl(student.fotos_rostro?.[0] || "");
    setIsEditModalOpen(true);
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !isOnline) return alert("Verifique su conexión a internet.");
    try {
      let finalFotoUrl = fotoUrl ? await subirFotoASupabase(fotoUrl) : "";
      const updatedData = { nombres: nombre, curso, telefono_representante: telRepresentante, telefono_estudiante: telEstudiante, fotos_rostro: finalFotoUrl ? [finalFotoUrl] : [] };
      const { error } = await supabase.from("estudiantes").update(updatedData).eq("id", selectedStudent.id);
      if (error) throw error;
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, ...updatedData } : s));
      setIsEditModalOpen(false); setSelectedStudent(null); alert("Estudiante actualizado");
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!isOnline) return alert("Requiere conexión a internet.");
    if (!confirm("¿Desea eliminar a este estudiante de la base de datos?")) return;
    try {
      const { error } = await supabase.from("estudiantes").delete().eq("id", id);
      if (error) throw error;
      setStudents(prev => prev.filter(s => s.id !== id));
      setIsEditModalOpen(false); setSelectedStudent(null); alert("Estudiante eliminado");
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const filteredStudents = useMemo(() => {
    let listaFiltro = [...students];
    if (ocultarEnviados) listaFiltro = listaFiltro.filter(s => !notificadosIndividuales.has(s.id));
    return listaFiltro
      .filter(s => (filterCourse === "Todos" || s.curso === filterCourse) && (s.nombres?.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => (COURSE_ORDER[a.curso] || 99) - (COURSE_ORDER[b.curso] || 99) || (a.nombres || "").localeCompare(b.nombres || ""));
  }, [students, search, filterCourse, ocultarEnviados, notificadosIndividuales]);

  if (loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 border-solid"></div>
        <p className="text-lg font-bold text-slate-600">Sincronizando Arquitectura...</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6 bg-slate-50 min-h-screen relative overflow-x-hidden pb-24">
      
      {/* PANEL INDICADOR DE RED Y OFFLINE */}
      <div className={`fixed top-0 left-0 w-full z-50 text-center text-xs font-bold py-1 shadow-md transition-colors ${isOnline ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
        {isOnline ? (
           <span className="flex items-center justify-center gap-2"><Wifi className="w-3 h-3"/> Conectado: Sistema en Línea</span>
        ) : (
           <span className="flex items-center justify-center gap-2"><WifiOff className="w-3 h-3"/> Modo Offline: Operando en memoria local</span>
        )}
      </div>

      {escaneandoQR && (
        <div className="fixed inset-0 z-[999] bg-slate-900/95 flex flex-col items-center justify-center sm:p-4">
          <div className="w-full h-full sm:h-auto sm:max-w-md bg-black sm:rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
            <div className="p-4 bg-blue-700 flex justify-between items-center border-b border-blue-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><ScanLine className="w-5 h-5"/> Lector QR Ultrarrápido</h3>
              <Button variant="ghost" size="icon" className="text-white hover:bg-blue-600" onClick={() => setEscaneandoQR(false)}>
                <X className="h-6 w-6"/>
              </Button>
            </div>
            
            <div className="relative w-full flex-1 bg-black flex items-center justify-center">
              <Scanner 
                 onScan={(result: any) => { if (result && result.length > 0) procesarCodigoQR(result[0].rawValue); }} 
                 formats={['qr_code']}
                 components={{ audio: false, finder: true }}
              />
            </div>
            
            <div className="p-6 h-32 flex flex-col items-center justify-center text-center bg-slate-900 border-t border-slate-800">
              {mensajeExito ? (
                <div className="bg-emerald-500/20 text-emerald-400 p-3 rounded-xl font-bold text-lg w-full animate-pulse border border-emerald-500/50">
                  {mensajeExito}
                </div>
              ) : (
                <>
                  <p className="text-slate-400 text-sm font-medium">Enfoque el código QR del estudiante.</p>
                  <p className="text-slate-600 text-xs mt-1">Motor determinista activado.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN PRINCIPAL */}
      <div className="flex flex-col gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800">Gestión Estudiantil Integrada</h1>
          <div className="flex gap-2">
            <div className="flex items-center text-blue-600 bg-blue-50 px-4 py-2 rounded-full font-semibold text-sm border">
              <Users className="w-4 h-4 mr-2" /> Entidades: {students.length}
            </div>
          </div>
        </div>
        
        {/* BOTONERA OPTIMIZADA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
          <Button onClick={() => setEscaneandoQR(true)} className="bg-blue-600 hover:bg-blue-700 h-14 w-full text-white font-bold text-base shadow-lg transition-transform hover:scale-105 col-span-2 md:col-span-1">
            <ScanLine className="mr-2 h-6 w-6"/> Escáner QR
          </Button>

          <Button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 h-14 w-full text-white">
            <Printer className="mr-2 h-5 w-5"/> Exportar Matriz
          </Button>
          
          <Button onClick={cargarNotasDesdeNube} className="bg-purple-600 hover:bg-purple-700 h-14 w-full text-white">
            <Cloud className="mr-2 h-5 w-5"/> Notas Drive
          </Button>
          
          <Button onClick={openAddModal} className="bg-green-600 hover:bg-green-700 h-14 w-full text-white">
            <Plus className="mr-2 h-5 w-5"/> Nuevo
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input className="h-12 text-base bg-white w-full border-slate-300 shadow-sm" placeholder="Buscar alumno por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="border-slate-300 rounded-md px-4 h-12 bg-white w-full sm:w-64 shadow-sm font-medium" value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
            <option value="Todos">Todas las matrices</option>
            {Object.keys(COURSE_ORDER).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* LISTA DE ESTUDIANTES */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredStudents.map((s, index) => (
          <div key={s.id} className={`bg-white p-4 sm:p-6 rounded-3xl border-2 shadow-sm space-y-4 transition-all ${estatusAlerta[s.id] === 'Presente' ? 'border-green-200 bg-green-50/30' : 'border-slate-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-slate-100 rounded-full overflow-hidden border flex-shrink-0">
                  {s.fotos_rostro?.[0] ? <img src={s.fotos_rostro[0]} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full font-bold text-slate-400">{index + 1}</span>}
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-900 uppercase leading-tight">{s.nombres}</h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">{s.curso}</p>
                </div>
              </div>
              <Button onClick={() => openEditModal(s)} variant="ghost" size="icon" className="text-slate-400 hover:text-slate-800"><Pencil className="h-4 w-4" /></Button>
            </div>

            <div id={`qr-hidden-${s.id}`} className="hidden"><QRCodeSVG value={s.id} size={200} /></div>

            <div className="grid grid-cols-3 gap-1.5">
              {["Presente", "Atrasado", "Ausente"].map(estado => (
                <Button 
                  key={estado} 
                  onClick={() => registrarAsistenciaLocal(s.id, estado)} 
                  className={`h-10 text-xs font-bold transition-all ${estatusAlerta[s.id] === estado ? (estado === "Presente" ? "bg-green-600 text-white shadow-md hover:bg-green-700" : estado === "Atrasado" ? "bg-amber-500 text-white shadow-md hover:bg-amber-600" : "bg-red-600 text-white shadow-md hover:bg-red-700") : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {estado}
                </Button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 font-bold text-[10px] text-green-700 border-green-600 hover:bg-green-50" onClick={() => sendWhatsApp(s, estatusAlerta[s.id] || "Recordatorio")}>
                <MessageCircle className="mr-1 h-3 w-3"/> Enviar Aviso
              </Button>
              <Button onClick={() => printCredential(s)} variant="secondary" className="flex-1 h-9 bg-slate-100 text-[10px] font-semibold hover:bg-slate-200">
                 <Printer className="mr-1 h-3 w-3" /> Imprimir QR
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* BARRA FLOTANTE DE ESTADO (AUTOMATIZADA) */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-slate-900 text-white flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-40 border-t border-slate-700 sm:rounded-t-3xl">
        <span className="font-bold text-sm text-slate-300">{fechaActual}</span>
        
        <div className="flex items-center gap-2">
           {isSyncing ? (
             <span className="text-xs text-blue-400 font-bold flex items-center gap-2 animate-pulse bg-blue-900/40 px-3 py-1.5 rounded-full">
               <RefreshCw className="h-4 w-4 animate-spin"/> Sincronizando Nube...
             </span>
           ) : registrosOffline.length > 0 ? (
             <span className="text-xs text-amber-400 font-bold flex items-center gap-2 bg-amber-900/40 px-3 py-1.5 rounded-full">
               <CloudOff className="h-4 w-4"/> {registrosOffline.length} locales (Sin Red)
             </span>
           ) : (
             <span className="text-xs text-emerald-400 font-bold flex items-center gap-2 bg-emerald-900/40 px-3 py-1.5 rounded-full">
               <CheckCircle className="h-4 w-4"/> Base de Datos Actualizada
             </span>
           )}
        </div>
      </div>

    </div>
  )
}