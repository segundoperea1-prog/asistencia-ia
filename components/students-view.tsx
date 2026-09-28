"use client"

import { useEffect, useState, useMemo } from "react"
import { Camera, Printer, MessageCircle, ScanLine, X, Users, Plus, Pencil, Upload, Save, Search, Megaphone, CheckCircle, Copy, FileSpreadsheet, Award, BookOpen, Paperclip, Cloud, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QRCodeSVG } from "qrcode.react"
import { Scanner } from '@yudiel/react-qr-scanner'
import { loadInstitutionSettings } from "@/lib/institution-settings"

// DIRECCIÓN OFICIAL DE SU SCRIPT EN LA NUBE ACTUALIZADA
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwyc5qGDC4lretcJOolcWGtdR75X_AeKOihGAaLG6O8sRkwl8xHu7zsAjGNQtcfT04i/exec";

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
      const opciones: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      };
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
  const [isUploading, setIsUploading] = useState(false);

  const [settings, setSettings] = useState<any>({});
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

    async function loadStudentsAndAttendance() {
      try {
        setLoading(true);
        
        try {
          const resolvedSettings = await loadInstitutionSettings();
          setSettings(resolvedSettings || {});
        } catch (error) {
          console.error("Error al cargar la configuración:", error);
        }

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

  const uploadFotoToBucket = async (base64Str: string) => {
    if (!base64Str.startsWith('data:image')) return base64Str;
    
    const response = await fetch(base64Str);
    const blob = await response.blob();
    const fileName = `foto_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    
    const { data, error } = await supabase.storage
      .from('fotos_estudiantes')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });
      
    if (error) throw new Error("Error en Supabase Storage: " + error.message);
    
    const { data: publicUrlData } = supabase.storage
      .from('fotos_estudiantes')
      .getPublicUrl(fileName);
      
    return publicUrlData.publicUrl;
  };

  const sendWhatsApp = (estudiante: any, status: string) => {
    const telefonoParaEnviar = estudiante?.telefono_representante || estudiante?.telefono_estudiante;
    if (!telefonoParaEnviar) {
      alert("Este estudiante no tiene ningún número registrado en su perfil.");
      return;
    }
    const formattedPhone = String(telefonoParaEnviar).replace(/\D/g, "");
    const instName = settings?.institutionName?.toUpperCase() || "UNIDAD EDUCATIVA FISCAL MODESTO ENRIQUE SUÁREZ PIMENTEL";
    const docName = settings?.teacherName || "El Docente";

    const message = `${instName}\n\nEstimado representante, le informamos que el estudiante ${estudiante.nombres} ha sido marcado como: *${status}* el día de hoy.\n\nAtentamente,\n${docName}`;
    
    window.open(`https://wa.me/593${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
    setNotificadosIndividuales(prev => new Set(prev).add(estudiante.id));
  };

  const cargarNotasDesdeNube = async () => {
    try {
      setCargandoNube(true);
      setIsGradesModalOpen(true);

      const response = await fetch(GOOGLE_SCRIPT_URL);
      if (!response.ok) {
        throw new Error("No se pudo conectar con el servidor de Google Drive.");
      }

      const data: CursoNube[] = await response.json();

      if (!data || data.length === 0) {
        alert("No se encontraron archivos válidos en la carpeta de Google Drive.");
        setIsGradesModalOpen(false);
        return;
      }

      setDatosNube(data);
      setIndiceCursoSeleccionado(0);
      setIndiceMateriaSeleccionada(0);

      const primerCol = data[0]?.materias[0]?.actividades[0]?.colIndex || null;
      setColumnaSeleccionada(primerCol);

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
    const primerCol = datosNube[idxCurso]?.materias[0]?.actividades[0]?.colIndex || null;
    setColumnaSeleccionada(primerCol);
  };

  const cambiarMateriaNube = (idxMateria: number) => {
    setIndiceMateriaSeleccionada(idxMateria);
    const primerCol = datosNube[indiceCursoSeleccionado]?.materias[idxMateria]?.actividades[0]?.colIndex || null;
    setColumnaSeleccionada(primerCol);
  };

  const printCredential = (s: any) => {
    const printWindow = window.open('', '_blank');
    const qrSvg = document.getElementById(`qr-hidden-${s.id}`)?.innerHTML || '';
    
    const fotoUrl = s.fotos_rostro?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.nombres)}&background=01579b&color=fff&size=200`;

    printWindow?.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <title>Credencial - ${s.nombres}</title>
          <style>
              @page { size: 5.5cm 9.0cm; margin: 0; }
              body { 
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                  margin: 0; 
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  background-color: white;
                  -webkit-print-color-adjust: exact !important; 
                  print-color-adjust: exact !important;
              }
              .credencial { 
                  width: 5.5cm; 
                  height: 9.0cm; 
                  background: linear-gradient(135deg, #ffffff 0%, #e1f5fe 100%); 
                  border: 2px solid #01579b; 
                  border-radius: 8px; 
                  text-align: center; 
                  box-sizing: border-box; 
                  overflow: hidden; 
                  display: flex;
                  flex-direction: column;
              }
              .encabezado { 
                  background-color: #01579b; 
                  color: white; 
                  padding: 6px 4px; 
                  display: flex; 
                  align-items: center; 
                  justify-content: center;
                  gap: 5px; 
              }
              .logo-container { 
                  width: 1.2cm; 
                  height: 1.2cm; 
                  background-color: white; 
                  border-radius: 50%; 
                  padding: 2px; 
                  flex-shrink: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  overflow: hidden;
              }
              .logo-container img {
                  width: 100%;
                  height: 100%;
                  object-fit: contain;
                  border-radius: 50%;
              }
              .titulo-escuela { 
                  font-size: 7pt; 
                  font-weight: 800; 
                  text-align: left; 
                  line-height: 1.1; 
              }
              .cuerpo { 
                  padding: 6px 4px; 
                  flex-grow: 1;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: flex-start;
              }
              .foto { 
                  width: 2.3cm; 
                  height: 2.9cm; 
                  border: 2px solid #0288d1; 
                  border-radius: 6px; 
                  object-fit: cover; 
                  margin-bottom: 5px; 
              }
              .nombre { 
                  color: #01579b; 
                  font-size: 8.5pt; 
                  font-weight: 900; 
                  margin-bottom: 2px; 
                  text-transform: uppercase; 
                  line-height: 1.1; 
                  width: 95%;
              }
              .curso { 
                  color: #0288d1; 
                  font-size: 8pt; 
                  font-weight: 700; 
                  margin-bottom: 4px; 
              }
              .titulo-oficial { 
                  font-size: 5.5pt; 
                  font-weight: 800; 
                  color: #555; 
                  margin-bottom: 2px; 
              }
              .periodo {
                  font-size: 8.5pt;
                  font-weight: 900;
                  color: #d32f2f;
                  margin-bottom: 6px;
              }
              .contenedor-qr {
                  width: 1.6cm;
                  height: 1.6cm;
                  background-color: white;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  border-radius: 4px;
              }
              .contenedor-qr svg {
                  width: 100%;
                  height: 100%;
              }
              @media print {
                  .credencial { border: none; }
              }
          </style>
      </head>
      <body onload="setTimeout(() => window.print(), 800)">
          <div class="credencial">
              <div class="encabezado">
                  <div class="logo-container">
                      <img src="/Logo_modesto-fondo.png" alt="Escudo Institucional" onerror="this.style.display='none'; this.parentNode.innerHTML='UESP'; this.parentNode.style.fontSize='9px'; this.parentNode.style.color='#01579b'; this.parentNode.style.fontWeight='bold';">
                  </div>
                  <div class="titulo-escuela">UNIDAD EDUCATIVA FISCAL<br>MODESTO ENRIQUE SUÁREZ PIMENTEL</div>
              </div>
              <div class="cuerpo">
                  <img src="${fotoUrl}" alt="Fotografía del Estudiante" class="foto">
                  <div class="nombre">${s.nombres}</div>
                  <div class="curso">${s.curso}</div>
                  <div class="titulo-oficial">CREDENCIAL ESTUDIANTIL OFICIAL</div>
                  <div class="periodo">2026 - 2027</div>
                  <div class="contenedor-qr">
                      ${qrSvg}
                  </div>
              </div>
          </div>
      </body>
      </html>
    `);
    printWindow?.document.close();
  };

  const printAllCredentials = () => {
    if (filteredStudents.length === 0) {
      alert("No hay estudiantes en pantalla para imprimir. Seleccione un curso primero.");
      return;
    }

    const printWindow = window.open('', '_blank');
    let cardsHtml = '';

    filteredStudents.forEach(s => {
      const qrSvg = document.getElementById(`qr-hidden-${s.id}`)?.innerHTML || '';
      const fotoUrl = s.fotos_rostro?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.nombres)}&background=01579b&color=fff&size=200`;

      cardsHtml += `
        <div class="credencial">
            <div class="encabezado">
                <div class="logo-container">
                    <img src="/Logo_modesto-fondo.png" alt="Escudo Institucional" onerror="this.style.display='none'; this.parentNode.innerHTML='UESP'; this.parentNode.style.fontSize='9px'; this.parentNode.style.color='#01579b'; this.parentNode.style.fontWeight='bold';">
                </div>
                <div class="titulo-escuela">UNIDAD EDUCATIVA FISCAL<br>MODESTO ENRIQUE SUÁREZ PIMENTEL</div>
            </div>
            <div class="cuerpo">
                <img src="${fotoUrl}" alt="Fotografía del Estudiante" class="foto">
                <div class="nombre">${s.nombres}</div>
                <div class="curso">${s.curso}</div>
                <div class="titulo-oficial">CREDENCIAL ESTUDIANTIL OFICIAL</div>
                <div class="periodo">2026 - 2027</div>
                <div class="contenedor-qr">
                    ${qrSvg}
                </div>
            </div>
        </div>
      `;
    });

    printWindow?.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <title>Impresión Masiva - ${filterCourse}</title>
          <style>
              @page { size: A4; margin: 10mm; }
              body { 
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                  margin: 0; 
                  padding: 0;
                  background-color: white;
                  -webkit-print-color-adjust: exact !important; 
                  print-color-adjust: exact !important;
              }
              .grid-container {
                  display: grid;
                  grid-template-columns: repeat(3, 5.5cm);
                  gap: 10mm 8mm; 
                  justify-content: center;
                  padding-top: 5mm;
              }
              .credencial { 
                  width: 5.5cm; 
                  height: 9.0cm; 
                  background: linear-gradient(135deg, #ffffff 0%, #e1f5fe 100%); 
                  border: 2px solid #01579b; 
                  border-radius: 8px; 
                  text-align: center; 
                  box-sizing: border-box; 
                  overflow: hidden; 
                  display: flex;
                  flex-direction: column;
                  page-break-inside: avoid; 
              }
              .encabezado { background-color: #01579b; color: white; padding: 6px 4px; display: flex; align-items: center; justify-content: center; gap: 5px; }
              .logo-container { width: 1.2cm; height: 1.2cm; background-color: white; border-radius: 50%; padding: 2px; flex-shrink: 0; display: flex; justify-content: center; align-items: center; overflow: hidden; }
              .logo-container img { width: 100%; height: 100%; object-fit: contain; border-radius: 50%; }
              .titulo-escuela { font-size: 7pt; font-weight: 800; text-align: left; line-height: 1.1; }
              .cuerpo { padding: 6px 4px; flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; }
              .foto { width: 2.3cm; height: 2.9cm; border: 2px solid #0288d1; border-radius: 6px; object-fit: cover; margin-bottom: 5px; }
              .nombre { color: #01579b; font-size: 8.5pt; font-weight: 900; margin-bottom: 2px; text-transform: uppercase; line-height: 1.1; width: 95%; }
              .curso { color: #0288d1; font-size: 8pt; font-weight: 700; margin-bottom: 4px; }
              .titulo-oficial { font-size: 5.5pt; font-weight: 800; color: #555; margin-bottom: 2px; }
              .periodo { font-size: 8.5pt; font-weight: 900; color: #d32f2f; margin-bottom: 6px; }
              .contenedor-qr { width: 1.6cm; height: 1.6cm; background-color: white; display: flex; justify-content: center; align-items: center; border-radius: 4px; }
              .contenedor-qr svg { width: 100%; height: 100%; }
          </style>
      </head>
      <body onload="setTimeout(() => window.print(), 1500)">
          <div class="grid-container">
              ${cardsHtml}
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
      setTimeout(() => {
        setMensajeExito("");
        setUltimoEscaneado("");
      }, 2500);
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
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setFotoUrl(compressedBase64);
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
      setIsUploading(true);
      let finalFotoUrls: string[] = [];
      
      if (fotoUrl) {
        if (fotoUrl.startsWith('data:image')) {
          const publicBucketUrl = await uploadFotoToBucket(fotoUrl);
          finalFotoUrls = [publicBucketUrl];
        } else {
          finalFotoUrls = [fotoUrl];
        }
      }

      const newStudent = { nombres: nombre, curso: curso, telefono_representante: telRepresentante, telefono_estudiante: telEstudiante, fotos_rostro: finalFotoUrls };
      const { data, error } = await supabase.from("estudiantes").insert([newStudent]).select();
      
      if (error) throw error;
      if (data) setStudents(prev => [...prev, data[0]]);
      
      setIsAddModalOpen(false);
      alert("Estudiante agregado correctamente. La fotografía ha sido asegurada en la nube.");
    } catch (err: any) { 
      alert("Error al agregar estudiante: " + err.message); 
    } finally {
      setIsUploading(false);
    }
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
      setIsUploading(true);
      let finalFotoUrls: string[] = [];
      
      if (fotoUrl) {
        if (fotoUrl.startsWith('data:image')) {
          const publicBucketUrl = await uploadFotoToBucket(fotoUrl);
          finalFotoUrls = [publicBucketUrl];
        } else {
          finalFotoUrls = [fotoUrl];
        }
      }

      const updatedData = { nombres: nombre, curso: curso, telefono_representante: telRepresentante, telefono_estudiante: telEstudiante, fotos_rostro: finalFotoUrls };
      const { error } = await supabase.from("estudiantes").update(updatedData).eq("id", selectedStudent.id);
      
      if (error) throw error;
      
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, ...updatedData } : s));
      setIsEditModalOpen(false); 
      setSelectedStudent(null);
      alert("Estudiante actualizado correctamente. La fotografía ha sido asegurada en la nube.");
    } catch (err: any) { 
      alert("Error al actualizar estudiante: " + err.message); 
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("¿Está seguro de que desea eliminar a este estudiante?")) return;
    try {
      const { error } = await supabase.from("estudiantes").delete().eq("id", id);
      if (error) throw error;
      setStudents(prev => prev.filter(s => s.id !== id));
      setIsEditModalOpen(false); setSelectedStudent(null);
      alert("Estudiante eliminado correctamente");
    } catch (err: any) { alert("Error al eliminar estudiante: " + err.message); }
  };

  const finalizarAsistenciaJornada = async () => {
    const hoyISO = new Date().toISOString().split('T')[0];
    const confirmar = confirm(`¿Desea guardar la asistencia de la fecha: ${fechaActual}?`);
    if (!confirmar) return;

    const recordsToInsert = Object.keys(estatusAlerta).map(estudianteId => {
      let estadoDB = "";
      if (estatusAlerta[estudianteId] === "Presente") estadoDB = "present";
      else if (estatusAlerta[estudianteId] === "Atrasado") estadoDB = "late";
      else if (estatusAlerta[estudianteId] === "Ausente") estadoDB = "absent";

      const estudianteInfo = students.find(s => s.id === estudianteId);

      return {
        estudiante_id: estudianteId,
        fecha: hoyISO,
        estado: estadoDB,
        curso: estudianteInfo?.curso || "Sin curso"
      };
    });

    if (recordsToInsert.length === 0) {
      alert("Atención: No ha marcado la asistencia de ningún estudiante aún.");
      return;
    }

    try {
      const studentIds = recordsToInsert.map(r => r.estudiante_id);
      const { error: deleteError } = await supabase.from("asistencias").delete().eq("fecha", hoyISO).in("estudiante_id", studentIds);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from("asistencias").insert(recordsToInsert);
      if (insertError) throw insertError;

      const totalEstudiantes = students.length;
      const presentes = Object.values(estatusAlerta).filter(e => e === "Presente").length;
      const atrasados = Object.values(estatusAlerta).filter(e => e === "Atrasado").length;
      const ausentes = Object.values(estatusAlerta).filter(e => e === "Ausente").length;
      const sinMarcar = totalEstudiantes - recordsToInsert.length;

      alert(`¡ASISTENCIA GUARDADA CON ÉXITO EN LA BASE DE DATOS!\n-----------------------------------\nFecha: ${fechaActual}\nTotal Alumnos: ${totalEstudiantes}\nPresentes: ${presentes}\nAtrasados: ${atrasados}\nAusentes: ${ausentes}\nSin registrar: ${sinMarcar}`);
    } catch (err: any) {
      alert("Error detallado de Base de Datos: " + (err.message || JSON.stringify(err)));
    }
  };

  const filteredStudents = useMemo(() => {
    let listaFiltro = [...students];

    if (ocultarEnviados) {
      listaFiltro = listaFiltro.filter(s => !notificadosIndividuales.has(s.id));
    }

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
        <p className="text-lg font-bold text-slate-600">Cargando Panel de Control...</p>
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
              <Scanner
                onScan={(result: any) => {
                  if (result && result.length > 0) {
                    procesarCodigoQR(result[0].rawValue);
                  }
                }}
              />
            </div>

            <div className="p-6 h-32 flex items-center justify-center text-center bg-white">
              {mensajeExito ? (
                <div className="bg-green-100 text-green-800 p-4 rounded-xl font-bold text-lg w-full">
                  {mensajeExito}
                </div>
              ) : (
                <p className="text-slate-500 text-lg font-medium">Apunte la cámara al código QR.<br/>El escaneo es ininterrumpido.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MÓDULO EXCEL CONEXIÓN DIRECTA A LA NUBE */}
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
                  <p className="text-xs text-slate-400">Sincronizando sus archivos en tiempo real.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    
                    {/* 1. CURSO / ARCHIVO */}
                    <div>
                      <label className="text-xs font-bold text-purple-800 uppercase flex items-center gap-1">
                        🏫 Archivo / Curso:
                      </label>
                      <select
                        className="w-full border-2 border-purple-300 rounded-lg h-10 px-3 bg-white font-bold text-slate-800 mt-1 shadow-sm focus:ring-2 focus:ring-purple-600 outline-none cursor-pointer text-xs"
                        value={indiceCursoSeleccionado}
                        onChange={(e) => cambiarCursoNube(Number(e.target.value))}
                      >
                        {datosNube.map((c, idx) => (
                          <option key={idx} value={idx}>{c.curso}</option>
                        ))}
                      </select>
                    </div>

                    {/* 2. MATERIA */}
                    <div>
                      <label className="text-xs font-bold text-purple-700 uppercase flex items-center gap-1">
                        <BookOpen className="w-4 h-4"/> Materia:
                      </label>
                      <select
                        className="w-full border border-slate-300 rounded-lg h-10 px-3 bg-white font-bold text-slate-800 mt-1 shadow-sm focus:ring-2 focus:ring-purple-600 outline-none cursor-pointer text-xs"
                        value={indiceMateriaSeleccionada}
                        onChange={(e) => cambiarMateriaNube(Number(e.target.value))}
                      >
                        {cursoActualObj?.materias.map((m, idx) => (
                          <option key={idx} value={idx}>{m.nombreMateria}</option>
                        ))}
                      </select>
                    </div>

                    {/* 3. ACTIVIDAD (CON FECHA FORMATEADA EN EL SELECTOR) */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        📝 Tarea a Notificar:
                      </label>
                      <select 
                        className="w-full border border-slate-300 rounded-lg h-10 px-3 bg-white font-bold text-slate-800 mt-1 shadow-sm focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer text-xs"
                        value={columnaSeleccionada || ""}
                        onChange={(e) => setColumnaSeleccionada(Number(e.target.value))}
                      >
                        {materiaActualObj?.actividades.map(a => (
                          <option key={a.colIndex} value={a.colIndex}>{formatearTituloActividad(a.tituloCompleto)}</option>
                        ))}
                      </select>
                    </div>

                  </div>

                  {/* LISTA DE ALUMNOS Y NOTAS DE LA NUBE */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 p-3 border-b flex justify-between items-center">
                      <span className="font-bold text-sm text-slate-700">
                        Materia: <span className="text-purple-700">{materiaActualObj?.nombreMateria || 'Materia'}</span> • Tarea: <span className="text-slate-900">{formatearTituloActividad(actividadActualObj?.tituloCompleto || 'Tarea')}</span>
                      </span>
                      <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full border border-purple-200">
                        {actividadActualObj?.alumnos.length || 0} Alumnos
                      </span>
                    </div>

                    <ul className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                      {!actividadActualObj || actividadActualObj.alumnos.length === 0 ? (
                        <li className="p-6 text-center text-slate-500">No hay estudiantes cargados para la actividad seleccionada.</li>
                      ) : (
                        actividadActualObj.alumnos.map((item, idx) => {
                          
                          const estudianteDB = students.find(s => coincidenNombres(s.nombres, item.nombre));
                          const claveNotif = `${item.nombre}_${indiceCursoSeleccionado}_${indiceMateriaSeleccionada}_${columnaSeleccionada}`;
                          const yaNotificadoNota = notificadosNotas.has(claveNotif);
                          
                          const instName = settings?.institutionName?.toUpperCase() || "UNIDAD EDUCATIVA FISCAL MODESTO ENRIQUE SUÁREZ PIMENTEL";
                          const docName = settings?.teacherName || "El Docente";
                          const telefonoParaEnviar = estudianteDB?.telefono_representante || estudianteDB?.telefono_estudiante;

                          // TITULO CON FECHA LIMPIA EN ESPAÑOL
                          const tituloActividadLimpio = formatearTituloActividad(actividadActualObj?.tituloCompleto || "");

                          const mensajeNota = `${instName}\n\nEstimado representante, le informamos sobre la calificación de su representado(a) *${item.nombre}*:\n\n📚 *Materia:* ${materiaActualObj?.nombreMateria}\n📝 *Actividad:* ${tituloActividadLimpio}\n📊 *Calificación:* ${item.nota} / 10\n\n*Agradecemos su continuo seguimiento en el proceso educativo.*\n\n*Atentamente,*\n*${docName}*`;

                          return (
                            <li key={idx} className={`p-3 flex justify-between items-center transition-colors ${yaNotificadoNota ? 'bg-slate-50 opacity-70' : 'hover:bg-slate-50'}`}>
                              <div className="min-w-0 flex-1 pr-4">
                                <p className={`font-bold text-sm truncate ${yaNotificadoNota ? 'text-slate-500' : 'text-slate-800'}`}>{item.nombre}</p>
                                <p className="text-xs text-slate-500">
                                  Nota: <span className="font-extrabold text-purple-700 text-sm px-1.5 py-0.5 bg-purple-50 rounded border border-purple-200">{item.nota}</span> • Rep: <span className="font-mono">{telefonoParaEnviar || <span className="text-red-500 font-medium">Sin número en sistema</span>}</span>
                                </p>
                              </div>

                              <Button
                                size="sm"
                                className={`shrink-0 ${yaNotificadoNota ? 'bg-slate-200 text-slate-500' : 'bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold shadow-sm'}`}
                                disabled={!telefonoParaEnviar || yaNotificadoNota}
                                onClick={() => {
                                  if (telefonoParaEnviar) {
                                    const phoneLimpio = String(telefonoParaEnviar).replace(/\D/g, "");
                                    window.open(`https://wa.me/593${phoneLimpio}?text=${encodeURIComponent(mensajeNota)}`, '_blank');
                                    setNotificadosNotas(prev => new Set(prev).add(claveNotif));
                                  }
                                }}
                              >
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
              <Button className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold" onClick={() => setIsGradesModalOpen(false)}>Cerrar Módulo Nube</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MENSAJE MANUAL */}
      {isNotifyModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="p-4 sm:p-6 bg-slate-100 flex justify-between items-center border-b shrink-0">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-amber-600"/> Notificar Mensaje Manual
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsNotifyModalOpen(false)}>
                <X className="h-5 w-5"/>
              </Button>
            </div>
            
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6">
              
              <div className="space-y-2">
                 <label className="text-sm font-semibold text-slate-700">1. Escriba el mensaje que desea enviar:</label>
                 <textarea
                   className="w-full border border-slate-200 rounded-xl p-3 bg-white font-medium min-h-[120px] focus:ring-2 focus:ring-amber-500 outline-none resize-y shadow-sm"
                   value={bulkMessage}
                   onChange={(e) => setBulkMessage(e.target.value)}
                   spellCheck={true}
                   lang="es"
                   autoCorrect="on"
                   autoCapitalize="sentences"
                   placeholder="Escriba su mensaje aquí..."
                 />
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 items-start">
                <Paperclip className="text-blue-600 w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-blue-800">¿Desea enviar una foto o documento?</h4>
                  <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                    Al presionar "Enviar", la aplicación abrirá su WhatsApp con el texto listo. Por políticas de seguridad, <b>deberá adjuntar su foto o archivo manualmente usando el ícono del clip (📎) dentro de WhatsApp</b> antes de enviar el mensaje final.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                 <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                   <span className="font-bold text-sm text-slate-700">2. Enviar a cada representante:</span>
                 </div>
                 
                 <ul className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                   {filteredStudents.length === 0 ? (
                     <li className="p-6 text-center text-slate-500 text-sm font-medium">No hay alumnos para mostrar.</li>
                   ) : (
                     filteredStudents.map(s => {
                       const yaEnviado = notificadosIndividuales.has(s.id);
                       const telefonoManual = s.telefono_representante || s.telefono_estudiante;
                       return (
                         <li key={s.id} className={`p-3 flex justify-between items-center transition-colors ${yaEnviado ? 'bg-slate-50 opacity-70' : 'hover:bg-slate-50'}`}>
                           <div className="min-w-0 flex-1 pr-4">
                             <p className={`font-bold text-sm truncate ${yaEnviado ? 'text-slate-500' : 'text-slate-800'}`}>{s.nombres}</p>
                             <p className="text-xs text-slate-500">Rep: <span className="font-mono">{telefonoManual || <span className="text-red-500 font-medium">Sin número</span>}</span></p>
                           </div>
                           <Button
                             size="sm"
                             className={`shrink-0 ${yaEnviado ? 'bg-slate-200 hover:bg-slate-200 text-slate-500' : 'bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-sm'}`}
                             disabled={!telefonoManual || yaEnviado}
                             onClick={() => {
                               if(telefonoManual) {
                                 const formattedPhone = String(telefonoManual).replace(/\D/g, "");
                                 window.open(`https://wa.me/593${formattedPhone}?text=${encodeURIComponent(bulkMessage)}`, '_blank');
                                 setNotificadosIndividuales(prev => new Set(prev).add(s.id));
                               }
                             }}
                           >
                             {yaEnviado ? <><CheckCircle className="w-4 h-4 mr-1.5"/> Enviado</> : <><MessageCircle className="w-4 h-4 mr-1.5"/> Enviar</>}
                           </Button>
                         </li>
                       );
                     })
                   )}
                 </ul>
              </div>
            </div>
            
            <div className="p-4 border-t bg-slate-50 shrink-0">
              <Button className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold" onClick={() => setIsNotifyModalOpen(false)}>Cerrar Panel</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES CRUD ACTUALIZADOS */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 bg-slate-100 flex justify-between items-center border-b sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-800">Agregar Estudiante</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)}>
                <X className="h-5 w-5"/>
              </Button>
            </div>
            <form onSubmit={handleAddStudent} className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                {fotoUrl ? (
                  <img src={fotoUrl} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" alt="Vista previa" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs text-center p-2">Sin Foto</div>
                )}
                <input type="file" id="file-upload-add" accept="image/*" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm w-full sm:w-auto" onClick={() => document.getElementById("file-upload-add")?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Subir Foto de Galería
                </Button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombres y Apellidos Completos</label>
                <Input required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. NEIRA JACOME, SHENOA" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Curso</label>
                <select className="w-full border border-slate-200 rounded-lg h-10 px-3 bg-white font-medium" value={curso} onChange={e => setCurso(e.target.value)}>
                  {Object.keys(COURSE_ORDER).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono Representante</label>
                <Input value={telRepresentante} onChange={e => setTelRepresentante(e.target.value)} placeholder="Ej. 0987654321" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono Estudiante</label>
                <Input value={telEstudiante} onChange={e => setTelEstudiante(e.target.value)} placeholder="Ej. 0912345678" />
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddModalOpen(false)} disabled={isUploading}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 flex-1 text-white font-bold" disabled={isUploading}>
                  {isUploading ? "Subiendo..." : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 bg-slate-100 flex justify-between items-center border-b sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-800">Editar Estudiante</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsEditModalOpen(false)}>
                <X className="h-5 w-5"/>
              </Button>
            </div>
            <form onSubmit={handleEditStudent} className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                {fotoUrl ? (
                  <img src={fotoUrl} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" alt="Vista previa" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs text-center p-2">Sin Foto</div>
                )}
                <input type="file" id="file-upload-edit" accept="image/*" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm w-full sm:w-auto" onClick={() => document.getElementById("file-upload-edit")?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Subir Foto de Galería
                </Button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombres y Apellidos Completos</label>
                <Input required value={nombre} onChange={e => setNombre(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Curso</label>
                <select className="w-full border border-slate-200 rounded-lg h-10 px-3 bg-white font-medium" value={curso} onChange={e => setCurso(e.target.value)}>
                  {Object.keys(COURSE_ORDER).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono Representante</label>
                <Input value={telRepresentante} onChange={e => setTelRepresentante(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono Estudiante</label>
                <Input value={telEstudiante} onChange={e => setTelEstudiante(e.target.value)} />
              </div>
              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-between">
                <Button type="button" variant="destructive" className="bg-red-600 hover:bg-red-700 font-bold w-full sm:w-auto mb-2 sm:mb-0" onClick={() => handleDeleteStudent(selectedStudent.id)}>Eliminar</Button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditModalOpen(false)} disabled={isUploading}>Cancelar</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1" disabled={isUploading}>
                    {isUploading ? "Subiendo..." : "Actualizar"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PANEL SUPERIOR DE BOTONES */}
      <div className="flex flex-col gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Estudiantes</h1>
          <div className="flex items-center text-blue-600 bg-blue-50 px-4 py-2 rounded-full font-semibold text-sm border border-blue-100 w-full sm:w-auto justify-center">
            <Users className="w-4 h-4 mr-2" />
            Total: {students.length} Estudiantes
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 w-full">
          <Button className="bg-indigo-600 hover:bg-indigo-700 h-12 w-full">
            <Camera className="mr-2 h-5 w-5"/> Cámara IA
          </Button>
          <Button onClick={() => setEscaneandoQR(true)} className="bg-blue-600 hover:bg-blue-700 h-12 w-full">
            <ScanLine className="mr-2 h-5 w-5"/> Cámara QR
          </Button>
          <Button onClick={printAllCredentials} className="bg-emerald-700 hover:bg-emerald-800 h-12 w-full">
            <Printer className="mr-2 h-5 w-5"/> Imprimir Curso
          </Button>
          <Button onClick={() => setIsNotifyModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 h-12 w-full">
            <Megaphone className="mr-2 h-5 w-5"/> Mensaje Manual
          </Button>

          {/* BOTÓN MORADO CONECTADO A GOOGLE DRIVE NUBE */}
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
            <Input className="h-12 text-base sm:text-lg bg-white w-full" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="border rounded-md px-4 h-12 bg-white w-full sm:w-64" value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
              <option value="Todos">Todos los cursos</option>
              {Object.keys(COURSE_ORDER).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="flex justify-between items-center bg-white p-3 border rounded-xl shadow-sm">
            <p className="text-slate-500 font-semibold px-1 text-sm sm:text-base">Resultados en pantalla: {filteredStudents.length} alumnos</p>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors border">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                checked={ocultarEnviados}
                onChange={(e) => setOcultarEnviados(e.target.checked)}
              />
              👁️ Ocultar ya notificados
            </label>
          </div>
      </div>

      {/* TARJETAS DE ESTUDIANTES */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredStudents.map((s, index) => {
           const telefonoDirecto = s.telefono_representante || s.telefono_estudiante;
           return (
          <div key={s.id} className="bg-white p-4 sm:p-6 rounded-3xl border shadow-sm space-y-4 relative">
            <div className="flex items-start justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-5">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-200 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0">
                  {s.fotos_rostro && s.fotos_rostro[0] ? (
                    <img src={s.fotos_rostro[0]} className="w-full h-full object-cover" alt="Foto" />
                  ) : <span className="flex items-center justify-center h-full font-bold text-2xl sm:text-3xl text-slate-400">{index + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-base sm:text-lg text-slate-900 leading-tight uppercase whitespace-normal break-words">{s.nombres}</h2>
                  <p className="text-xs sm:text-sm text-slate-500">{s.curso}</p>
                  
                  <div className="space-y-0.5 pt-1 sm:pt-2 border-t border-slate-100 mt-1 sm:mt-2">
                      <p className="text-[10px] sm:text-xs text-slate-400">Rep: <span className="font-mono text-slate-600">{s.telefono_representante || 'N/D'}</span></p>
                      <p className="text-[10px] sm:text-xs text-slate-400">Est: <span className="font-mono text-slate-600">{s.telefono_estudiante || 'N/D'}</span></p>
                  </div>
                </div>
              </div>

              <Button onClick={() => openEditModal(s)} variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600 flex-shrink-0">
                <Pencil className="h-5 w-5" />
              </Button>
            </div>

            <div id={`qr-hidden-${s.id}`} className="hidden">
               <QRCodeSVG value={s.id} size={200} />
            </div>

            <Button onClick={() => printCredential(s)} variant="secondary" className="w-full h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm">
               <Printer className="mr-2 h-4 w-4" /> Generar Credencial Oficial
            </Button>

            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              <Button 
                onClick={() => setEstatusAlerta(prev => ({...prev, [s.id]: "Presente"}))} 
                className={`h-12 text-xs sm:text-sm font-bold transition-colors p-1 sm:p-4 ${estatusAlerta[s.id] === "Presente" ? "bg-[#00a651] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                Presente
              </Button>
              <Button 
                onClick={() => setEstatusAlerta(prev => ({...prev, [s.id]: "Atrasado"}))} 
                className={`h-12 text-xs sm:text-sm font-bold transition-colors p-1 sm:p-4 ${estatusAlerta[s.id] === "Atrasado" ? "bg-[#ff9900] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                Atrasado
              </Button>
              <Button 
                onClick={() => setEstatusAlerta(prev => ({...prev, [s.id]: "Ausente"}))} 
                className={`h-12 text-xs sm:text-sm font-bold transition-colors p-1 sm:p-4 ${estatusAlerta[s.id] === "Ausente" ? "bg-[#e3000f] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                Ausente
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              className={`w-full h-12 font-bold text-xs sm:text-sm transition-all ${
                notificadosIndividuales.has(s.id) 
                  ? "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200" 
                  : "text-green-700 border-green-600 hover:bg-green-50"
              }`} 
              onClick={() => sendWhatsApp(s, estatusAlerta[s.id] || "Recordatorio")}
            >
              {notificadosIndividuales.has(s.id) ? (
                <><CheckCircle className="mr-2 h-4 sm:h-5 w-4 sm:w-5"/> Ya Notificado</>
              ) : (
                <><MessageCircle className="mr-2 h-4 sm:h-5 w-4 sm:w-5"/> WhatsApp Directo</>
              )}
            </Button>
          </div>
        )})}
      </div>

      <div className="sticky bottom-4 sm:bottom-6 p-4 bg-slate-900 rounded-2xl shadow-2xl text-white flex flex-col sm:flex-row justify-between items-center text-center gap-3 mt-10 z-10">
        <span className="text-sm sm:text-lg font-bold">Fecha: {fechaActual}</span>
        <Button onClick={finalizarAsistenciaJornada} className="bg-emerald-600 hover:bg-emerald-700 text-base sm:text-lg px-4 sm:px-8 py-4 sm:py-6 font-bold shadow-lg w-full sm:w-auto">
            <Save className="mr-2"/> Guardar Asistencia
        </Button>
      </div>
    </div>
  )
}