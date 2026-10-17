# DineTime React Frontend

This Vite application contains the landing page and five role-based portals:

| Member | Name | Portal | Folder |
| --- | --- | --- | --- |
| Member 1 | Tejdeep Reddy | Diner | `src/apps/diner` |
| Member 2 | Bharat T | Restaurant Manager | `src/apps/manager` |
| Member 3 | Mahanth Naik | Restaurant Staff | `src/apps/restaurant-staff` |
| Member 4 | Naga Varshith | Sub-admin | `src/apps/sub-admin` |
| Member 5 | Tharun Reddy | Super-admin | `src/apps/super-admin` |

The Individual Contribution are there in their respective folder.(
See each portal README for its individual contribution scope and file
ownership.)

## Setup

### 1. Prerequisites

- Node.js 22.13 or later
- npm
- A modern browser
- The backend in the sibling `Backend` folder

### 2. Install dependencies

Run this from the current `React_frontend` folder:

```sh
npm ci
```

The frontend uses React 19, Vite 7, Leaflet, QRCode, and Prettier.

### 3. Configure the environment

Copy `.env.example` to `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux/Git Bash:

```sh
cp .env.example .env
```

Set:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Do not commit `.env`. Never put real passwords, JWT secrets, private API
keys, or payment credentials in a `VITE_*` variable because it is exposed to
the browser.

### 4. Start the backend

Open a second terminal in the sibling backend folder:

```sh
cd ../Backend
npm ci
npm run build
npm start
```

The backend runs at `http://localhost:3000`. API documentation is available
at `http://localhost:3000/api-docs`.

### 5. Start the frontend

Return to `React_frontend` and run:

```sh
npm run dev
```

Open `http://127.0.0.1:5173`.

## Portal URLs

- Landing page: `http://127.0.0.1:5173/`
- Diner: `http://127.0.0.1:5173/diner/login`
- Staff: `http://127.0.0.1:5173/restaurant-staff/`
- Manager: `http://127.0.0.1:5173/manager/`
- Sub-admin: `http://127.0.0.1:5173/sub-admin/`
- Super-admin: `http://127.0.0.1:5173/super-admin/`

## Local demo credentials

These seeded credentials are for local development only:

| Role | Email | Password |
| --- | --- | --- |
| Diner | `johndoe@gmail.com` | `password123` |
| Restaurant Manager | `manager@dinetime.com` | `password123` |
| Restaurant Staff | `staff@dinetime.com` | `password123` |
| Support Admin | `support@dinetime.com` | `admin123` |
| Verification Admin | `verification@dinetime.com` | `admin123` |
| Finance Admin | `finance@dinetime.com` | `admin123` |
| Super-admin | `admin@dinetime.com` | `admin123` |

Payments are demo-only. Never reuse these credentials in production.

## Testing and production build

Run these commands from `React_frontend`:

```sh
npm test
npm run format:check
npm run build
```

- `npm test` runs frontend regression and source-convention tests.
- `npm run format:check` checks JavaScript and JSX formatting.
- `npm run build` creates the production bundle in `dist/`.

Preview the production bundle with:

```sh
npm run preview
```

Open `http://127.0.0.1:4173` while the backend remains running.
