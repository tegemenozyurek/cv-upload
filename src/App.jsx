import { useEffect, useRef, useState } from 'react'
import './App.css'
import { addCv, listCvs, deleteCv, getCv } from './storage'

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

	async function handleUpload(event) {
		const file = event.target.files && event.target.files[0]
		if (!file) return
		setError('')
		try {
			const id = await addCv(file)
			const fresh = await listCvs()
			setItems(fresh)
		} catch (e) {
			setError(e?.message || 'Upload failed')
		} finally {
			if (fileInputRef.current) fileInputRef.current.value = ''
		}
	}

	async function handleAddDummy() {
		setError('')
		try {
			const samples = [
				{
					name: 'John-Doe-CV.txt',
					mime: 'text/plain',
					content: 'John Doe\nSenior Software Engineer\nSkills: React, Node.js, PostgreSQL, AWS\nExperience: 8+ years building web apps.'
				},
				{
					name: 'Jane-Smith-Resume.txt',
					mime: 'text/plain',
					content: 'Jane Smith\nProduct Manager\nSkills: Roadmapping, Analytics, UX, A/B Testing\nExperience: 6+ years in product-led startups.'
				},
				{
					name: 'Alex-UX-Portfolio.txt',
					mime: 'text/plain',
					content: 'Alex Kim\nUX Designer\nSkills: Figma, Prototyping, User Research\nExperience: 5+ years, fintech and healthtech.'
				}
			]

			for (const s of samples) {
				const file = new File([new Blob([s.content], { type: s.mime })], s.name, { type: s.mime })
				// eslint-disable-next-line no-await-in-loop
				await addCv(file)
			}
			const fresh = await listCvs()
			setItems(fresh)
		} catch (e) {
			setError(e?.message || 'Failed to add dummy CVs')
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

	async function handleDownload(id) {
		const record = await getCv(id)
		if (record) downloadBlob(record)
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


			<div className="upload-card">
				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg"
					onChange={handleUpload}
				/>
				<div style={{ marginTop: '0.75rem' }}>
					<button onClick={handleAddDummy}>Add sample CVs</button>
				</div>
			</div>

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
								<button onClick={() => handleDownload(r.id)}>Download</button>
								<button className="danger" onClick={() => handleDelete(r.id)}>Delete</button>
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
