import { useEffect, useRef, useState } from 'react'
import './App.css'
import { listCvs } from './storage'

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

// no download helper needed; we link directly to S3

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

    // Upload/Delete/Download actions are intentionally removed in read-only mode

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
                                <a className="name" href={r.url} target="_blank" rel="noreferrer noopener">{r.name}</a>
                                <div className="details">
                                    {formatBytes(r.size)} · {new Date(r.createdAt).toLocaleString()} · {r.type || 'file'}
                                </div>
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
