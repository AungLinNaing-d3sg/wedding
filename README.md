# Wedding Invite Flipbook (React + Vite + Tailwind)

Navy + baby-blue magazine/flipbook invitation with RSVP to Google Sheets and admin-only exports.

## 🚀 Quick Start
```bash
npm i
cp .env.example .env   # set VITE_SHEETS_WEB_APP_URL & VITE_ADMIN_CODE
npm run dev
```

- Admin mode: open the site with `?admin=YOUR_CODE` or click **Admin login** in the header.
- Replace the cover image via query: `?img=https://your-image.jpg`

## 📊 Google Sheets (Apps Script) Endpoint
Set `VITE_SHEETS_WEB_APP_URL` to your Apps Script web app URL. Expected API:
- `GET  <URL>?action=list` → returns an array of RSVP rows
- `POST <URL>` with JSON body `{"action":"add","entry":{...}}`

The client normalizes returned keys like `Name`/`Timestamp` to `name`/`timestamp`.

## 🧰 Google Apps Script Template
See `apps-script/Code.gs` for a drop-in backend you can deploy as a Web App and paste the URL into `.env`.

## 🧩 Tech
- React 18 + Vite 5
- TailwindCSS 3
- react-pageflip
- xlsx (export fallback to CSV)
