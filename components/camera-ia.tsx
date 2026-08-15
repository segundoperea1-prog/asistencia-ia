"use client"

import { useEffect, useRef, useState } from "react"
import * as faceapi from "@vladmandic/face-api"
import { X, Loader2, ScanFace } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CameraIAProps {
  onClose: () => void;
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
        // Usamos una ruta CDN alternativa y segura para los modelos de reconocimiento facial
        const MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
        
        setLoadingText("Descargando redes neuronales...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        setIsModelLoaded(true);
        setLoadingText("Encendiendo cámara web...");

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error IA:", err);
        setError("No se pudieron cargar los modelos de IA. Verifique su conexión a internet o los permisos de la cámara.");
      }
    };

    loadModelsAndStart();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    const interval = setInterval(async () => {
      if (videoRef.current && canvasRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        try {
          const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
          }
        } catch (e) {
          // Evita interrupciones en bucles de renderizado si la cámara cambia de estado
        }
      }
    }, 150);

    return () => clearInterval(interval);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        <div className="p-4 bg-indigo-600 flex justify-between items-center border-b">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ScanFace className="h-6 w-6"/> Escáner de Reconocimiento Facial (IA)
          </h3>
          <Button variant="ghost" size="icon" className="text-white hover:bg-indigo-700" onClick={onClose}>
            <X className="h-6 w-6"/>
          </Button>
        </div>
        
        <div className="relative w-full bg-black aspect-video flex items-center justify-center overflow-hidden">
          {error ? (
            <p className="text-red-500 font-bold p-6 text-center bg-white/10 rounded-xl max-w-lg">{error}</p>
          ) : !isModelLoaded ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
              <p className="font-semibold text-lg">{loadingText}</p>
              <p className="text-xs text-slate-400 max-w-sm text-center">Configurando la inteligencia artificial por primera vez. Esto puede tardar unos segundos...</p>
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
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        </div>

        <div className="p-5 flex flex-col items-center justify-center text-center bg-slate-50 border-t">
          <p className="text-slate-800 text-base font-bold">Mire fijamente hacia la cámara.</p>
          <p className="text-slate-500 text-xs mt-0.5">El sistema rastreará los puntos biométricos faciales en tiempo real.</p>
        </div>
      </div>
    </div>
  )
}