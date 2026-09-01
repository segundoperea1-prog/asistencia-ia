"use client"

import { LogIn, School, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface LoginScreenProps {
  onLogin: () => void;
}

// EXPORTACIÓN NOMBRADA ESTRICTA
export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [errorLogoColegio, setErrorLogoColegio] = useState(false);
  const [errorLogoProfe, setErrorLogoProfe] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8 flex flex-col items-center text-center space-y-6">
        
        <div className="w-32 h-32 mx-auto rounded-full overflow-hidden shadow-sm flex items-center justify-center bg-slate-100 border border-slate-200">
           {!errorLogoColegio ? (
             <img src="/Logo_modesto-fondo.png" alt="Logo Unidad Educativa" className="w-full h-full object-cover" onError={() => setErrorLogoColegio(true)} />
           ) : (
             <School className="w-16 h-16 text-slate-400" />
           )}
        </div>

        <h1 className="text-2xl font-bold text-slate-900 leading-tight">
          Unidad Educativa Fiscal<br/>Modesto Enrique Suárez Pimentel
        </h1>

        <div className="space-y-2 pt-2">
          <div className="w-24 h-24 mx-auto rounded-full overflow-hidden shadow-sm border border-slate-200 flex items-center justify-center bg-slate-100">
             {!errorLogoProfe ? (
               <img src="/El_profe_Segundo_fondo.png" alt="Logo Profe Segundo" className="w-full h-full object-cover" onError={() => setErrorLogoProfe(true)} />
             ) : (
               <UserCircle className="w-12 h-12 text-slate-400" />
             )}
          </div>
          <p className="text-slate-600 font-medium text-lg">Profe Segundo</p>
        </div>

        <div className="w-full pt-6">
          <Button onClick={() => onLogin()} className="w-full h-14 text-lg font-bold bg-[#1d4ed8] hover:bg-blue-700 text-white rounded-xl shadow-md transition-transform hover:scale-105 flex items-center justify-center gap-2">
            <LogIn className="w-6 h-6" /> Ingresar al Sistema
          </Button>
        </div>
      </div>
    </div>
  )
}