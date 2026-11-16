// Tries to download each attachment into public/media/. Expired links will fail; that is reported, nothing is faked.
import fs from 'node:fs'
const msgs = JSON.parse(fs.readFileSync('src/data/messages.json','utf8')); const log = []
for (const m of msgs) for (const a of m.a) {
  const file = `public/media/${a.k}.${a.ext}`
  if (fs.existsSync(file)) { log.push({k:a.k,ok:true,note:'already present'}); continue }
  let ok = false, note = ''
  for (const url of [a.url, a.url.split('?')[0]]) {
    try { const r = await fetch(url); if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); ok = true; break } note = 'HTTP '+r.status } catch (e) { note = String(e.cause?.code||e.message) }
  }
  log.push({k:a.k, name:a.name, ok, note}); console.log(ok?'OK  ':'FAIL', a.name, note)
}
fs.writeFileSync('media-report.json', JSON.stringify(log,null,2))
console.log(`${log.filter(l=>l.ok).length}/${log.length} recovered`)
