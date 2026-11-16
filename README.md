# Private Discord DM Recreation

A local-only recreation of one Discord DM (channel `982519354799300669`). Nothing is uploaded; the app makes no network
requests except if you open a link or an original (expired) CDN attachment URL. No analytics, no backend, no accounts.

## Run it (Windows)
1. Install Node.js 18+ from nodejs.org.
2. In a terminal in this folder: `npm install` then `npm run dev`
3. Open http://127.0.0.1:5173

Data is already imported (`src/data/messages.json`, 5,752 messages). To re-import from the export: put its
`messages.json` in `source/` and run `npm run prepare-data`; it writes `import-report.json` and fails loudly on any mismatch.

## Attachments
`npm run fetch-media` tries to download all 81 attachment URLs into `public/media/` (needs internet; reports to `media-report.json`).
All signed links in the export have `ex=0` (expired), so most or all will fail. For any missing file use **Import original file…**
on its placeholder; the file is stored in your browser (IndexedDB), or place it as `public/media/<attachmentKey>.<ext>`
(keys are shown in `import-report.json`/`media-report.json`, format `<messageId>-<index>`).

## Who sent what
The export has no sender IDs, so every message starts as **Unknown sender**. Tools (left sidebar):
- **Select messages**: click to toggle, Shift-click for a range; then Mark as mine/hers. (Ctrl/Shift-click works anytime.)
- **Assign date range**: by dates, optionally only unattributed messages.
- **Quick sort**: keyboard flow, `M` mine, `H` hers, `U` unknown, arrows to move, `Esc` exits; it jumps to the next unattributed message.
- Hover any message for per-message Me/Her buttons.
- **Back up corrections** saves `sender-corrections.json`; **Restore backup** reloads it. Browser storage is tied to the address
  (`127.0.0.1:5173`), so keep using the same URL and make a backup occasionally.

## Time zones
The export stores UTC. Times display in your computer's local time zone (like Discord); hover a time for the exact UTC value.

## Layout
`src/App.tsx` UI · `src/store.ts` local persistence · `scripts/` import and media fetch · `public/avatars/` the two original photos, unmodified.
