"use client"

import { useEffect, useRef, useState } from "react"
import * as faceapi from "@vladmandic/face-api"
import { X, Loader2, ScanFace, Fingerprint, Flashlight, FlashlightOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CameraIAProps {
  onClose: () => void;
  onDescriptorCaptured?: (descriptor: Float32Array) => void;
}

export function CameraIA({ onClose, onDescriptorCaptured }: CameraIAProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingText, setLoadingText] = useState("Optimizando para Honor X7a...");
  const [error, setError] = useState("");
  const [biometriaLista, setBiometriaLista] = useState(false);
  
  // ESTADOS DE LA LINTERNA (FLASH)
  const [isTorchOn, setIsTorchOn] = useState(true); 
  const [hasTorchMode, setHasTorchMode] = useState(false);

  useEffect(() => {
    const loadModelsAndStart = async () => {
      try {
        const MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        setIsModelLoaded(true);
        setLoadingText("Encendiendo cámara trasera...");

        // ARQUITECTURA MÓVIL: Solicitando específicamente la cámara trasera
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { exact: "environment" } // Obliga a usar la cámara principal
          } 
        }).catch(async () => {
          // Fallback por si la cámara exacta falla (algunos navegadores requieren esto)
          return await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        });
        
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // VALIDACIÓN DE HARDWARE: Linterna (Torch API)
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as any;

        if (capabilities.torch) {
          setHasTorchMode(true);
          // Encendemos el flash por defecto
          try {
            await track.applyConstraints({ advanced: [{ torch: true }] } as any);
          } catch (e) {
            console.warn("El navegador bloqueó el encendido automático de la linterna.");
            setIsTorchOn(false);
          }
        }

      } catch (err: any) {
        console.error("Error de Hardware:", err);
        setError("Error al iniciar cámara. Compruebe los permisos en el navegador de su teléfono.");
      }
    };

    loadModelsAndStart();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          // Apagamos la linterna al desmontar la cámara para ahorrar batería
          if ((track.getCapabilities() as any).torch) {
             track.applyConstraints({ advanced: [{ torch: false }] } as any).catch(() => {});
          }
          track.stop();
        });
      }
    };
  }, []);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const newState = !isTorchOn;
      await track.applyConstraints({ advanced: [{ torch: newState }] } as any);
      setIsTorchOn(newState);
    } catch (error) {
      console.error("Error controlando linterna:", error);
    }
  };

  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    // ACELERACIÓN TÉRMICA: Cambiado de 150ms a 800ms para procesador Mediatek
    const interval = setInterval(async () => {
      if (videoRef.current && canvasRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        try {
          const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
          }

          if (detections.length > 0) {
            setBiometriaLista(true);
            if (onDescriptorCaptured) {
              onDescriptorCaptured(detections[0].descriptor);
            }
          } else {
            setBiometriaLista(false);
          }

        } catch (e) {}
      }
    }, 800); // <--- Punto clave para evitar el colapso del móvil

    return () => clearInterval(interval);
  };

  return (
    // Diseño responsivo: Ocupa toda la pantalla en móviles
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center sm:p-4 sm:backdrop-blur-md">
      <div className="w-full h-full sm:h-auto sm:max-w-3xl bg-black sm:bg-white sm:rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        <div className="p-4 bg-indigo-600 flex justify-between items-center border-b border-indigo-700 z-10">
          <h3 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
            <ScanFace className="h-5 w-5"/> Escáner Móvil (Cámara Trasera)
          </h3>
          <div className="flex gap-2">
            {/* BOTÓN DE LINTERNA DINÁMICO */}
            {hasTorchMode && (
              <Button variant="secondary" size="icon" className="bg-white/20 hover:bg-white/30 text-white border-0" onClick={toggleTorch}>
                {isTorchOn ? <Flashlight className="h-5 w-5"/> : <FlashlightOff className="h-5 w-5"/>}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="text-white hover:bg-indigo-700" onClick={onClose}>
              <X className="h-6 w-6"/>
            </Button>
          </div>
        </div>
        
        <div className="relative w-full flex-1 bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <p className="text-red-400 font-bold p-6 text-center bg-red-900/20 rounded-xl m-4 border border-red-500/30">{error}</p>
          ) : !isModelLoaded ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
              <p className="font-semibold text-center px-4">{loadingText}</p>
            </div>
          ) : null}

          <video 
            ref={videoRef} autoPlay muted playsInline onPlay={handleVideoPlay}
            className={`w-full h-full object-cover ${isModelLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
          
          {biometriaLista && (
            <div className="absolute bottom-6 bg-emerald-500 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 animate-pulse shadow-lg z-50 text-sm">
              <Fingerprint className="w-4 h-4" /> Huella en procesamiento...
            </div>
          )}
        </div>

        <div className="p-4 flex flex-col items-center justify-center text-center bg-slate-900 sm:bg-slate-50 border-t border-slate-800 sm:border-slate-200 z-10">
          <p className="text-white sm:text-slate-800 text-sm font-bold">Enfoque al estudiante con la cámara trasera.</p>
          <p className="text-slate-400 sm:text-slate-500 text-xs mt-1">Aceleración térmica activada para optimizar batería.</p>
        </div>
      </div>
    </div>
  )
}