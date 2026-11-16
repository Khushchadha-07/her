// All persistence is local: owners in localStorage, imported media blobs in IndexedDB.
export type Owner = 'me'|'her'
const OK = 'dm.owners.v1'
export const loadOwners = (): Record<string,Owner> => { try { return JSON.parse(localStorage.getItem(OK)||'{}') } catch { return {} } }
export const saveOwners = (o: Record<string,Owner>) => localStorage.setItem(OK, JSON.stringify(o))
const db = (): Promise<IDBDatabase> => new Promise((res,rej)=>{ const r = indexedDB.open('dm-media',1); r.onupgradeneeded=()=>r.result.createObjectStore('f'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error) })
export const putMedia = async (k:string, b:Blob) => { const d = await db(); await new Promise<void>((res,rej)=>{ const t=d.transaction('f','readwrite'); t.objectStore('f').put(b,k); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error) }) }
export const allMedia = async (): Promise<Record<string,Blob>> => { const d = await db(); return new Promise(res=>{ const o:Record<string,Blob>={}; const r=d.transaction('f').objectStore('f').openCursor(); r.onsuccess=()=>{ const c=r.result; if(c){o[c.key as string]=c.value;c.continue()} else res(o) }; r.onerror=()=>res(o) }) }
export const delMedia = async (k:string) => { const d = await db(); d.transaction('f','readwrite').objectStore('f').delete(k) }
