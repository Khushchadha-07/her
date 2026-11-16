import {useEffect,useMemo,useRef,useState,useCallback,memo,ReactNode} from 'react'
import raw from './data/messages.json'
import {Owner,loadOwners,saveOwners,putMedia,allMedia,delMedia} from './store'

type Att = {k:string;url:string;name:string;ext:string;kind:'image'|'video'|'file'}
type Msg = {id:string;t:string;c:string;a:Att[]}
const MSGS = raw as Msg[]
const TS = MSGS.map(m=>new Date(m.t))
const dayKey = (d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDay = (d:Date)=>d.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})
const fmtTime = (d:Date)=>d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})
const fmtFull = (d:Date)=>d.toLocaleString(undefined,{dateStyle:'full',timeStyle:'medium'})+'  ·  UTC '+d.toISOString().replace('T',' ').slice(0,19)
const NAMES:Record<string,string> = {me:'You',her:'Her',unk:'Unknown sender'}
const AV:Record<string,string> = {me:'avatars/me.png',her:'avatars/her.png'}

// Group messages into days (computed once)
const DAYS = (()=>{ const out:{key:string;date:Date;idx:number[]}[]=[]; MSGS.forEach((_,i)=>{ const k=dayKey(TS[i]); const l=out[out.length-1]; if(l&&l.key===k) l.idx.push(i); else out.push({key:k,date:TS[i],idx:[i]}) }); return out })()
const ATTS = MSGS.flatMap((m,i)=>m.a.map(a=>({a,i})))

function linkify(s:string):ReactNode[] {
  return s.split(/(https?:\/\/[^\s<]+|<a?:\w+:\d+>)/g).map((p,i)=>{
    if(/^https?:/.test(p)) return <a key={i} href={p} target="_blank" rel="noreferrer noopener">{p}</a>
    const e=p.match(/^<a?:(\w+):\d+>$/); if(e) return <span key={i} className="emote" title={`Custom emoji :${e[1]}:`}>:{e[1]}:</span>
    return p })
}

function Attachment({a,blob,onImport,onOpen,small}:{a:Att;blob?:Blob;onImport:(k:string,f:File)=>void;onOpen:(a:Att,src:string)=>void;small?:boolean}) {
  const bu = useMemo(()=>blob?URL.createObjectURL(blob):null,[blob])
  const srcs = useMemo(()=>[bu,`media/${a.k}.${a.ext}`,a.url].filter(Boolean) as string[],[bu,a])
  const [n,setN]=useState(0); useEffect(()=>setN(0),[srcs])
  const src = srcs[n]; const inp = useRef<HTMLInputElement>(null)
  const missing = !src || a.kind==='file' && n>=srcs.length
  const onErr=()=>setN(x=>x+1)
  if(a.kind==='image'&&src) return <img className={'att'+(small?' sm':'')} src={src} alt={a.name} loading="lazy" onError={onErr} onClick={()=>onOpen(a,src)}/>
  if(a.kind==='video'&&src) return <video className={'att'+(small?' sm':'')} src={src} controls preload="metadata" onError={onErr}/>
  return <div className="missing"><b>{a.kind==='file'?'📄':'🖼️'} {a.name}</b>
    <span>{missing?'Original file not recoverable':''} {a.kind==='file'&&<a href={a.url} target="_blank" rel="noreferrer noopener">Try original link</a>}</span>
    <button onClick={()=>inp.current?.click()}>Import original file…</button>
    <input ref={inp} hidden type="file" onChange={e=>{const f=e.target.files?.[0]; if(f) onImport(a.k,f)}}/></div>
}

const Row = memo(function Row({i,owner,head,sel,cur,flash,mode,media,onClick,onImport,onOpen,onSet}:{i:number;owner:Owner|undefined;head:boolean;sel:boolean;cur:boolean;flash:boolean;mode:boolean;media:Record<string,Blob>;onClick:(i:number,e:React.MouseEvent)=>void;onImport:any;onOpen:any;onSet:(i:number,o:Owner|undefined)=>void}) {
  const m=MSGS[i], d=TS[i], who=owner||'unk'
  return <div id={'m'+m.id} className={`msg${head?' head':''}${sel?' sel':''}${cur?' cur':''}${flash?' flash':''}${mode?' selmode':''}`} onClick={e=>onClick(i,e)}>
    {head? (AV[who]? <img className="avatar" src={AV[who]} alt="" onClick={e=>{e.stopPropagation();onOpen(null,AV[who],who)}}/> : <div className="avatar unk">?</div>) : <span className="gtime" title={fmtFull(d)}>{fmtTime(d)}</span>}
    <div className="body">
      {head&&<div className="meta"><span className={'name '+who}>{NAMES[who]}</span><span className="time" title={fmtFull(d)}>{fmtDay(d)} {fmtTime(d)}</span></div>}
      {m.c&&<div className="text">{linkify(m.c)}</div>}
      {m.a.length>0&&<div className="atts">{m.a.map(a=><Attachment key={a.k} a={a} blob={media[a.k]} onImport={onImport} onOpen={onOpen}/>)}</div>}
    </div>
    <div className="tools" onClick={e=>e.stopPropagation()}>
      <button title="Mark as mine" onClick={()=>onSet(i,'me')}>Me</button><button title="Mark as hers" onClick={()=>onSet(i,'her')}>Her</button>
      <button title="Copy text" onClick={()=>navigator.clipboard?.writeText(m.c)}>⧉</button>
      <button title={fmtFull(d)} onClick={()=>alert(fmtFull(d)+'\nMessage ID '+m.id)}>🕒</button>
    </div>
  </div>
})

export default function App() {
  const [owners,setOwners]=useState(loadOwners); const [media,setMedia]=useState<Record<string,Blob>>({})
  const [panel,setPanel]=useState<null|'profile'|'search'|'gallery'|'stats'>('profile')
  const [sel,setSel]=useState<Set<number>>(new Set()); const [selMode,setSelMode]=useState(false); const last=useRef(-1)
  const [q,setQ]=useState(''); const [flash,setFlash]=useState(''); const [curDay,setCurDay]=useState(fmtDay(TS[0]))
  const [modal,setModal]=useState<null|{src:string;title:string;isVideo?:boolean}>(null)
  const [sort,setSort]=useState<number|null>(null); const [range,setRange]=useState(false); const scroller=useRef<HTMLDivElement>(null)
  useEffect(()=>{allMedia().then(setMedia)},[]); useEffect(()=>saveOwners(owners),[owners])

  const jump=useCallback((i:number)=>{ setFlash(MSGS[i].id); const el=document.getElementById('m'+MSGS[i].id); el?.scrollIntoView({block:'center'}); setTimeout(()=>setFlash(''),2200) },[])
  const jumpDay=(v:string)=>{ if(!v) return; const i=MSGS.findIndex((_,j)=>dayKey(TS[j])>=v); if(i>=0) jump(i) }
  const assign=useCallback((ids:number[],o:Owner|undefined)=>setOwners(p=>{const n={...p}; ids.forEach(i=>o?n[MSGS[i].id]=o:delete n[MSGS[i].id]); return n}),[])
  const onSet=useCallback((i:number,o:Owner|undefined)=>assign([i],o),[assign])
  const onClick=useCallback((i:number,e:React.MouseEvent)=>{
    if(sort!==null){setSort(i);return}
    if(!selMode&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey) return
    setSel(p=>{const n=new Set(p); if(e.shiftKey&&last.current>=0){const [a,b]=[Math.min(last.current,i),Math.max(last.current,i)]; for(let j=a;j<=b;j++) n.add(j)} else n.has(i)?n.delete(i):n.add(i); return n}); last.current=i
  },[selMode,sort])
  const onImport=useCallback(async(k:string,f:File)=>{ await putMedia(k,f); setMedia(p=>({...p,[k]:f})) },[])
  const onOpen=useCallback((a:Att|null,src:string,who?:string)=>setModal({src,title:a?a.name:who==='me'?'You':'Her'}),[])

  // current date while scrolling
  useEffect(()=>{ const s=scroller.current!; const f=()=>{ const top=s.getBoundingClientRect().top+8; const secs=s.querySelectorAll<HTMLElement>('[data-day]'); let c=secs[0]; for(const e of secs){ if(e.getBoundingClientRect().top<=top) c=e; else break } if(c) setCurDay(c.dataset.label!) }; let t:any; const h=()=>{clearTimeout(t);t=setTimeout(f,60)}; s.addEventListener('scroll',h); return()=>s.removeEventListener('scroll',h) },[])

  // Quick-sort keyboard flow: M / H / U assign and advance to the next unassigned message; arrows move; Esc exits
  useEffect(()=>{ if(sort===null) return; const h=(e:KeyboardEvent)=>{ if((e.target as HTMLElement).tagName==='INPUT') return; const k=e.key.toLowerCase(); let i=sort
    const nextUnk=(from:number)=>{ for(let j=from+1;j<MSGS.length;j++) if(!owners[MSGS[j].id]) return j; return from }
    if(k==='m'||k==='h'){ assign([i],k==='m'?'me':'her'); i=nextUnk(i) } else if(k==='u') assign([i],undefined); else if(k==='arrowdown'||k===' '){ i=Math.min(MSGS.length-1,i+1) } else if(k==='arrowup') i=Math.max(0,i-1); else if(k==='escape'){ setSort(null); return } else return
    e.preventDefault(); setSort(i); document.getElementById('m'+MSGS[i].id)?.scrollIntoView({block:'center'}) }; window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h) },[sort,owners,assign])

  const results=useMemo(()=>{ const s=q.trim().toLowerCase(); if(s.length<2) return []; const r:number[]=[]; MSGS.forEach((m,i)=>{ if(m.c.toLowerCase().includes(s)||m.a.some(a=>a.name.toLowerCase().includes(s))) r.push(i) }); return r },[q])
  const stats=useMemo(()=>{ const mo:Record<string,number>={}, dy:Record<string,number>={}; MSGS.forEach((_,i)=>{ const d=TS[i]; const m=dayKey(d).slice(0,7); mo[m]=(mo[m]||0)+1; dy[dayKey(d)]=(dy[dayKey(d)]||0)+1 })
    return {mo:Object.entries(mo),top:Object.entries(dy).sort((a,b)=>b[1]-a[1]).slice(0,10),media:ATTS.length,days:DAYS.length,span:Math.round((+TS.at(-1)!-+TS[0])/864e5)} },[])
  const counts=useMemo(()=>{ let me=0,her=0; MSGS.forEach(m=>{const o=owners[m.id]; if(o==='me')me++; else if(o==='her')her++}); return {me,her,unk:MSGS.length-me-her} },[owners])
  const exportState=()=>{ const b=new Blob([JSON.stringify({version:1,channel:'982519354799300669',owners},null,1)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='sender-corrections.json'; a.click() }
  const importState=async(f:File)=>{ try{ const j=JSON.parse(await f.text()); if(j.owners) setOwners(p=>({...p,...j.owners})) }catch{ alert('Not a valid corrections file') } }

  return <div className="app">
    <nav className="servers"><div className="home">💬</div></nav>
    <aside className="side"><div className="search-fake">Find or start a conversation</div><div className="dmhead">DIRECT MESSAGES</div>
      <div className="dm active"><img src={AV.her} alt=""/><span>Her</span></div>
      <div className="fix"><h4>Sender attribution</h4>
        <p>{counts.me} mine · {counts.her} hers · <b>{counts.unk}</b> unknown</p>
        <button onClick={()=>{setSelMode(s=>!s);setSel(new Set())}} className={selMode?'on':''}>{selMode?'Done selecting':'Select messages'}</button>
        <button onClick={()=>setRange(true)}>Assign date range…</button>
        <button onClick={()=>{const f=MSGS.findIndex(m=>!owners[m.id]); setSort(f<0?0:f); setSelMode(false); jump(f<0?0:f)}}>Quick sort (keyboard)</button>
        <button onClick={exportState}>Back up corrections</button>
        <label className="btn">Restore backup<input hidden type="file" accept="application/json" onChange={e=>e.target.files?.[0]&&importState(e.target.files[0])}/></label></div>
      <div className="me"><img src={AV.me} alt=""/><span>You</span></div></aside>
    <main className="chat">
      <header><img src={AV.her} alt=""/><b className="title" onClick={()=>setPanel('profile')}>Her</b><span className="where">{curDay}</span>
        <div className="sp"/>
        <input type="date" title="Jump to date" min={dayKey(TS[0])} max={dayKey(TS.at(-1)!)} onChange={e=>jumpDay(e.target.value)}/>
        <button className="ic" title="Media" onClick={()=>setPanel('gallery')}>🖼</button><button className="ic" title="Statistics" onClick={()=>setPanel('stats')}>📊</button><button className="ic" title="Profile" onClick={()=>setPanel('profile')}>👤</button>
        <input className="srch" placeholder="Search" value={q} onChange={e=>{setQ(e.target.value);setPanel('search')}} onFocus={()=>setPanel('search')}/></header>
      {sort!==null&&<div className="banner">Quick sort: <kbd>M</kbd> mine · <kbd>H</kbd> hers · <kbd>U</kbd> unknown · <kbd>↑</kbd><kbd>↓</kbd> move · click a message to start there · <kbd>Esc</kbd> exit</div>}
      <div className="scroll" ref={scroller}>
        <div className="intro"><img src={AV.her} alt=""/><h1>Her</h1><p>This is the beginning of your direct message history. {MSGS.length.toLocaleString()} messages · {fmtDay(TS[0])} – {fmtDay(TS.at(-1)!)}</p></div>
        {DAYS.map(day=><section key={day.key} data-day data-label={fmtDay(day.date)} className="day"><div className="sep"><span>{fmtDay(day.date)}</span></div>
          {day.idx.map((i,n)=>{ const m=MSGS[i], o=owners[m.id], p=n>0?MSGS[day.idx[n-1]]:null
            const head=!p||(owners[p.id]||'unk')!==(o||'unk')||(+TS[i]-+TS[day.idx[n-1]])>7*60e3
            return <Row key={m.id} i={i} owner={o} head={head} sel={sel.has(i)} cur={sort===i} flash={flash===m.id} mode={selMode} media={media} onClick={onClick} onImport={onImport} onOpen={onOpen} onSet={onSet}/> })}</section>)}
      </div>
      {sel.size>0&&<div className="bar">{sel.size} selected <button onClick={()=>{assign([...sel],'me');setSel(new Set())}}>Mark as mine</button><button onClick={()=>{assign([...sel],'her');setSel(new Set())}}>Mark as hers</button><button onClick={()=>{assign([...sel],undefined);setSel(new Set())}}>Set unknown</button><button onClick={()=>setSel(new Set())}>Clear</button></div>}
    </main>
    {panel&&<aside className="panel"><button className="x" onClick={()=>setPanel(null)}>✕</button>
      {panel==='profile'&&<div className="prof"><div className="banner2"/><img src={AV.her} alt="" onClick={()=>setModal({src:AV.her,title:'Her'})}/><h2>Her</h2>
        <p className="muted">Original Discord username unavailable (exported as “Deleted User”).</p>
        <dl><dt>First message</dt><dd>{fmtDay(TS[0])}</dd><dt>Last message</dt><dd>{fmtDay(TS.at(-1)!)}</dd><dt>Total messages</dt><dd>{MSGS.length.toLocaleString()}</dd><dt>Days with messages</dt><dd>{stats.days}</dd><dt>Media shared</dt><dd>{stats.media}</dd><dt>Attributed to her</dt><dd>{counts.her}</dd></dl></div>}
      {panel==='search'&&<div><h3>Search</h3><p className="muted">{q.trim().length<2?'Type at least 2 characters':`${results.length} result${results.length===1?'':'s'}`}</p>
        {results.slice(0,300).map(i=><div key={i} className="res" onClick={()=>jump(i)}><small>{fmtDay(TS[i])} {fmtTime(TS[i])}</small><div>{MSGS[i].c.slice(0,160)||MSGS[i].a.map(a=>a.name).join(', ')}</div></div>)}{results.length>300&&<p className="muted">Showing first 300. Refine your search.</p>}</div>}
      {panel==='gallery'&&<div><h3>Media ({ATTS.length})</h3><p className="muted">Click an item to jump to its message. Unavailable items show a placeholder.</p>
        <div className="grid">{ATTS.map(({a,i})=><div key={a.k} className="cell"><Attachment a={a} blob={media[a.k]} small onImport={onImport} onOpen={(x,s)=>setModal({src:s,title:x.name})}/><button onClick={()=>jump(i)}>{fmtDay(TS[i])} →</button></div>)}</div></div>}
      {panel==='stats'&&<div><h3>Conversation statistics</h3><dl><dt>Total messages</dt><dd>{MSGS.length.toLocaleString()}</dd><dt>Span</dt><dd>{stats.span} days ({stats.days} active)</dd><dt>Media files</dt><dd>{stats.media}</dd></dl>
        <h4>Messages per month</h4>{stats.mo.map(([k,v])=><div key={k} className="bar2"><span>{k}</span><i style={{width:v/Math.max(...stats.mo.map(x=>x[1]))*100+'%'}}/><b>{v}</b></div>)}
        <h4>Most active dates</h4>{stats.top.map(([k,v])=><div key={k} className="res" onClick={()=>jumpDay(k)}>{fmtDay(new Date(k+'T12:00'))}<b style={{float:'right'}}>{v}</b></div>)}</div>}
    </aside>}
    {range&&<RangeDialog onClose={()=>setRange(false)} onApply={(a,b,o,onlyUnk)=>{ const ids:number[]=[]; MSGS.forEach((_,i)=>{const k=dayKey(TS[i]); if(k>=a&&k<=b&&(!onlyUnk||!owners[MSGS[i].id])) ids.push(i)}); assign(ids,o); setRange(false); alert(`${ids.length} messages updated`)}}/>}
    {modal&&<div className="modal" onClick={()=>setModal(null)}>{/\.(mp4|webm)/.test(modal.src)?<video src={modal.src} controls autoPlay/>:<img src={modal.src} alt={modal.title}/>}<a href={modal.src} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>Open original</a></div>}
  </div>
}

function RangeDialog({onClose,onApply}:{onClose:()=>void;onApply:(a:string,b:string,o:Owner|undefined,u:boolean)=>void}) {
  const [a,setA]=useState(dayKey(TS[0])),[b,setB]=useState(dayKey(TS.at(-1)!)),[o,setO]=useState<Owner|''>('me'),[u,setU]=useState(true)
  return <div className="modal" onClick={onClose}><div className="dlg" onClick={e=>e.stopPropagation()}><h3>Assign a date range</h3>
    <label>From <input type="date" value={a} onChange={e=>setA(e.target.value)}/></label><label>To <input type="date" value={b} onChange={e=>setB(e.target.value)}/></label>
    <label>Sender <select value={o} onChange={e=>setO(e.target.value as Owner|'')}><option value="me">Mine</option><option value="her">Hers</option><option value="">Unknown (clear)</option></select></label>
    <label className="row"><input type="checkbox" checked={u} onChange={e=>setU(e.target.checked)}/> Only messages not yet attributed</label>
    <div className="row"><button onClick={onClose}>Cancel</button><button className="pri" onClick={()=>onApply(a,b,o||undefined,u)}>Apply</button></div></div></div>
}
