// Storage adapter facade; chooses backend via env variable VITE_STORAGE
// Options: 'local' (IndexedDB) or 's3' (frontend-only S3 listing)

import { localStorageAdapter } from './storage/indexedDbAdapter'
import { s3StorageAdapter } from './storage/s3Adapter'

const mode = import.meta.env.VITE_STORAGE || 's3'
const adapter = mode === 's3' ? s3StorageAdapter : localStorageAdapter

export const addCv = adapter.addCv
export const listCvs = adapter.listCvs
export const getCv = adapter.getCv
export const deleteCv = adapter.deleteCv
