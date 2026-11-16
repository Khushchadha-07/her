// Converts source/messages.json (Discord export) -> src/data/messages.json and reports every anomaly.
import fs from 'node:fs'
let raw = fs.readFileSync('source/messages.json','utf8')
raw = raw.replace(/"ID":\s*(\d+)/g,'"ID":"$1"') // snowflakes exceed 2^53: keep as strings
const src = JSON.parse(raw), errors = []
const kind = e => /^(jpe?g|png|gif|webp|bmp|avif)$/.test(e)?'image':/^(mp4|webm|mov|m4v|mkv)$/.test(e)?'video':'file'
const out = []
for (const m of src) {
  const t = new Date(m.Timestamp.replace(' ','T')+'Z')
  if (isNaN(+t) || !m.ID) { errors.push({id:m.ID,reason:'bad id/timestamp'}); continue }
  const a = (m.Attachments||'').split(/\s+/).filter(Boolean).map((url,i)=>{
    const name = decodeURIComponent(url.split('?')[0].split('/').pop()||'file'), ext = (name.split('.').pop()||'').toLowerCase()
    return {k:`${m.ID}-${i}`, url, name, ext, kind:kind(ext)}
  })
  out.push({id:m.ID, t:t.toISOString(), c:m.Contents, a})
}
out.sort((x,y)=> x.id.length-y.id.length || (x.id<y.id?-1:x.id>y.id?1:0))
for (let i=1;i<out.length;i++) if (out[i].t<out[i-1].t) errors.push({id:out[i].id,reason:'timestamp out of order vs id'})
fs.writeFileSync('src/data/messages.json', JSON.stringify(out))
const rep = {source:src.length, imported:out.length, errors, withAttachments:out.filter(m=>m.a.length).length, attachmentUrls:out.flatMap(m=>m.a).length, first:out[0].t, last:out.at(-1).t}
fs.writeFileSync('import-report.json', JSON.stringify(rep,null,2)); console.log(rep)
if (rep.source!==rep.imported) { console.error('MISMATCH: not all messages imported'); process.exit(1) }
