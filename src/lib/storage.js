/** IndexedDB project storage for Family Frame */
const DB_NAME = 'family-frame-db'
const DB_VERSION = 1
const STORE = 'projects'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  })
}

export async function listProjects() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const list = (req.result || []).map((p) => ({
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        photoCount: p.photoCount || 0,
      }))
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      resolve(list)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function loadProject(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function saveProject(project) {
  const db = await openDB()
  const payload = {
    ...project,
    updatedAt: Date.now(),
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).put(payload)
    req.onsuccess = () => resolve(payload)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteProject(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}
