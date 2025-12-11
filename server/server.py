#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, jsonify, request
from flask_socketio import SocketIO
from flask_cors import CORS
import socket
import os
import platform
from datetime import datetime

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

users = {}

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return '127.0.0.1'

def get_network_info():
    hostname = socket.gethostname()
    local_ip = get_local_ip()
    interfaces = []
    
    try:
        import netifaces
        for interface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addrs:
                for addr_info in addrs[netifaces.AF_INET]:
                    addr = addr_info.get('addr')
                    if addr and addr != '127.0.0.1':
                        netmask = addr_info.get('netmask', 'N/A')
                        interfaces.append({
                            'name': interface,
                            'address': addr,
                            'netmask': netmask,
                            'mac': ''
                        })
    except ImportError:
        try:
            import psutil
            addrs = psutil.net_if_addrs()
            for interface_name, interface_addrs in addrs.items():
                for addr in interface_addrs:
                    if addr.family == socket.AF_INET and addr.address != '127.0.0.1':
                        interfaces.append({
                            'name': interface_name,
                            'address': addr.address,
                            'netmask': addr.netmask if hasattr(addr, 'netmask') else 'N/A',
                            'mac': ''
                        })
        except ImportError:
            interfaces.append({
                'name': 'Principal',
                'address': local_ip,
                'netmask': 'N/A',
                'mac': ''
            })
    
    return {
        'serverIP': local_ip,
        'hostname': hostname,
        'platform': platform.system(),
        'interfaces': interfaces[:5]
    }

@app.route('/api/network-info')
def network_info():
    return jsonify(get_network_info())

@app.route('/api/client-ip')
def client_ip():
    if request.headers.get('X-Forwarded-For'):
        client_ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        client_ip = request.headers.get('X-Real-IP')
    else:
        client_ip = request.remote_addr
    
    return jsonify({'ip': client_ip})

@app.route('/')
def index():
    return jsonify({
        'status': 'ok',
        'message': 'Servidor de Chat en Red Local',
        'endpoints': {
            'network-info': '/api/network-info',
            'client-ip': '/api/client-ip',
            'websocket': 'Socket.IO en el mismo puerto'
        }
    })

@socketio.on('connect')
def handle_connect():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Nueva conexión: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in users:
        user = users[request.sid]
        nickname = user['nickname']
        del users[request.sid]
        
        socketio.emit('userLeft', {
            'nickname': nickname,
            'message': f'{nickname} se desconectó',
            'timestamp': datetime.now().isoformat()
        })
        
        connected_users = [{'nickname': u['nickname'], 'userIP': u['userIP'], 'socketId': sid} 
                          for sid, u in users.items()]
        socketio.emit('usersUpdate', connected_users)
        
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {nickname} se desconectó")

@socketio.on('join')
def handle_join(data):
    nickname = data.get('nickname', 'Usuario')
    user_ip = data.get('userIP', 'Desconocida')
    public_key = data.get('publicKey', None)
    
    users[request.sid] = {
        'nickname': nickname,
        'userIP': user_ip,
        'socketId': request.sid,
        'publicKey': public_key
    }
    
    socketio.emit('userJoined', {
        'nickname': nickname,
        'userIP': user_ip,
        'message': f'{nickname} se unió al chat',
        'timestamp': datetime.now().isoformat(),
        'publicKey': public_key
    })
    
    connected_users = [{
        'nickname': u['nickname'], 
        'userIP': u['userIP'], 
        'socketId': sid,
        'publicKey': u.get('publicKey')
    } for sid, u in users.items()]
    socketio.emit('usersList', connected_users, room=request.sid)
    socketio.emit('usersUpdate', connected_users)
    
    encryption_status = "con cifrado E2E" if public_key else "sin cifrado"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {nickname} ({user_ip}) se unió al chat {encryption_status}")

@socketio.on('message')
def handle_message(data):
    if request.sid in users:
        user = users[request.sid]
        message_data = {
            'nickname': user['nickname'],
            'userIP': user['userIP'],
            'message': data.get('message', ''),
            'timestamp': datetime.now().isoformat(),
            'encrypted': False
        }
        
        socketio.emit('message', message_data)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Mensaje de {user['nickname']}: {data.get('message', '')}")

@socketio.on('encryptedMessage')
def handle_encrypted_message(data):
    if request.sid in users:
        user = users[request.sid]
        target_socket_id = data.get('targetSocketId')
        
        if target_socket_id and target_socket_id in users:
            socketio.emit('message', {
                'nickname': user['nickname'],
                'userIP': user['userIP'],
                'message': '[Mensaje cifrado]',
                'encrypted': True,
                'encryptedData': data.get('encryptedData'),
                'iv': data.get('iv'),
                'publicKey': data.get('publicKey'),
                'timestamp': datetime.now().isoformat()
            }, room=target_socket_id)
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Mensaje cifrado E2E de {user['nickname']} → {users[target_socket_id]['nickname']}")

@socketio.on('privateMessage')
def handle_private_message(data):
    if request.sid in users:
        user = users[request.sid]
        target_socket_id = data.get('targetSocketId')
        
        if target_socket_id and target_socket_id in users:
            message_data = {
                'nickname': user['nickname'],
                'userIP': user['userIP'],
                'message': data.get('message', ''),
                'timestamp': datetime.now().isoformat(),
                'encrypted': False,
                'isPrivate': True,
                'fromSocketId': request.sid
            }
            
            socketio.emit('privateMessage', message_data, room=target_socket_id)
            
            socketio.emit('privateMessage', {
                **message_data,
                'isOwn': True,
                'fromSocketId': target_socket_id
            }, room=request.sid)
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Mensaje privado de {user['nickname']} → {users[target_socket_id]['nickname']}")

@socketio.on('encryptedPrivateMessage')
def handle_encrypted_private_message(data):
    if request.sid in users:
        user = users[request.sid]
        target_socket_id = data.get('targetSocketId')
        
        if target_socket_id and target_socket_id in users:
            message_data = {
                'nickname': user['nickname'],
                'userIP': user['userIP'],
                'message': '[Mensaje cifrado]',
                'encrypted': True,
                'encryptedData': data.get('encryptedData'),
                'iv': data.get('iv'),
                'publicKey': data.get('publicKey'),
                'timestamp': datetime.now().isoformat(),
                'isPrivate': True,
                'fromSocketId': request.sid
            }
            
            socketio.emit('privateMessage', message_data, room=target_socket_id)
            
            socketio.emit('privateMessage', {
                **message_data,
                'isOwn': True,
                'fromSocketId': target_socket_id
            }, room=request.sid)
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Mensaje privado cifrado E2E de {user['nickname']} → {users[target_socket_id]['nickname']}")

if __name__ == '__main__':
    local_ip = get_local_ip()
    port = int(os.environ.get('PORT', 5000))
    
    print("=" * 50)
    print("Servidor Web de Chat iniciado")
    print(f"IP del servidor: {local_ip}")
    print(f"Puerto: {port}")
    print("=" * 50)
    print(f"\nAccede desde tu navegador:")
    print(f"  - Local: http://localhost:{port}")
    print(f"  - Red: http://{local_ip}:{port}")
    print("\nPresiona Ctrl+C para detener el servidor\n")
    
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
