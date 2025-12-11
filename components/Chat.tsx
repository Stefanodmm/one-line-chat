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
  isPrivate?: boolean
  fromSocketId?: string
  isOwn?: boolean
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

interface ChatData {
  id: string
  name: string
  type: 'general' | 'private'
  targetSocketId?: string
  messages: Message[]
  unreadCount: number
}

export default function Chat({ serverIP, networkName }: ChatProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [nickname, setNickname] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [userIP, setUserIP] = useState('')
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [cryptoInstance, setCryptoInstance] = useState<E2ECrypto | null>(null)
  const [chats, setChats] = useState<Map<string, ChatData>>(new Map())
  const [activeChatId, setActiveChatId] = useState<string>('general')
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
    const generalChat: ChatData = {
      id: 'general',
      name: 'Chat General',
      type: 'general',
      messages: [],
      unreadCount: 0
    }
    setChats(new Map([['general', generalChat]]))
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
            
            setChats(prev => {
              const newChats = new Map(prev)
              const generalChat = newChats.get('general') || {
                id: 'general',
                name: 'Chat General',
                type: 'general' as const,
                messages: [],
                unreadCount: 0
              }
              
              const updatedMessages = [...generalChat.messages, {
                ...data,
                message: decryptedMessage
              }]
              
              const unreadCount = activeChatId === 'general' ? 0 : generalChat.unreadCount + 1
              
              newChats.set('general', {
                ...generalChat,
                messages: updatedMessages,
                unreadCount
              })
              
              return newChats
            })
          } catch (error) {
            console.error('Error procesando mensaje:', error)
            setChats(prev => {
              const newChats = new Map(prev)
              const generalChat = newChats.get('general') || {
                id: 'general',
                name: 'Chat General',
                type: 'general' as const,
                messages: [],
                unreadCount: 0
              }
              
              newChats.set('general', {
                ...generalChat,
                messages: [...generalChat.messages, {
                  ...data,
                  message: '[Mensaje cifrado - Error al descifrar]'
                }]
              })
              
              return newChats
            })
          }
        })

      newSocket.on('privateMessage', async (data: Message) => {
          try {
            let decryptedMessage = data.message
            const isOwn = data.isOwn || false
            const fromSocketId = data.fromSocketId || ''
            
            if (data.encrypted && data.encryptedData && data.iv && data.publicKey) {
              const senderId = `${data.nickname}_${data.userIP}`
              decryptedMessage = await cryptoInstance.decryptMessage(
                data.encryptedData,
                data.iv,
                data.publicKey,
                senderId
              )
            }
            
            setChats(prev => {
              const newChats = new Map(prev)
              const chatId = `private_${fromSocketId}`
              
              let chat = newChats.get(chatId)
              if (!chat) {
                const targetUser = users.find(u => u.socketId === fromSocketId)
                chat = {
                  id: chatId,
                  name: targetUser?.nickname || data.nickname,
                  type: 'private' as const,
                  targetSocketId: fromSocketId,
                  messages: [],
                  unreadCount: 0
                }
              }
              
              const updatedMessages = [...chat.messages, {
                ...data,
                message: decryptedMessage
              }]
              
              const unreadCount = activeChatId === chatId ? 0 : chat.unreadCount + 1
              
              newChats.set(chatId, {
                ...chat,
                messages: updatedMessages,
                unreadCount
              })
              
              return newChats
            })
          } catch (error) {
            console.error('Error procesando mensaje privado:', error)
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
          
          setChats(prev => {
            const newChats = new Map(prev)
            const generalChat = newChats.get('general') || {
              id: 'general',
              name: 'Chat General',
              type: 'general' as const,
              messages: [],
              unreadCount: 0
            }
            
            newChats.set('general', {
              ...generalChat,
              messages: [...generalChat.messages, data]
            })
            
            return newChats
          })
        })

      newSocket.on('userLeft', (data: Message) => {
          setChats(prev => {
            const newChats = new Map(prev)
            const generalChat = newChats.get('general') || {
              id: 'general',
              name: 'Chat General',
              type: 'general' as const,
              messages: [],
              unreadCount: 0
            }
            
            newChats.set('general', {
              ...generalChat,
              messages: [...generalChat.messages, data]
            })
            
            return newChats
          })
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
  }, [chats, activeChatId])

  useEffect(() => {
    setChats(prev => {
      const newChats = new Map(prev)
      const activeChat = newChats.get(activeChatId)
      if (activeChat) {
        newChats.set(activeChatId, {
          ...activeChat,
          unreadCount: 0
        })
      }
      return newChats
    })
  }, [activeChatId])

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (nicknameInput.trim()) {
      setNickname(nicknameInput.trim())
    }
  }

  const handleStartPrivateChat = (targetUser: User) => {
    const chatId = `private_${targetUser.socketId}`
    
    setChats(prev => {
      const newChats = new Map(prev)
      if (!newChats.has(chatId)) {
        newChats.set(chatId, {
          id: chatId,
          name: targetUser.nickname,
          type: 'private',
          targetSocketId: targetUser.socketId,
          messages: [],
          unreadCount: 0
        })
      }
      return newChats
    })
    
    setActiveChatId(chatId)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || !connected) return

    const activeChat = chats.get(activeChatId)
    if (!activeChat) return

    const messageInput = (e.target as HTMLFormElement).querySelector('input')?.value || ''
    if (!messageInput.trim()) return

    try {
      if (activeChat.type === 'private' && activeChat.targetSocketId) {
        if (encryptionEnabled && cryptoInstance) {
          const targetUser = users.find(u => u.socketId === activeChat.targetSocketId)
          if (targetUser && targetUser.publicKey) {
            const userId = `${targetUser.nickname}_${targetUser.userIP}`
            const encrypted = await cryptoInstance.encryptMessage(messageInput.trim(), userId)
            
            socket.emit('encryptedPrivateMessage', {
              targetSocketId: activeChat.targetSocketId,
              encryptedData: encrypted.encryptedData,
              iv: encrypted.iv,
              publicKey: await cryptoInstance.exportPublicKey()
            })
            
            setChats(prev => {
              const newChats = new Map(prev)
              const chat = newChats.get(activeChatId)
              if (chat) {
                newChats.set(activeChatId, {
                  ...chat,
                  messages: [...chat.messages, {
                    nickname,
                    userIP,
                    message: messageInput.trim(),
                    timestamp: new Date().toISOString(),
                    encrypted: true,
                    isPrivate: true,
                    fromSocketId: socket.id,
                    isOwn: true
                  }]
                })
              }
              return newChats
            })
          }
        } else {
          socket.emit('privateMessage', {
            targetSocketId: activeChat.targetSocketId,
            message: messageInput.trim()
          })
          
          setChats(prev => {
            const newChats = new Map(prev)
            const chat = newChats.get(activeChatId)
            if (chat) {
              newChats.set(activeChatId, {
                ...chat,
                messages: [...chat.messages, {
                  nickname,
                  userIP,
                  message: messageInput.trim(),
                  timestamp: new Date().toISOString(),
                  isPrivate: true,
                  fromSocketId: socket.id,
                  isOwn: true
                }]
              })
            }
            return newChats
          })
        }
      } else {
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
          
          setChats(prev => {
            const newChats = new Map(prev)
            const generalChat = newChats.get('general')
            if (generalChat) {
              newChats.set('general', {
                ...generalChat,
                messages: [...generalChat.messages, {
                  nickname,
                  userIP,
                  message: messageText,
                  timestamp: new Date().toISOString(),
                  encrypted: true
                }]
              })
            }
            return newChats
          })
        } else {
          socket.emit('message', { message: messageInput.trim() })
        }
      }
      
      const input = (e.target as HTMLFormElement).querySelector('input')
      if (input) input.value = ''
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

  const activeChat = chats.get(activeChatId)
  const chatList = Array.from(chats.values())

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg overflow-hidden flex flex-col" style={{ height: '600px' }}>
      <div className="p-4 bg-slate-700 border-b border-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <div>
            <h2 className="text-xl font-semibold">{activeChat?.name || 'Chat'}</h2>
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
        <div className="w-64 bg-slate-700 border-r border-slate-600 flex flex-col">
          <div className="p-3 border-b border-slate-600">
            <h3 className="font-semibold text-slate-300 text-sm">Chats</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chatList.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`w-full text-left p-2 rounded-lg transition-colors ${
                  activeChatId === chat.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {chat.type === 'private' && <span className="text-xs">🔒</span>}
                    <span className="font-medium text-sm">{chat.name}</span>
                  </div>
                  {chat.unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-slate-600">
            <h3 className="font-semibold text-slate-300 text-sm mb-2">Usuarios</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {users
                .filter(user => user.socketId !== socket?.id)
                .map((user) => (
                  <button
                    key={user.socketId}
                    onClick={() => handleStartPrivateChat(user)}
                    className="w-full text-left p-2 bg-slate-800 rounded border border-slate-600 hover:bg-slate-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm text-slate-100">{user.nickname}</div>
                      {user.publicKey && encryptionEnabled && (
                        <span className="text-xs text-green-400">🔒</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{user.userIP}</div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeChat && activeChat.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <p>
                  {activeChat.type === 'private' 
                    ? `Inicia una conversación con ${activeChat.name}`
                    : 'No hay mensajes aún. ¡Sé el primero en escribir!'}
                </p>
              </div>
            ) : (
              activeChat?.messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col gap-1 ${
                    msg.nickname === nickname || msg.isOwn ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.nickname === nickname || msg.isOwn
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-100'
                    }`}
                  >
                    {msg.nickname !== nickname && !msg.isOwn && (
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
                placeholder={connected ? "Escribe un mensaje..." : "Conectando..."}
                disabled={!connected}
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!connected}
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
