// S3 adapter using presigned URLs via backend /api

async function json(input, init) {
    const res = await fetch(input, init)
    if (!res.ok) throw new Error(await res.text())
    return res.json()
}

async function addCv(file) {
    // 1) request presigned URL
    const presign = await json('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: file.type })
    })
    // 2) upload to S3 directly
    const putRes = await fetch(presign.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
    })
    if (!putRes.ok) throw new Error('S3 upload failed')
    return presign.key
}

async function listCvs() {
    const data = await json('/api/list')
    // normalize to match UI expectations
    return data.items.map((o) => ({
        id: o.key,
        name: o.name,
        size: o.size,
        type: o.type || 'file',
        createdAt: o.lastModified || Date.now(),
        // no blob in S3 mode
    }))
}

async function getCv(id) {
    const data = await json(`/api/download-url?key=${encodeURIComponent(id)}`)
    const res = await fetch(data.url)
    const blob = await res.blob()
    return { id, name: id.split('/').pop(), size: blob.size, type: blob.type, blob, createdAt: Date.now() }
}

async function deleteCv(id) {
    await json('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: id })
    })
}

export const s3StorageAdapter = { addCv, listCvs, getCv, deleteCv }


