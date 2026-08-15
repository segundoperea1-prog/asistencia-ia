export default function OfflinePage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">Sin conexión</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        No hay internet. Puede seguir registrando asistencia; los datos se
        guardarán en este dispositivo y se sincronizarán al recuperar la red.
      </p>
    </main>
  );
}
