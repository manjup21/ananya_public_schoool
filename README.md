# Ananya Public School — ERP

ERP for **Ananya Public School** (Shree Shyamalamba Educational Trust Regd.), CHIKKABENNURU, NH - 48, CHITRADURGA.

Forked from Genius Techno Residential School (`Techno_School`) with its own database and branding.

## Local setup

- **DB:** `ananya_public_school_erp` (Postgres)
- **API port:** `5025`
- **Cookie:** `ananya_erp_token`

```powershell
cd backend; npm ci; npm run dev
cd UI; npm ci; npm run generate-pwa-icons; npm run dev
```

## Branding

- School name / address / codes for PDFs: `UI/src/config/collegeReport.js`
- Logo assets live in `UI/public/`; after replacing them, run `npm run generate-pwa-icons` from `UI/`
