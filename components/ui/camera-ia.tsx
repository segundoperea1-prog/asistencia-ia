"use client"

import { useEffect, useRef, useState } from "react"
import * as faceapi from "@vladmandic/face-api"
import { X, Loader2, ScanFace } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CameraIAProps {
  onClose: () => void;
  // En el siguiente paso pasaremos la lista de alumnos para compararlos
}

export function CameraIA({ onClose }: CameraIAProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingText, setLoadingText] = useState("Cargando Cerebro IA...");
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;

    const loadModelsAndStart = async () => {
      try {
        // Usamos un CDN ultra rápido para los modelos (No necesitas descargar nada manual)
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        
        // Cargamos las 3 redes neuronales clave
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        setIsModelLoaded(true);
        setLoadingText("Encendiendo cámara...");

        // Solicitar permiso e Iniciar cámara web
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error IA:", err);
        setError("Error al acceder a la cámara o cargar IA. Verifique permisos del navegador.");
      }
    };

    loadModelsAndStart();

    // Limpieza: Apagar la cámara cuando cerramos la ventana
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Ajustar el lienzo (canvas) al tamaño del video en vivo
    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    // Bucle de Inteligencia Artificial (se ejecuta cada 100 milisegundos)
    setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        
        // 1. Detectar el rostro
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();

        // 2. Dibujar el recuadro sobre el rostro en pantalla
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections); // Dibuja los puntos de la cara
        }
      }
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        {/* Cabecera */}
        <div className="p-4 bg-indigo-600 flex justify-between items-center border-b">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ScanFace className="h-6 w-6"/> Escáner de Reconocimiento Facial
          </h3>
          <Button variant="ghost" size="icon" className="text-white hover:bg-indigo-700" onClick={onClose}>
            <X className="h-6 w-6"/>
          </Button>
        </div>
        
        {/* Contenedor de Video Mágico */}
        <div className="relative w-full bg-black aspect-video flex items-center justify-center overflow-hidden">
          {error ? (
            <p className="text-red-500 font-bold p-4 text-center">{error}</p>
          ) : !isModelLoaded ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <p className="font-semibold text-lg">{loadingText}</p>
              <p className="text-sm text-slate-400 max-w-sm text-center">Descargando redes neuronales seguras. Esto tomará unos segundos la primera vez...</p>
            </div>
          ) : null}

          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline
            onPlay={handleVideoPlay}
            className={`w-full h-full object-cover ${isModelLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 w-full h-full"
          />
        </div>

        {/* Pie del modal */}
        <div className="p-6 h-32 flex flex-col items-center justify-center text-center bg-slate-50">
          <p className="text-slate-800 text-lg font-bold">Mire fijamente a la cámara.</p>
          <p className="text-slate-500 text-sm mt-1">El sistema detectará su rostro usando IA en tiempo real.</p>
        </div>
      </div>
    </div>
  )
}