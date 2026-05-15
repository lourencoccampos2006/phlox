// lib/webPush.ts
// Web Push notification sending using VAPID + Web Crypto API
// Compatible with Cloudflare Workers (no Node.js crypto dependency)

interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

function b64UrlDecode(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - s.length % 4) % 4, '=')
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0))
}

function b64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function concatBuffers(...bufs: Uint8Array[]): Uint8Array {
  const total = bufs.reduce((n, b) => n + b.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const b of bufs) { out.set(b, offset); offset += b.length }
  return out
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = await crypto.subtle.sign('HMAC', key, ikm)
  return crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

async function hkdfExpand(prk: CryptoKey, info: Uint8Array, length: number): Promise<Uint8Array> {
  const blocks = Math.ceil(length / 32)
  let prev = new Uint8Array(0)
  const out = new Uint8Array(blocks * 32)
  for (let i = 0; i < blocks; i++) {
    const input = concatBuffers(prev, info, new Uint8Array([i + 1]))
    const block = new Uint8Array(await crypto.subtle.sign('HMAC', prk, input))
    out.set(block, i * 32)
    prev = block
  }
  return out.slice(0, length)
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hkdfExtract(salt, ikm)
  return hkdfExpand(prk, info, length)
}

// Import VAPID private key (raw 32 bytes in base64url) as ECDSA P-256 signing key
async function importVapidPrivateKey(privateKeyB64: string): Promise<CryptoKey> {
  const raw = b64UrlDecode(privateKeyB64)
  // Wrap raw EC key in PKCS8 structure for P-256
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04,
    0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ])
  const pkcs8 = concatBuffers(pkcs8Prefix, raw)
  return crypto.subtle.importKey('pkcs8', pkcs8.buffer as ArrayBuffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

async function createVapidJWT(endpoint: string, privateKey: CryptoKey, email: string): Promise<string> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const enc = new TextEncoder()
  const header = b64UrlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64UrlEncode(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: `mailto:${email}`,
  })))
  const sigInput = `${header}.${payload}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(sigInput))
  return `${sigInput}.${b64UrlEncode(sig)}`
}

// Encrypt payload using RFC 8291 (aes128gcm content encoding)
async function encryptPayload(payload: string, sub: PushSubscription): Promise<{
  ciphertext: Uint8Array
  salt: Uint8Array
  serverPublicKey: Uint8Array
}> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey))

  // Import client's public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', b64UrlDecode(sub.p256dh), { name: 'ECDH', namedCurve: 'P-256' }, true, []
  )

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, serverKeyPair.privateKey, 256))

  const authSecret = b64UrlDecode(sub.auth)
  const clientPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', clientPublicKey))

  // PRK_key (auth HKDF)
  const keyInfo = concatBuffers(enc.encode('WebPush: info\0'), clientPublicKeyRaw, serverPublicKeyRaw)
  const prkKey = await hkdf(authSecret, sharedSecret, keyInfo, 32)

  // CEK and nonce via HKDF with salt
  const cekInfo = enc.encode('Content-Encoding: aes128gcm\0')
  const nonceInfo = enc.encode('Content-Encoding: nonce\0')
  const cek = await hkdf(salt, prkKey, concatBuffers(cekInfo, new Uint8Array([1])), 16)
  const nonce = await hkdf(salt, prkKey, concatBuffers(nonceInfo, new Uint8Array([1])), 12)

  // Padding and encryption
  const plaintext = concatBuffers(enc.encode(payload), new Uint8Array([2])) // record delimiter
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext)

  return { ciphertext: new Uint8Array(ciphertextBuf), salt, serverPublicKey: serverPublicKeyRaw }
}

export async function sendPushNotification(sub: PushSubscription, payload: PushPayload): Promise<boolean> {
  const privateKeyB64 = process.env.VAPID_PRIVATE_KEY
  const publicKeyB64 = process.env.VAPID_PUBLIC_KEY
  const email = process.env.VAPID_EMAIL || 'phlox@phlox.pt'

  if (!privateKeyB64 || !publicKeyB64) {
    console.error('VAPID keys not configured')
    return false
  }

  try {
    const privateKey = await importVapidPrivateKey(privateKeyB64)
    const jwt = await createVapidJWT(sub.endpoint, privateKey, email)

    const payloadStr = JSON.stringify(payload)
    const { ciphertext, salt, serverPublicKey } = await encryptPayload(payloadStr, sub)

    // Build aes128gcm content body: salt (16) + rs (4) + keyid_len (1) + keyid + ciphertext
    const rs = new DataView(new ArrayBuffer(4))
    rs.setUint32(0, 4096, false)
    const body = concatBuffers(
      salt,
      new Uint8Array(rs.buffer),
      new Uint8Array([serverPublicKey.length]),
      serverPublicKey,
      ciphertext,
    )

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt},k=${publicKeyB64}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
      },
      body,
    })

    if (res.status === 410 || res.status === 404) {
      // Subscription expired — caller should remove it from DB
      return false
    }

    return res.ok || res.status === 201
  } catch (e) {
    console.error('Push send error:', e)
    return false
  }
}
