'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { E2ECrypto } from '@/utils/crypto'

interface Message {
  nickname: string
  userIP: string
  message: string
  timestamp: string
  encrypted?: boolean
  encryptedData?: string
  iv?: string
  publicKey?: string
}

interface User {
  nickname: string
  userIP: string
  socketId: string
  publicKey?: string
}

interface ChatProps {
  serverIP: string
  networkName?: string
}

export default function Chat({ serverIP, networkName }: ChatProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [nickname, setNickname] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [userIP, setUserIP] = useState('')
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [cryptoInstance, setCryptoInstance] = useState<E2ECrypto | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (E2ECrypto.isSupported()) {
      const crypto = new E2ECrypto()
      crypto.generateKeyPair().then(() => {
        setCryptoInstance(crypto)
        setEncryptionEnabled(true)
      }).catch((error) => {
        console.error('Error inicializando cifrado:', error)
        setEncryptionEnabled(false)
      })
    } else {
      console.warn('Cifrado no soportado en este navegador')
      setEncryptionEnabled(false)
    }
  }, [])

  useEffect(() => {
    fetch(`http://${serverIP}:5000/api/client-ip`)
      .then(res => res.json())
      .then(data => {
          setUserIP(data.ip || 'Desconocida')
        })
      .catch(() => setUserIP('Desconocida'))
  }, [serverIP])

  useEffect(() => {
    if (nickname && serverIP && cryptoInstance) {
      const socketUrl = `http://${serverIP}:5000`
      
      console.log('Conectando a WebSocket:', socketUrl)
      
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
        })

      newSocket.on('connect', async () => {
          setConnected(true)
          const publicKey = await cryptoInstance.exportPublicKey()
          newSocket.emit('join', { nickname, userIP, publicKey })
        })

      newSocket.on('disconnect', () => {
          setConnected(false)
        })

      newSocket.on('message', async (data: Message) => {
          try {
            let decryptedMessage = data.message
            
            if (data.encrypted && data.encryptedData && data.iv && data.publicKey) {
              const senderId = `${data.nickname}_${data.userIP}`
              decryptedMessage = await cryptoInstance.decryptMessage(
                data.encryptedData,
                data.iv,
                data.publicKey,
                senderId
              )
            }
            
            setMessages(prev => [...prev, {
              ...data,
              message: decryptedMessage
            }])
          } catch (error) {
            console.error('Error procesando mensaje:', error)
            setMessages(prev => [...prev, {
              ...data,
              message: '[Mensaje cifrado - Error al descifrar]'
            }])
          }
        })

      newSocket.on('userJoined', async (data: Message & { publicKey?: string }) => {
          if (data.publicKey && cryptoInstance) {
            const userId = `${data.nickname}_${data.userIP}`
            try {
              await cryptoInstance.deriveSharedKey(data.publicKey, userId)
            } catch (error) {
              console.error('Error derivando clave compartida:', error)
            }
          }
          
          setMessages(prev => [...prev, data])
        })

      newSocket.on('userLeft', (data: Message) => {
          setMessages(prev => [...prev, data])
        })

      newSocket.on('usersList', async (usersList: User[]) => {
          setUsers(usersList)
          
          if (cryptoInstance) {
            for (const user of usersList) {
              if (user.publicKey && user.socketId !== newSocket.id) {
                const userId = `${user.nickname}_${user.userIP}`
                try {
                  await cryptoInstance.deriveSharedKey(user.publicKey, userId)
                } catch (error) {
                  console.error(`Error derivando clave con ${user.nickname}:`, error)
                }
              }
            }
          }
        })

      newSocket.on('usersUpdate', (usersList: User[]) => {
          setUsers(usersList)
        })

      setSocket(newSocket)

      return () => {
          newSocket.close()
        }
    }
  }, [nickname, serverIP, userIP, cryptoInstance])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (nicknameInput.trim()) {
      setNickname(nicknameInput.trim())
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !socket || !connected) return

    try {
      if (encryptionEnabled && cryptoInstance && users.length > 1) {
        const messageText = messageInput.trim()
        const myPublicKey = await cryptoInstance.exportPublicKey()
        
        for (const user of users) {
          if (user.socketId !== socket.id && user.publicKey) {
            const userId = `${user.nickname}_${user.userIP}`
            try {
              const encrypted = await cryptoInstance.encryptMessage(messageText, userId)
              
              socket.emit('encryptedMessage', {
                targetSocketId: user.socketId,
                encryptedData: encrypted.encryptedData,
                iv: encrypted.iv,
                publicKey: myPublicKey
              })
            } catch (error) {
              console.error(`Error cifrando para ${user.nickname}:`, error)
            }
          }
        }
        
        setMessages(prev => [...prev, {
          nickname,
          userIP,
          message: messageText,
          timestamp: new Date().toISOString(),
          encrypted: true
        }])
      } else {
        socket.emit('message', { message: messageInput.trim() })
      }
      
      setMessageInput('')
    } catch (error) {
      console.error('Error enviando mensaje:', error)
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!nickname) {
    return (
      <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Únete al Chat
        </h2>
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="nickname" className="block text-slate-300 mb-2">
              Nombre de usuario:
            </label>
            <input
              id="nickname"
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="Ingresa tu nombre"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          {encryptionEnabled && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400">
                🔒 Cifrado end-to-end activado
              </p>
            </div>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors"
          >
            Entrar al Chat
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg overflow-hidden flex flex-col" style={{ height: '600px' }}>
      <div className="p-4 bg-slate-700 border-b border-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <div>
            <h2 className="text-xl font-semibold">Chat en Vivo</h2>
            <p className="text-sm text-slate-400">
              {connected ? `${users.length} usuarios conectados` : 'Desconectado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {encryptionEnabled && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span>🔒</span>
              <span>E2E</span>
            </div>
          )}
          {networkName && (
            <div className="text-sm text-slate-300">
              Red: <span className="text-blue-400">{networkName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-slate-700 border-r border-slate-600 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-3 text-slate-300">Usuarios ({users.length})</h3>
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.socketId}
                className="p-2 bg-slate-800 rounded border border-slate-600"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-100">{user.nickname}</div>
                  {user.publicKey && encryptionEnabled && (
                    <span className="text-xs text-green-400">🔒</span>
                  )}
                </div>
                <div className="text-xs text-slate-400">{user.userIP}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <p>No hay mensajes aún. ¡Sé el primero en escribir!</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col gap-1 ${
                    msg.nickname === nickname ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.nickname === nickname
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-100'
                    }`}
                  >
                    {msg.nickname !== nickname && (
                      <div className="text-xs font-semibold mb-1 opacity-80">
                        {msg.nickname} ({msg.userIP})
                      </div>
                    )}
                    <div className="break-words">{msg.message}</div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs opacity-70">
                        {formatTime(msg.timestamp)}
                      </div>
                      {msg.encrypted && (
                        <span className="text-xs opacity-70">🔒</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-slate-600">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={connected ? "Escribe un mensaje..." : "Conectando..."}
                disabled={!connected}
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!connected || !messageInput.trim()}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
