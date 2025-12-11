'use client'

import { useState, useEffect } from 'react'

interface ServerConnectionProps {
  onConnect: (ip: string) => void
}

export default function ServerConnection({ onConnect }: ServerConnectionProps) {
  const [serverIP, setServerIP] = useState('')
  const [networkName, setNetworkName] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    if (window.location.hostname === 'localhost') {
      setServerIP('localhost')
    }

    const detectNetworkName = () => {
      if ('connection' in navigator) {
        try {
          const connection = (navigator as any).connection
          if (connection && 'ssid' in connection && connection.ssid) {
            setNetworkName(connection.ssid)
            return
          }
        } catch (e) {
          console.log('Network Information API no disponible')
        }
      }
      
      setNetworkName('')
    }

    detectNetworkName()
  }, [])

  const handleConnect = () => {
    if (serverIP.trim()) {
      onConnect(serverIP.trim())
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700 shadow-lg">
      <h2 className="text-2xl font-semibold mb-4">
        Conectar al Servidor
      </h2>
      
      <div className="space-y-4">
        {networkName && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
            <p className="text-sm text-slate-300">
              <strong className="text-blue-400">📶 Red actual:</strong> {networkName}
            </p>
          </div>
        )}
        
        <div>
          <label htmlFor="server-ip" className="block text-slate-300 mb-2">
            IP del Servidor:
          </label>
          <input
            id="server-ip"
            type="text"
            value={serverIP}
            onChange={(e) => setServerIP(e.target.value)}
            placeholder={mounted && window.location.hostname === 'localhost' 
              ? 'localhost (para desarrollo local)' 
              : 'Ej: 192.168.1.100 o localhost'}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-2">
            {mounted && window.location.hostname === 'localhost' 
              ? '💡 Usa "localhost" para probar en la misma máquina, o la IP para probar desde otro dispositivo'
              : 'Ingresa la IP del servidor que está ejecutándose en tu red'}
          </p>
        </div>

        <button
          onClick={handleConnect}
          disabled={!serverIP.trim()}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Conectar
        </button>
      </div>
    </div>
  )
}
