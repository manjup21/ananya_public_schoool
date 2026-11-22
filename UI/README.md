# Ananya Public School ERP UI

React + Vite PWA for Ananya Public School administration (attendance, examinations, fees, notifications).

Branding: logo assets live in `public/`; after replacing them, run `npm run generate-pwa-icons`.

```bash
cp .env.example .env
# Set VITE_API_URL=http://localhost:5025/api
# Set VITE_AES_KEY_BASE64 to match backend AES_KEY_BASE64
npm install
npm run generate-pwa-icons
npm run dev
```

App: `http://localhost:5173`
