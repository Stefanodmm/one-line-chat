# Servidor de Chat - Backend

Servidor Python con Flask y SocketIO para el chat en red local con cifrado end-to-end.

## 📋 Requisitos

- Python 3.7 o superior
- pip (gestor de paquetes de Python)

## 🚀 Instalación

```bash
pip install -r requirements.txt
```

## ▶️ Uso

### Iniciar el servidor

```bash
python server.py
```

O desde la raíz del proyecto:

```bash
cd server
python server.py
```

### Cambiar el puerto

```bash
PORT=8080 python server.py
```

O edita `server.py` y cambia:

```python
port = int(os.environ.get('PORT', 5000))  # Cambia 5000
```

## 📡 Endpoints

- **WebSocket**: `ws://<IP>:5000` (Socket.IO)
- **API Network Info**: `http://<IP>:5000/api/network-info`
- **API Client IP**: `http://<IP>:5000/api/client-ip`
- **Root**: `http://<IP>:5000/` (verificación de estado)

## 🔒 Cifrado End-to-End

El servidor actúa como **relay** de mensajes cifrados:
- ✅ Recibe mensajes cifrados de los clientes
- ✅ Reenvía mensajes sin poder leerlos
- ✅ Maneja el intercambio de claves públicas
- ❌ **NO puede descifrar** los mensajes

## 🔧 Configuración

### Firewall

Asegúrate de que el puerto **5000** (o el que configures) esté abierto en tu firewall para permitir conexiones desde otros dispositivos.

### Red Local

El servidor escucha en `0.0.0.0`, lo que permite conexiones desde cualquier dispositivo en tu red local.

## 📝 Logs

El servidor muestra en consola:
- Conexiones y desconexiones de usuarios
- Mensajes recibidos (sin cifrar) o indicador de mensajes cifrados
- Errores y advertencias

## 🐛 Solución de Problemas

**Puerto ocupado:**
```bash
PORT=5001 python server.py
```

**Error de importación:**
```bash
pip install -r requirements.txt
```

**No se pueden conectar desde otros dispositivos:**
- Verifica que el firewall permita conexiones en el puerto
- Asegúrate de usar la IP correcta (no localhost)
- Verifica que ambos dispositivos estén en la misma red

## 📦 Dependencias

Ver `requirements.txt` para la lista completa. Principales:
- Flask
- flask-socketio
- flask-cors
- python-socketio
- eventlet (no necesario, usa threading)

