'use client'

interface NetworkInfoProps {
  networkName?: string
  serverIP: string
}

export default function NetworkInfo({ networkName, serverIP }: NetworkInfoProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700 shadow-lg">
      <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        <span className="text-blue-400">📡</span>
        Información de Conexión
      </h2>
      
      <div className="space-y-3">
        {networkName ? (
          <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
            <span className="text-slate-300">Red WiFi:</span>
            <span className="text-slate-100 font-semibold">{networkName}</span>
          </div>
        ) : (
          <div className="p-3 bg-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-400">
              💡 El nombre de la red WiFi solo se puede detectar en algunos navegadores (Chrome/Edge en Android). 
              Por seguridad, la mayoría de navegadores no permiten acceso al SSID.
            </p>
          </div>
        )}
        
        <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
          <span className="text-slate-300">Servidor conectado:</span>
          <code className="text-blue-400 font-mono font-semibold">
            {serverIP}
          </code>
        </div>
      </div>
    </div>
  )
}
