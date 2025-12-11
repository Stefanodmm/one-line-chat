interface KeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

interface EncryptedMessage {
  encryptedData: string
  iv: string
  publicKey: string
}

export class E2ECrypto {
  private keyPair: KeyPair | null = null
  private sharedKeys: Map<string, CryptoKey> = new Map()

  async generateKeyPair(): Promise<void> {
    try {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true,
        ['deriveKey', 'deriveBits']
      )

      this.keyPair = {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
      }
    } catch (error) {
      console.error('Error generando par de claves:', error)
      throw error
    }
  }

  async exportPublicKey(): Promise<string> {
    if (!this.keyPair) {
      throw new Error('No se ha generado un par de claves')
    }

    const exported = await crypto.subtle.exportKey('spki', this.keyPair.publicKey)
    return this.arrayBufferToBase64(exported)
  }

  async importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
    const publicKeyBuffer = this.base64ToArrayBuffer(publicKeyBase64)
    
    return await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    )
  }

  async deriveSharedKey(otherPublicKeyBase64: string, userId: string): Promise<void> {
    if (!this.keyPair) {
      throw new Error('No se ha generado un par de claves')
    }

    const otherPublicKey = await this.importPublicKey(otherPublicKeyBase64)

    const sharedKey = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: otherPublicKey,
      },
      this.keyPair.privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    )

    this.sharedKeys.set(userId, sharedKey)
  }

  async encryptMessage(message: string, userId: string): Promise<EncryptedMessage> {
    const sharedKey = this.sharedKeys.get(userId)
    if (!sharedKey) {
      throw new Error(`No hay clave compartida con el usuario ${userId}`)
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(message)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      sharedKey,
      data
    )

    return {
      encryptedData: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(iv),
      publicKey: await this.exportPublicKey(),
    }
  }

  async decryptMessage(
    encryptedData: string,
    iv: string,
    senderPublicKey: string,
    senderId: string
  ): Promise<string> {
    if (!this.sharedKeys.has(senderId)) {
      await this.deriveSharedKey(senderPublicKey, senderId)
    }

    const sharedKey = this.sharedKeys.get(senderId)
    if (!sharedKey) {
      throw new Error(`No se pudo derivar clave compartida con ${senderId}`)
    }

    const encryptedBuffer = this.base64ToArrayBuffer(encryptedData)
    const ivBuffer = this.base64ToArrayBuffer(iv)

    try {
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer,
        },
        sharedKey,
        encryptedBuffer
      )

      const decoder = new TextDecoder()
      return decoder.decode(decryptedData)
    } catch (error) {
      console.error('Error descifrando mensaje:', error)
      throw new Error('No se pudo descifrar el mensaje')
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  static isSupported(): boolean {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.subtle.generateKey === 'function'
  }
}
