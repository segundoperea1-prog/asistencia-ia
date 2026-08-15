"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Fingerprint, ScanFace, Loader2, KeyRound } from "lucide-react"
import { useApp } from "@/lib/app-context"

export function LoginScreen() {
  const { setIsAuthenticated } = useApp()
  const [isScanning, setIsScanning] = useState(false)

  const handleBiometricLogin = async () => {
    setIsScanning(true)
    // Simula una pequeña carga y fuerza la entrada
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsScanning(false)
    setIsAuthenticated(true)
  }

  const bypassLogin = () => {
    // Función directa y sin esperas para entrar en modo desarrollo
    setIsAuthenticated(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-card/95 backdrop-blur">
        <CardContent className="pt-8 pb-10 px-6 flex flex-col items-center gap-6">
          {/* Escudo institucional */}
          <Image
            src="/Logo_modesto-fondo.png"
            alt="Escudo Unidad Educativa Fiscal Modesto Enrique Suárez Pimentel"
            width={128}
            height={128}
            className="h-32 w-32 object-contain"
            priority
          />

          {/* Título institucional */}
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold text-foreground leading-snug max-w-xs">
              Unidad Educativa Fiscal Modesto Enrique Suárez Pimentel
            </h1>
          </div>

          {/* Perfil del profesor */}
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/El_profe_Segundo_fondo.png"
              alt="Profe Segundo"
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/20"
            />
            <p className="text-sm font-medium text-muted-foreground">Profe Segundo</p>
          </div>

          {/* Biometric Login Button Original */}
          <Button
            onClick={handleBiometricLogin}
            disabled={isScanning}
            size="lg"
            className="w-full h-16 text-lg font-semibold gap-3 shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Escaneando...
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-6 h-6" />
                  <ScanFace className="w-6 h-6" />
                </div>
                Acceder con Biometría
              </>
            )}
          </Button>

          {/* NUEVO BOTÓN DE ACCESO DIRECTO PARA DESARROLLO */}
          <Button
            onClick={bypassLogin}
            variant="secondary"
            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold"
          >
            <KeyRound className="w-4 h-4 mr-2" />
            Acceso Directo (Pruebas)
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Use su huella dactilar o reconocimiento facial para acceder
          </p>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground">
        © 2026 Asistencia IA - Todos los derechos reservados
      </p>
    </div>
  )
}