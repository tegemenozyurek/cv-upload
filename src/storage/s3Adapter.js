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
    
    console.log('Fetching S3 objects from:', base)
    
    try {
        // Try to get all files at once first
        const allRes = await fetch(`${base}?list-type=2&max-keys=1000`)
        console.log('All files response status:', allRes.status)
        
        if (allRes.ok) {
            const allXml = await allRes.text()
            console.log('All files XML:', allXml)
            const allItems = parseXmlToItems(allXml)
            console.log('All parsed items:', allItems)
            
            // Filter to common document types and remove duplicates
            const documentExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.png', '.jpg', '.jpeg']
            const documentItems = allItems.filter((i) => {
                const ext = i.name.toLowerCase().substring(i.name.lastIndexOf('.'))
                return documentExtensions.includes(ext)
            })
            
            const uniqueItems = documentItems.filter((item, index, self) => 
                index === self.findIndex(t => t.id === item.id)
            )
            
            console.log('Final document items:', uniqueItems)
            return uniqueItems
        } else {
            console.error('Failed to fetch all files:', allRes.status, allRes.statusText)
            throw new Error(`S3 list failed: ${allRes.status}`)
        }
    } catch (error) {
        console.error('Error fetching S3 objects:', error)
        throw error
    }
}

function parseXmlToItems(xmlText) {
    const doc = new window.DOMParser().parseFromString(xmlText, 'application/xml')
    const contents = Array.from(doc.getElementsByTagName('Contents'))

    return contents.map((c) => {
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

async function deleteCv(id) {
    // Delete object from S3 using public bucket (requires bucket to allow public DELETE)
    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encodeURIComponent(id)}`
    
    console.log('Attempting to delete:', url)
    
    try {
        const response = await fetch(url, {
            method: 'DELETE',
        })
        
        console.log('Delete response status:', response.status)
        console.log('Delete response headers:', Object.fromEntries(response.headers.entries()))
        
        if (!response.ok) {
            const errorText = await response.text()
            console.error('Delete failed response:', errorText)
            throw new Error(`Delete failed: ${response.status} ${response.statusText} - ${errorText}`)
        }
        
        console.log('Delete successful')
        return true
    } catch (error) {
        console.error('Delete error:', error)
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw new Error('CORS hatası: AWS S3 bucket CORS ayarları DELETE metoduna izin vermiyor. Bucket policy\'de DELETE izni ve CORS konfigürasyonu gerekli.')
        }
        throw error
    }
}

export const s3StorageAdapter = { addCv, listCvs, getCv, deleteCv }


