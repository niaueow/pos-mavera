# POS Mavera — Food Ordering & Order Tracking System

POS Mavera adalah aplikasi pemesanan makanan, pembayaran digital (Midtrans Snap), dan pelacakan pesanan berbasis web untuk **Ayam Geprek Mavera**.

Repository ini dikembangkan secara kolaboratif menggunakan arsitektur monorepo dengan pemisahan folder frontend (`client/`) dan backend (`server/`).

Anggota Kelompok:
Sabira Putri Cahyani - 2310512048
Shabrina Rahmania -2310512071
Callysta Cendikia Diba Putri - 2310512079
---

## 1. Arsitektur & Teknologi

- **Backend:** Node.js 20 LTS, Express.js, TypeScript, Prisma ORM, Zod, Vitest.
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Axios.
- **Database:** PostgreSQL 15+ (Lokal untuk development; Render Managed PostgreSQL untuk staging/production).
- **Payment Gateway:** Midtrans Snap (Sandbox untuk development).
- **Hosting Targets:** Vercel (Frontend), Render (Backend & Database).

---

## 2. Struktur Monorepo

```text
pos-mavera/
├── .env.example                 # Template environment monorepo
├── .gitignore                   # Proteksi Git: .env, node_modules, build artifacts
├── AGENTS.md                    # Aturan pengerjaan & development guidelines
├── README.md                    # Panduan setup tim & dokumentasi proyek
├── docs/                        # Dokumentasi spesifikasi resmi
│   ├── PRD.md                   # Product Requirements Document
│   ├── TECHNICAL_DECISIONS.md   # Keputusan teknis yang disepakati
│   ├── IMPLEMENTATION_PLAN.md   # Rencana implementasi & audit per fase
│   ├── DESIGN.md                # Panduan sistem desain & UI/UX
│   └── API.md                   # Kontrak resmi REST API kanonis
├── client/                      # Frontend package (React + Vite)
└── server/                      # Backend package (Express + TypeScript + Prisma)
    ├── prisma/
    │   ├── schema.prisma        # Sumber bersama schema database
    │   ├── migrations/          # Migration SQL version-controlled
    │   ├── seed.ts              # Idempotent development seeder
    │   └── menu.xlsx            # Source of truth menu resmi Mavera
    ├── src/
    │   ├── config/              # Validasi env (Zod) & Prisma client
    │   ├── middlewares/         # Centralized error & 404 handler
    │   ├── utils/               # Standardized API response envelopes
    │   ├── app.ts               # Express app factory (testable)
    │   └── server.ts            # Server HTTP listener entry point
    └── tests/                   # Automated tests (Vitest + Supertest)
```

---

## 3. Prasyarat Sistem Lokal (Setiap Anggota Tim)

Pastikan dependensi berikut terpasang di komputer lokal masing-masing anggota:

1. **Node.js:** Versi `v20.x` LTS atau `v22.x` (`node -v`).
2. **npm:** Versi `10.x` (`npm -v`).
3. **PostgreSQL:** Versi `15`, `16`, atau `17` berjalan secara lokal (port default `5432`).

---

## 4. Panduan Setup Lokal untuk 3 Anggota Tim

Ikuti langkah-langkah di bawah ini secara berurutan setelah melakukan clone repository:

### Langkah 1: Install Dependensi Proyek

Jalankan perintah ini di root folder repository:

```bash
npm install
```

Atau masuk ke direktori `server/`:

```bash
cd server
npm install
```

---

### Langkah 2: Konfigurasi File Lingkungan (`.env`)

1. Salin template konfigurasi `.env.example` ke file `.env` di folder `server/` (atau di root):
   ```bash
   cp server/.env.example server/.env
   ```
2. Buka file `server/.env` dan sesuaikan koneksi database lokal Anda:
   ```env
   NODE_ENV=development
   PORT=5000

   # Format: postgresql://<USER>:<PASSWORD>@localhost:5432/<DATABASE_NAME>?schema=public
   DATABASE_URL=postgresql://postgres:password_postgres_kamu@localhost:5432/pos_mavera?schema=public

   # Kredensial & Secrets Development
   JWT_SECRET=dev_jwt_secret_change_in_production_min_32_characters_long
   JWT_EXPIRES_IN=8h
   FRONTEND_URL=http://localhost:5173

   # Midtrans Sandbox Placeholder
   MIDTRANS_SERVER_KEY=SB-Mid-server-REPLACE_WITH_YOUR_KEY
   MIDTRANS_CLIENT_KEY=SB-Mid-client-REPLACE_WITH_YOUR_KEY
   MIDTRANS_IS_PRODUCTION=false

   # Akun Pengujian Awal (Staff Dapur & Admin)
   INITIAL_STAFF_EMAIL=staff@mavera.local
   INITIAL_STAFF_PASSWORD=StaffMavera123!
   INITIAL_ADMIN_EMAIL=admin@mavera.local
   INITIAL_ADMIN_PASSWORD=AdminMavera123!
   ```

> [!WARNING]
> **PENTING UNTUK KEAMANAN GIT:**  
> File `.env` sudah masuk dalam `.gitignore` dan **TIDAK BOLEH** di-commit ke Git repository. Jangan pernah membagikan password atau Server Key Midtrans asli di commit Git.

---

### Langkah 3: Siapkan Database PostgreSQL Lokal

Buat database bernama `pos_mavera` di PostgreSQL lokal Anda. Anda dapat menggunakan `psql` atau pgAdmin:

**Menggunakan `psql`:**
```bash
psql -U postgres -h localhost -c "CREATE DATABASE pos_mavera;"
```

---

### Langkah 4: Terapkan Migrasi Database (Prisma Migration)

Gunakan migrasi yang sudah disediakan di folder `server/prisma/migrations/`. Semua anggota tim memakai migrasi yang sama agar struktur database seragam dan tidak terjadi *schema drift*:

```bash
cd server
npm run prisma:generate
npm run prisma:deploy
```

*(Atau gunakan `npx prisma migrate dev` jika Anda mengembangkan perubahan schema baru).*

---

### Langkah 5: Jalankan Seed Menu Resmi & Akun Operator

Seed script mengambil data resmi dari spreadsheet `server/prisma/menu.xlsx` dan membuat akun pengujian:
- **35 menu item resmi** Ayam Geprek Mavera (kategori: *Ayam Geprek*, *Ala Carte*, *Minuman*) lengkap dengan harga IDR, ketersediaan, status pedas (`hasSpiceLevel`), dan urutan display (`sortOrder`).
- Akun Staff Dapur: `staff@mavera.local` (Password: `StaffMavera123!`)
- Akun Admin: `admin@mavera.local` (Password: `AdminMavera123!`)

Jalankan perintah:

```bash
npm run prisma:seed
```

> [!NOTE]
> Script seeder bersifat **idempotent**. Anda dapat menjalankannya berulang kali tanpa risiko membuat data duplikat atau merusak pesanan yang sudah ada. Seeder otomatis menolak dijalankan jika `NODE_ENV=production`.

---

### Langkah 6: Jalankan Pengujian Otomatis

Pastikan backend lulus pengujian automated test suite:

```bash
npm test
```

Semua pengujian unit dan integration test pada `server/tests/health.test.ts` harus berstatus **PASSED**.

---

### Langkah 7: Jalankan Backend Development Server

Jalankan backend dengan hot-reload:

```bash
npm run dev
```

Aplikasi backend akan aktif di:
`http://localhost:5000`

---

## 5. Verifikasi Instalasi

Untuk memastikan instalasi berhasil, buka browser atau gunakan `curl`:

1. **Health Check Root:**
   ```bash
   curl http://localhost:5000/health
   ```
   *Respon yang diharapkan (`200 OK`):*
   ```json
   {
     "success": true,
     "message": "POS Mavera API is healthy",
     "data": {
       "status": "UP",
       "timestamp": "2026-10-18T...",
       "environment": "development"
     }
   }
   ```

2. **Health Check API v1:**
   ```bash
   curl http://localhost:5000/api/v1/health
   ```

3. **Verifikasi Build Produksi:**
   ```bash
   npm run build
   ```
   Pastikan compiler TypeScript (`tsc`) selesai tanpa error dan menghasilkan output di folder `server/dist/`.

---

## 6. Aturan Kolaborasi untuk 3 Anggota Tim

1. **Schema Prisma sebagai Single Source of Truth:** Jangan mengubah tabel langsung di database (pgAdmin). Selalu ubah melalui `server/prisma/schema.prisma` dan generate migration via `npx prisma migrate dev`.
2. **Koordinasi Database Remote:** Dilarang keras menjalankan perintah reset database (`npx prisma migrate reset`) atau migration terhadap database staging/production di Render tanpa persetujuan seluruh tim.
3. **Idempotensi Seeder:** Jika menambahkan menu atau fixtures baru, pastikan menggunakan pola `upsert` agar tidak menduplikasi data anggota lain.
4. **Git Safety:** Jangan commit file kredensial lokal (`.env`, `.env.local`). Sebelum membuat pull request, jalankan `npm run build` dan `npm test` di lokal masing-masing.
