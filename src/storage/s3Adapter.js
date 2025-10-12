// S3 adapter for frontend-only listing of public bucket contents (no backend).
// It expects the bucket to allow public ListBucket and GetObject, and CORS to
// allow GET from this origin. No AWS credentials are used in the browser.

const BUCKET = import.meta.env.VITE_S3_BUCKET || 'cv-upload-bucket1'
const REGION = import.meta.env.VITE_S3_REGION || 'eu-north-1'
const PREFIX = import.meta.env.VITE_S3_PREFIX || ''

function buildObjectUrl(key) {
    // Use the regional virtual-hosted–style URL
    const encoded = encodeURIComponent(key).replace(/%2F/g, '/')
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encoded}`
}

async function listCvs() {
    // Unauthenticated ListObjectsV2 request that returns XML
    const base = `https://${BUCKET}.s3.${REGION}.amazonaws.com`
    const url = `${base}?list-type=2${PREFIX ? `&prefix=${encodeURIComponent(PREFIX)}` : ''}&max-keys=1000`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`S3 list failed: ${res.status}`)
    const xmlText = await res.text()

    // Parse XML
    const doc = new window.DOMParser().parseFromString(xmlText, 'application/xml')
    const contents = Array.from(doc.getElementsByTagName('Contents'))

    const items = contents.map((c) => {
        const key = c.getElementsByTagName('Key')[0]?.textContent || ''
        const lastModified = c.getElementsByTagName('LastModified')[0]?.textContent || ''
        const sizeStr = c.getElementsByTagName('Size')[0]?.textContent || '0'
        const size = Number(sizeStr) || 0
        const name = decodeURIComponent(key.split('/').pop() || key)
        const url = buildObjectUrl(key)
        return {
            id: key,
            name,
            size,
            type: name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'file',
            createdAt: Date.parse(lastModified) || Date.now(),
            url,
        }
    })

    // Filter to PDFs only per requirement
    return items.filter((i) => i.name.toLowerCase().endsWith('.pdf'))
}

async function getCv(id) {
    // Fetch object bytes if needed (used by existing Download button)
    const res = await fetch(buildObjectUrl(id))
    if (!res.ok) throw new Error('S3 download failed')
    const blob = await res.blob()
    return { id, name: id.split('/').pop(), size: blob.size, type: blob.type, blob, createdAt: Date.now() }
}

async function addCv(file) {
    // Simple upload to S3 using public bucket (requires bucket to allow public PUT)
    const key = `uploads/${Date.now()}-${file.name}`
    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encodeURIComponent(key)}`
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
    })
    
    if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }
    
    return key
}

async function deleteCv() {
    throw new Error('Delete is disabled in frontend-only S3 mode')
}

export const s3StorageAdapter = { addCv, listCvs, getCv, deleteCv }


