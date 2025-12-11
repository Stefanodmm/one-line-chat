# Chat en Red Local - Documentación Completa

Aplicación web de chat en tiempo real con **cifrado end-to-end** donde el **frontend** se despliega en Vercel y el **backend** (servidor Python) se ejecuta en tu PC.

## 📋 Tabla de Contenidos

1. [Arquitectura General](#arquitectura-general)
2. [Cómo Funciona](#cómo-funciona)
3. [Flujo de Comunicación](#flujo-de-comunicación)
4. [Cifrado End-to-End](#cifrado-end-to-end)
5. [Instalación y Uso](#instalación-y-uso)
6. [Estructura del Proyecto](#estructura-del-proyecto)
7. [Detalles Técnicos](#detalles-técnicos)

---

## 🏗️ Arquitectura General

### Componentes Principales

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend      │         │    Backend       │         │   Frontend      │
│   (Vercel)     │◄────────┤  (Tu PC)        │────────►│   (Vercel)      │
│   Usuario 1    │         │  Python Server  │         │   Usuario 2     │
└─────────────────┘         └──────────────────┘         └─────────────────┘
       │                              │                            │
       │                              │                            │
       └──────────────────────────────┴────────────────────────────┘
                    WebSocket (Socket.IO)
                    Mensajes Cifrados E2E
```

### Separación de Responsabilidades

- **Frontend (Next.js)**: Interfaz de usuario, cifrado/descifrado, conexión WebSocket
- **Backend (Python)**: Relay de mensajes, intercambio de claves públicas, APIs de red
- **Cifrado E2E**: Ocurre completamente en el cliente, el servidor nunca ve mensajes en texto plano

---

## 🔄 Cómo Funciona

### 1. Inicio de Sesión

```
Usuario → Ingresa IP del servidor → Conecta vía WebSocket
```

**Proceso:**
1. Usuario abre la aplicación web (Vercel o localhost)
2. Ingresa la IP del servidor Python (ej: `192.168.1.100`)
3. El frontend establece conexión WebSocket con el servidor
4. Usuario ingresa su nombre
5. El cliente genera su par de claves (pública/privada) automáticamente
6. Envía su clave pública al servidor junto con su nombre

### 2. Intercambio de Claves

```
Usuario A ──[Clave Pública A]──► Servidor ──[Clave Pública A]──► Usuario B
Usuario B ──[Clave Pública B]──► Servidor ──[Clave Pública B]──► Usuario A
```

**Proceso:**
1. Cuando un usuario se conecta, el servidor le envía la lista de usuarios conectados
2. Cada usuario en la lista incluye su clave pública
3. El cliente deriva una clave compartida con cada otro usuario usando ECDH
4. Esta clave compartida se usa para cifrar mensajes entre pares específicos

### 3. Envío de Mensajes

```
Usuario A → Cifra mensaje con clave de Usuario B → Servidor → Usuario B → Descifra mensaje
```

**Proceso detallado:**
1. Usuario A escribe un mensaje
2. El frontend cifra el mensaje usando la clave compartida con Usuario B
3. Envía el mensaje cifrado al servidor
4. El servidor reenvía el mensaje cifrado a Usuario B (sin poder leerlo)
5. Usuario B recibe el mensaje cifrado
6. El frontend descifra automáticamente usando su clave privada
7. Muestra el mensaje en texto plano al usuario

---

## 📡 Flujo de Comunicación

### Conexión Inicial

```
1. Cliente → GET /api/network-info
   ← Información de red del servidor

2. Cliente → WebSocket Connect
   ← Socket.IO handshake

3. Cliente → emit('join', {nickname, userIP, publicKey})
   ← emit('usersList', [usuarios conectados])
   ← emit('usersUpdate', [todos los usuarios])
   ← emit('userJoined', {nuevo usuario}) [a otros usuarios]
```

### Envío de Mensaje Cifrado

```
1. Cliente A → Genera IV aleatorio
2. Cliente A → Cifra mensaje con AES-GCM usando clave compartida con Cliente B
3. Cliente A → emit('encryptedMessage', {
     targetSocketId: 'socket_b',
     encryptedData: '...',
     iv: '...',
     publicKey: 'clave_publica_a'
   })
4. Servidor → Reenvía a Cliente B (sin descifrar)
5. Cliente B → Descifra usando su clave privada
6. Cliente B → Muestra mensaje en pantalla
```

### Desconexión

```
1. Cliente → WebSocket Disconnect
2. Servidor → Elimina usuario de la lista
3. Servidor → emit('userLeft', {nickname}) [a otros usuarios]
4. Servidor → emit('usersUpdate', [usuarios restantes])
```

---

## 🔒 Cifrado End-to-End

### Algoritmos Utilizados

- **ECDH (P-256)**: Intercambio de claves Diffie-Hellman de curva elíptica
- **AES-GCM (256 bits)**: Cifrado simétrico con autenticación
- **IV aleatorio**: Vector de inicialización único por mensaje

### Proceso de Cifrado

#### Paso 1: Generación de Claves
```javascript
// Cada usuario genera su par de claves al conectarse
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveKey', 'deriveBits']
)
```

#### Paso 2: Intercambio de Claves Públicas
```javascript
// Usuario A exporta su clave pública
const publicKeyA = await crypto.subtle.exportKey('spki', keyPairA.publicKey)

// Servidor distribuye clave pública de A a B
// Usuario B importa la clave pública de A
const publicKeyA_imported = await crypto.subtle.importKey('spki', publicKeyA, ...)

// Usuario B deriva clave compartida
const sharedKey = await crypto.subtle.deriveKey(
  { name: 'ECDH', public: publicKeyA_imported },
  keyPairB.privateKey,
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
)
```

#### Paso 3: Cifrado de Mensaje
```javascript
// Generar IV aleatorio (12 bytes para AES-GCM)
const iv = crypto.getRandomValues(new Uint8Array(12))

// Cifrar mensaje
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: iv },
  sharedKey,
  new TextEncoder().encode(mensaje)
)
```

#### Paso 4: Descifrado
```javascript
// Descifrar mensaje
const decrypted = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv: iv },
  sharedKey,
  encryptedData
)

const mensaje = new TextDecoder().decode(decrypted)
```

### Seguridad

✅ **Perfect Forward Secrecy**: Claves nuevas en cada sesión
✅ **Autenticación**: AES-GCM detecta modificaciones
✅ **Confidencialidad**: Solo el destinatario puede descifrar
✅ **Servidor no puede leer**: Solo actúa como relay

---

## 🚀 Instalación y Uso

### Requisitos Previos

- **Node.js** 18+ y npm
- **Python** 3.7+
- **Navegador moderno** con soporte Web Crypto API

### Instalación

#### Frontend
```bash
npm install
```

#### Backend
```bash
cd server
pip install -r requirements.txt
```

### Ejecución

#### Opción 1: Scripts Automáticos

**Windows:**
```bash
start-dev.bat
```

**Linux/Mac:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

#### Opción 2: Manual

**Terminal 1 - Backend:**
```bash
cd server
python server.py
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### Acceso

1. Abre `http://localhost:3000` en tu navegador
2. Ingresa `localhost` como IP del servidor
3. Haz clic en "Conectar"
4. Ingresa tu nombre de usuario
5. ¡Comienza a chatear!

---

## 📁 Estructura del Proyecto

```
.
├── app/                          # Frontend Next.js
│   ├── page.tsx                 # Página principal
│   ├── layout.tsx               # Layout de la aplicación
│   └── globals.css              # Estilos globales
│
├── components/                   # Componentes React
│   ├── Chat.tsx                 # Componente principal del chat
│   │                            # - Maneja conexión WebSocket
│   │                            # - Cifrado/descifrado de mensajes
│   │                            # - Interfaz de usuario
│   ├── NetworkInfo.tsx          # Muestra información de red
│   └── ServerConnection.tsx     # Formulario de conexión al servidor
│
├── utils/                        # Utilidades
│   └── crypto.ts                # Clase E2ECrypto
│                                # - Generación de claves
│                                # - Cifrado/descifrado
│                                # - Intercambio de claves
│
├── server/                       # Backend Python
│   ├── server.py                # Servidor Flask + SocketIO
│   │                            # - Maneja conexiones WebSocket
│   │                            # - Relay de mensajes cifrados
│   │                            # - APIs de información de red
│   ├── requirements.txt         # Dependencias Python
│   └── README.md                # Documentación del servidor
│
├── start-dev.bat                # Script desarrollo Windows
├── start-dev.sh                 # Script desarrollo Linux/Mac
├── package.json                 # Dependencias Node.js
├── vercel.json                  # Configuración Vercel
├── README.md                    # Este archivo
└── CIFRADO_E2E.md              # Documentación detallada de cifrado
```

---

## 🔧 Detalles Técnicos

### Frontend (Next.js)

#### Tecnologías
- **Next.js 14**: Framework React con SSR/SSG
- **TypeScript**: Tipado estático
- **Tailwind CSS**: Estilos utilitarios
- **Socket.IO Client**: Cliente WebSocket
- **Web Crypto API**: Cifrado nativo del navegador

#### Componentes Clave

**Chat.tsx:**
- Maneja la conexión Socket.IO
- Inicializa el cifrado E2E
- Cifra mensajes antes de enviar
- Descifra mensajes al recibir
- Gestiona el estado de usuarios y mensajes

**ServerConnection.tsx:**
- Formulario para ingresar IP del servidor
- Detección de nombre de red WiFi (si está disponible)
- Validación de entrada

**NetworkInfo.tsx:**
- Muestra información de conexión
- Nombre de red WiFi (si detectado)
- IP del servidor conectado

### Backend (Python)

#### Tecnologías
- **Flask**: Framework web ligero
- **Flask-SocketIO**: WebSockets para Flask
- **Flask-CORS**: Manejo de CORS
- **Threading**: Async mode (compatible con Python 3.13)

#### Endpoints

**GET /api/network-info**
- Retorna información de red del servidor
- IP, hostname, plataforma, interfaces

**GET /api/client-ip**
- Retorna IP aproximada del cliente
- Basada en headers HTTP

**WebSocket Events:**

- `connect`: Nueva conexión
- `disconnect`: Desconexión
- `join`: Usuario se une (envía clave pública)
- `message`: Mensaje sin cifrar (fallback)
- `encryptedMessage`: Mensaje cifrado E2E
- `userJoined`: Notificación de nuevo usuario
- `userLeft`: Notificación de desconexión
- `usersList`: Lista de usuarios conectados
- `usersUpdate`: Actualización de lista de usuarios

### Cifrado (Web Crypto API)

#### Clase E2ECrypto

**Métodos principales:**

- `generateKeyPair()`: Genera par de claves ECDH
- `exportPublicKey()`: Exporta clave pública en Base64
- `importPublicKey()`: Importa clave pública de otro usuario
- `deriveSharedKey()`: Deriva clave compartida con otro usuario
- `encryptMessage()`: Cifra mensaje para un usuario específico
- `decryptMessage()`: Descifra mensaje recibido

**Flujo de cifrado por mensaje:**

1. Obtener clave compartida con destinatario
2. Generar IV aleatorio (12 bytes)
3. Cifrar mensaje con AES-GCM
4. Enviar: `{encryptedData, iv, publicKey}`

**Flujo de descifrado:**

1. Recibir mensaje cifrado
2. Si no hay clave compartida, derivarla usando clave pública del remitente
3. Descifrar con AES-GCM usando IV recibido
4. Mostrar mensaje descifrado

---

## 🌐 Despliegue

### Frontend en Vercel

1. Sube código a GitHub
2. Importa en Vercel
3. Vercel detecta Next.js automáticamente
4. Configura:
   - Build Command: `npm run build`
   - Output Directory: `out`
5. Deploy

### Backend en tu PC

1. Instala dependencias: `pip install -r requirements.txt`
2. Ejecuta servidor: `python server.py`
3. Configura firewall para permitir puerto 5000
4. Comparte tu IP con otros usuarios

---

## 🔍 Flujo Completo Ejemplo

### Escenario: Usuario A envía mensaje a Usuario B

```
1. Usuario A escribe "Hola" y presiona Enter

2. Frontend A:
   - Obtiene clave compartida con Usuario B
   - Genera IV: [0x12, 0x34, ...]
   - Cifra "Hola" → "aB3dEf9..."
   - Envía al servidor:
     {
       targetSocketId: "socket_b",
       encryptedData: "aB3dEf9...",
       iv: "EjQ=",
       publicKey: "MIIB..."
     }

3. Servidor Python:
   - Recibe mensaje cifrado
   - NO puede leer el contenido
   - Reenvía a socket_b sin modificar
   - Log: "Mensaje cifrado E2E de UsuarioA → UsuarioB"

4. Frontend B:
   - Recibe mensaje cifrado
   - Deriva clave compartida (si no la tiene)
   - Descifra "aB3dEf9..." → "Hola"
   - Muestra en pantalla: "Usuario A: Hola"

5. Usuario B ve el mensaje "Hola" de Usuario A
```

---

## 🛡️ Seguridad

### Lo que el Servidor NO puede hacer

❌ Leer mensajes cifrados
❌ Descifrar contenido de mensajes
❌ Modificar mensajes sin ser detectado
❌ Suplantar usuarios (las claves privadas nunca salen del cliente)

### Lo que el Servidor SÍ puede hacer

✅ Ver que se envió un mensaje
✅ Ver quién envió a quién
✅ Ver timestamps
✅ Ver claves públicas (son públicas por diseño)
✅ Desconectar usuarios

### Limitaciones de Seguridad

⚠️ **Sin verificación de identidad**: No hay autenticación de usuarios
⚠️ **Sin persistencia**: Las claves se pierden al cerrar el navegador
⚠️ **Sin protección MitM**: Sin certificados verificados
⚠️ **Servidor de confianza**: Asumes que el servidor no modifica mensajes

---

## 🐛 Solución de Problemas

### El cifrado no funciona

**Síntomas:**
- No aparece el ícono 🔒
- Mensajes se envían sin cifrar

**Soluciones:**
- Verifica que el navegador soporte Web Crypto API
- Abre consola (F12) para ver errores
- Asegúrate de que ambos usuarios estén conectados

### No puedo conectarme

**Síntomas:**
- Error de conexión WebSocket
- Timeout

**Soluciones:**
- Verifica que el servidor esté ejecutándose
- Verifica que la IP sea correcta
- Verifica firewall (puerto 5000)
- Verifica que ambos estén en la misma red

### Mensajes no se descifran

**Síntomas:**
- Aparece "[Mensaje cifrado - Error al descifrar]"

**Soluciones:**
- Verifica que ambos usuarios tengan cifrado activo
- Revisa consola para errores específicos
- Intenta reconectar ambos usuarios

---

## 📚 Recursos Adicionales

- **CIFRADO_E2E.md**: Documentación detallada del cifrado
- **server/README.md**: Documentación específica del servidor
- **Web Crypto API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- **Socket.IO**: https://socket.io/docs/v4/
- **Flask-SocketIO**: https://flask-socketio.readthedocs.io/

---

## 📝 Notas Finales

- El cifrado es **transparente** para el usuario
- El servidor **nunca** puede leer mensajes cifrados
- Cada par de usuarios tiene su **propia clave compartida**
- Las claves se **regeneran** en cada sesión
- El proyecto está diseñado para **redes locales**

---

## 📄 Licencia

MIT
