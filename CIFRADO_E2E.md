# 🔒 Cifrado End-to-End (E2E)

## ¿Qué es el Cifrado E2E?

El cifrado end-to-end garantiza que **solo el remitente y el destinatario** puedan leer los mensajes. El servidor actúa como un "relay" pero **NO puede leer el contenido** de los mensajes cifrados.

## 🔐 Cómo Funciona

### 1. Generación de Claves
- Cada usuario genera un **par de claves** (pública y privada) al conectarse
- La clave pública se comparte con otros usuarios
- La clave privada **nunca** sale del dispositivo

### 2. Intercambio de Claves
- Cuando un usuario se une, envía su clave pública al servidor
- El servidor distribuye las claves públicas a todos los usuarios conectados
- Cada usuario deriva una **clave compartida** con cada otro usuario

### 3. Cifrado de Mensajes
- Cuando envías un mensaje, se cifra con la clave compartida del destinatario
- El mensaje cifrado se envía al servidor
- El servidor solo ve datos cifrados (no puede leer el contenido)

### 4. Descifrado
- El destinatario recibe el mensaje cifrado
- Usa su clave privada y la clave pública del remitente para descifrar
- Solo el destinatario puede leer el mensaje original

## 🛡️ Seguridad

### Algoritmos Utilizados
- **ECDH (P-256)**: Para intercambio de claves
- **AES-GCM (256 bits)**: Para cifrado de mensajes
- **IV aleatorio**: Para cada mensaje (previene ataques de repetición)

### Características de Seguridad
✅ **Cifrado asimétrico**: Cada par de usuarios tiene su propia clave compartida
✅ **Perfect Forward Secrecy**: Las claves se regeneran en cada sesión
✅ **Autenticación**: Solo el destinatario correcto puede descifrar
✅ **Integridad**: AES-GCM detecta modificaciones en los mensajes

## ⚠️ Limitaciones

### Navegadores Soportados
- ✅ Chrome/Edge (todas las versiones modernas)
- ✅ Firefox (todas las versiones modernas)
- ✅ Safari (iOS 11+, macOS 10.13+)
- ❌ Navegadores muy antiguos sin Web Crypto API

### Requisitos
- **HTTPS recomendado**: Para proteger las claves durante la transmisión
- **Web Crypto API**: Disponible en navegadores modernos
- **JavaScript habilitado**: Requerido para el cifrado

## 🔍 Verificación

### Cómo Verificar que Funciona

1. **Indicador Visual**: 
   - Verás un ícono 🔒 junto a los usuarios con cifrado activo
   - Los mensajes cifrados muestran un ícono 🔒

2. **Consola del Servidor**:
   - Los mensajes cifrados aparecen como `[Mensaje cifrado]`
   - El servidor NO puede ver el contenido real

3. **Consola del Navegador**:
   - Si hay errores de cifrado, aparecerán en la consola
   - Los mensajes exitosos se descifran automáticamente

## 🚨 Advertencias de Seguridad

1. **El servidor NO puede leer mensajes cifrados** - Solo actúa como relay
2. **Las claves se almacenan en memoria** - Se pierden al cerrar el navegador
3. **No hay persistencia de claves** - Cada sesión genera nuevas claves
4. **Protección contra MitM limitada** - Sin certificados verificados

## 📝 Notas Técnicas

- Las claves públicas se intercambian a través del servidor (pero son públicas, no hay problema)
- Cada mensaje usa un IV (Initialization Vector) único
- El cifrado es transparente para el usuario
- Si el cifrado falla, el mensaje se envía sin cifrar como fallback

## 🔧 Solución de Problemas

**El cifrado no se activa:**
- Verifica que tu navegador soporte Web Crypto API
- Abre la consola (F12) para ver errores
- Algunos navegadores antiguos no son compatibles

**Los mensajes no se descifran:**
- Verifica que ambos usuarios tengan cifrado activo (ícono 🔒)
- Revisa la consola para errores de descifrado
- Asegúrate de que ambos usuarios estén conectados cuando se intercambian las claves

**El servidor muestra el mensaje:**
- Si ves el mensaje en texto plano en el servidor, significa que se envió sin cifrar
- Esto puede pasar si el cifrado falla o si solo hay un usuario conectado

