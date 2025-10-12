// Storage adapter facade; chooses backend via env variable VITE_STORAGE
// Options: 'local' (IndexedDB) or 's3' (frontend-only S3 listing)

import { localStorageAdapter } from './storage/indexedDbAdapter'
import { s3StorageAdapter } from './storage/s3Adapter'

const mode = import.meta.env.VITE_STORAGE || 's3'

// S3 for everything - listing and upload
export const listCvs = s3StorageAdapter.listCvs
export const getCv = s3StorageAdapter.getCv
export const deleteCv = s3StorageAdapter.deleteCv
export const addCv = s3StorageAdapter.addCv
