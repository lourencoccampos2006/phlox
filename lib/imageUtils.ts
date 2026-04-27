// ─── Image compression utility ────────────────────────────────────────────────
// Compresses images client-side before sending to API
// Reduces phone photos from ~3MB to ~150KB (max 1024px, JPEG 85%)

export async function compressImage(
  file: File,
  maxDimension = 1024,
  quality = 0.85
): Promise<{ base64: string; mimeType: string; sizeKB: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      
      // Calculate new dimensions
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }
      
      // Draw on canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      
      ctx.drawImage(img, 0, 0, width, height)
      
      // Export as JPEG (better compression than PNG)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Compression failed')); return }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            const base64 = dataUrl.split(',')[1]
            resolve({
              base64,
              mimeType: 'image/jpeg',
              sizeKB: Math.round(blob.size / 1024)
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        quality
      )
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Não foi possível carregar a imagem'))
    }
    
    img.src = objectUrl
  })
}