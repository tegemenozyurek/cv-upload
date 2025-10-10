import { useEffect, useRef, useState } from 'react'
import './App.css'
import { listCvs, getCv, deleteCv } from './storage'

function formatBytes(bytes) {
	if (!Number.isFinite(bytes)) return '';
	const units = ['B', 'KB', 'MB', 'GB'];
	let size = bytes;
	let unitIdx = 0;
	while (size >= 1024 && unitIdx < units.length - 1) {
		size /= 1024;
		unitIdx += 1;
	}
	return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[unitIdx]}`;
}

function downloadBlob(record) {
	if (!record?.blob) return;
	const url = URL.createObjectURL(record.blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = record.name || 'cv';
	document.body.appendChild(a);
	a.click();
	URL.revokeObjectURL(url);
	a.remove();
}

function App() {
    const [items, setItems] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')
	const [theme, setTheme] = useState('dark')
    const fileInputRef = useRef(null)

	useEffect(() => {
		// Initialize theme from localStorage or system preference
		const stored = localStorage.getItem('theme')
		if (stored === 'light' || stored === 'dark') {
			setTheme(stored)
			document.documentElement.setAttribute('data-theme', stored)
		} else {
			const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
			const initial = prefersLight ? 'light' : 'dark'
			setTheme(initial)
			document.documentElement.setAttribute('data-theme', initial)
		}

        let isMounted = true
        listCvs()
			.then((rows) => {
				if (isMounted) setItems(rows)
			})
			.catch((e) => {
				if (isMounted) setError(e?.message || 'Failed to load CVs')
			})
			.finally(() => {
				if (isMounted) setIsLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [])

	function toggleTheme() {
		const next = theme === 'dark' ? 'light' : 'dark'
		setTheme(next)
		document.documentElement.setAttribute('data-theme', next)
		localStorage.setItem('theme', next)
	}

	async function handleDownload(id) {
		setError('')
		try {
			const record = await getCv(id)
			if (record) downloadBlob(record)
		} catch (e) {
			setError(e?.message || 'Download failed')
		}
	}

	async function handleDelete(id) {
		setError('')
		try {
			await deleteCv(id)
			setItems((prev) => prev.filter((r) => r.id !== id))
		} catch (e) {
			setError(e?.message || 'Delete failed')
		}
	}

	return (
		<>
		<button className="theme-toggle" aria-label="Toggle theme" title="Toggle theme" onClick={toggleTheme}>
			{theme === 'dark' ? 'Light mode' : 'Dark mode'}
		</button>

		<div className="container">
			<div className="topbar">
				<h1>CV Uploads</h1>
			</div>


            {/* Upload controls removed for S3 read-only listing */}

			{error && <div className="error">{error}</div>}

			{isLoading ? (
				<div>Loading...</div>
			) : items.length === 0 ? (
				<div className="empty">No CVs uploaded yet.</div>
			) : (
                <ul className="cv-list">
                    {items.map((r) => (
                        <li key={r.id} className="cv-item">
                            <div className="meta">
                                <div className="name">{r.name}</div>
                                <div className="details">
                                    {formatBytes(r.size)} · {new Date(r.createdAt).toLocaleString()} · {r.type || 'file'}
                                </div>
                            </div>
                            <div className="actions">
                                <button onClick={() => handleDownload(r.id)} title="Download">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7,10 12,15 17,10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                </button>
                                <button className="danger" onClick={() => handleDelete(r.id)} title="Delete">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3,6 5,6 21,6"/>
                                        <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                        <line x1="10" y1="11" x2="10" y2="17"/>
                                        <line x1="14" y1="11" x2="14" y2="17"/>
                                    </svg>
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
			)}
		</div>
		</>
	)
}

export default App
