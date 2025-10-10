// Local IndexedDB adapter (existing behavior)

const DB_NAME = 'cvUploadDB'
const STORE_NAME = 'cvs'
const DB_VERSION = 1

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
                store.createIndex('createdAt', 'createdAt')
            }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function addCv(file) {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const createdAt = Date.now()
        const record = {
            name: file.name,
            size: file.size,
            type: file.type,
            createdAt,
            blob: file,
        }
        const req = store.add(record)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

async function listCvs() {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.getAll()
        req.onsuccess = () => {
            const items = (req.result || []).sort((a, b) => b.createdAt - a.createdAt)
            resolve(items)
        }
        req.onerror = () => reject(req.error)
    })
}

async function getCv(id) {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.get(id)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
    })
}

async function deleteCv(id) {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.delete(id)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
    })
}

export const localStorageAdapter = { addCv, listCvs, getCv, deleteCv }


