'use client'

import { useState, useEffect } from 'react'
import Chat from '@/components/Chat'
import NetworkInfo from '@/components/NetworkInfo'
import ServerConnection from '@/components/ServerConnection'

export default function Home() {
  const [serverIP, setServerIP] = useState('')
  const [networkName, setNetworkName] = useState('')
  const [connected, setConnected] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const detectNetworkName = () => {
      if ('connection' in navigator) {
        try {
          const connection = (navigator as any).connection
          if (connection && 'ssid' in connection && connection.ssid) {
            setNetworkName(connection.ssid)
            return
          }
        } catch (e) {
        }
      }
    }

    detectNetworkName()
  }, [])

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Chat en Red Local
          </h1>
          <p className="text-slate-300 text-lg">
            Conéctate a un servidor de chat en tu red
          </p>
        </header>

        {!connected ? (
          <ServerConnection 
            onConnect={(ip: string) => {
              setServerIP(ip)
              setConnected(true)
            }}
          />
        ) : (
          <>
            <NetworkInfo serverIP={serverIP} networkName={networkName} />
            <Chat serverIP={serverIP} networkName={networkName} />
          </>
        )}
      </div>
    </main>
  )
}
