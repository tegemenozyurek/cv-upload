// Minimal Express server that returns S3 presigned URLs
import express from 'express'
import cors from 'cors'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const app = express()
app.use(express.json({ limit: '25mb' }))

const allowOrigin = process.env.ALLOW_ORIGIN || '*'
app.use(cors({ origin: allowOrigin, credentials: false }))

const region = process.env.AWS_REGION || process.env.VITE_S3_REGION
const bucket = process.env.S3_BUCKET || process.env.VITE_S3_BUCKET
const prefix = process.env.S3_PREFIX || 'cv-uploads/'

if (!bucket || !region) {
    console.warn('[server] Missing S3 config; set AWS_REGION and S3_BUCKET')
}

const s3 = new S3Client({ region })

function makeKey(name) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    return `${prefix}${ts}-${name}`
}

app.post('/api/upload-url', async (req, res) => {
    try {
        const { name, type } = req.body || {}
        const key = makeKey(name || 'file')
        const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type || 'application/octet-stream' })
        const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 })
        res.json({ url, key })
    } catch (e) {
        res.status(500).send(e.message || 'presign failed')
    }
})

app.get('/api/download-url', async (req, res) => {
    try {
        const key = req.query.key
        const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
        const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 })
        res.json({ url })
    } catch (e) {
        res.status(500).send(e.message || 'presign failed')
    }
})

app.get('/api/list', async (_req, res) => {
    try {
        const resp = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))
        const items = (resp.Contents || [])
            .filter(o => !o.Key.endsWith('/'))
            .map(o => ({ key: o.Key, name: o.Key.replace(prefix, ''), size: o.Size, lastModified: o.LastModified }))
        res.json({ items })
    } catch (e) {
        res.status(500).send(e.message || 'list failed')
    }
})

app.post('/api/delete', async (req, res) => {
    try {
        const { key } = req.body || {}
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).send(e.message || 'delete failed')
    }
})

const port = Number(process.env.PORT || 8787)
app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
})


