#  Smart Attendance System — Setup & Developer Guide

> Complete step-by-step instructions to get the Smart Attendance System running locally, configure all third-party services, and deploy to production.

**New here?** Read [intro.md](./intro.md) first for a full system overview, architecture diagram, and feature breakdown.

---

##  Prerequisites

Ensure the following are installed on your machine before proceeding.

| Tool | Minimum Version | Check Command | Download |
|---|---|---|---|
| Java (JDK) | 17+ | `java -version` | [Adoptium](https://adoptium.net) |
| Maven | 3.8+ | `mvn -version` | [maven.apache.org](https://maven.apache.org) |
| Node.js | 18+ | `node -version` | [nodejs.org](https://nodejs.org) |
| npm | 9+ | `npm -version` | Bundled with Node.js |
| Python | 3.11+ | `python --version` | [python.org](https://python.org) |
| Docker Desktop | Latest | `docker -version` | [docker.com](https://www.docker.com/products/docker-desktop) |
| Git | 2.30+ | `git --version` | [git-scm.com](https://git-scm.com) |

> [!IMPORTANT]
> Python **3.11** is strongly recommended. `facenet-pytorch` has known compatibility issues with Python 3.12+ due to PyTorch build constraints. Use `pyenv` or `conda` to manage versions if needed.

Verify everything is ready:

```bash
java -version
# Expected: openjdk version "17.x.x" or later

mvn -version
# Expected: Apache Maven 3.x.x

node -version
# Expected: v18.x.x or later

python --version
# Expected: Python 3.11.x

docker -version
# Expected: Docker version 24.x.x or later

git --version
# Expected: git version 2.x.x
```

---

##  Quick Start with Docker (Recommended)

Docker is the fastest way to get all three services running with a single command. It spins up the Spring Boot backend, Next.js frontend, FastAPI ML service, a local PostgreSQL database, and a local Redis instance — all pre-configured and networked together.

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-org/attendance-system.git
cd attendance-system
```

### Step 2 — Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

Open `.env` in your editor and fill in your credentials. See the **[Environment Variables Setup](#-environment-variables-setup-detailed)** section below for exactly where to get each value.

### Step 3 — Build and Start All Services

```bash
docker-compose up --build
```

The first build downloads dependencies and PyTorch model weights (~90 MB). Subsequent starts are fast. You will see logs from all 4 containers streaming in your terminal.

> [!TIP]
> Run `docker-compose up --build -d` to run in detached (background) mode. Use `docker-compose logs -f` to follow logs afterwards.

### Step 4 — Access the Application

| Service | URL | Notes |
|---|---|---|
|  Frontend | http://localhost:3000 | Next.js app — start here |
| ️ Backend API | http://localhost:8080/api/swagger-ui.html | Swagger UI for all REST endpoints |
|  ML Service | http://localhost:8001/docs | FastAPI auto-generated docs |
| ️ Local DB | localhost:5432 | PostgreSQL (Docker only) |

> [!NOTE]
> In Docker mode, the system uses a **local PostgreSQL** container and a **local Redis** container — NOT Supabase or Upstash. This is perfect for local development. For cloud deployment, skip docker-compose and deploy each service individually (see **[Production Deployment](#-production-deployment)**).

---

##  Environment Variables Setup (Detailed)

Fill in your `.env` file with the values from each service below. Every variable is explained with exactly where to find it.

---

### ️ Supabase (Database)

Supabase provides a free hosted PostgreSQL 15 database with the `pgvector` extension pre-installed.

**Setup steps:**
1. Go to [https://supabase.com](https://supabase.com) → **Sign up / Log in**
2. Click **New Project** → choose your organisation → set a strong database password → select a region close to you → **Create new project**
3. Wait ~2 minutes for the project to provision

**Getting the connection URL:**
1. In your project dashboard → **Settings** (gear icon) → **Database**
2. Scroll to **Connection string** → select **URI** tab → select **Transaction** mode (port 6543, not 5432)
3. Copy the URI — it looks like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
4. Change the scheme from `postgresql://` to `jdbc:postgresql://` for Spring Boot

**Getting API Keys:**
1. **Settings** → **API**
2. Copy **Project URL**, **anon / public** key, and **service_role** key

```dotenv
# --- SUPABASE ---

# Transaction-mode pooler URL (port 6543). Change postgresql:// → jdbc:postgresql://
# Add ?sslmode=require at the end
SUPABASE_DB_URL=jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require

# Format: postgres.[project_ref]  (found in Settings → Database → User)
SUPABASE_DB_USER=postgres.abcdefghijklmnop

# The password you set when creating the project
SUPABASE_DB_PASSWORD=your_very_strong_password

# Your project URL (Settings → API → Project URL)
SUPABASE_URL=https://abcdefghijklmnop.supabase.co

# anon / public key (Settings → API → Project API keys → anon public)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# service_role key — KEEP THIS SECRET, never expose to frontend
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> [!CAUTION]
> The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Never expose it in client-side code or commit it to version control. Add `.env` to your `.gitignore` immediately.

---

###  Upstash Redis (QR Token Cache)

Upstash provides a serverless Redis instance accessible over HTTPS — perfect for free-tier deployment with Railway/Vercel.

**Setup steps:**
1. Go to [https://upstash.com](https://upstash.com) → **Sign up / Log in**
2. Click **Create Database**
3. Name your database (e.g., `attendance-qr-cache`)
4. Select **Regional** (choose the region closest to your backend deployment)
5. Click **Create**

**Getting credentials:**
1. On the database details page, scroll to **REST API** or **Connect** tab
2. Copy the **Endpoint** (host), **Port**, and **Password**

```dotenv
# --- UPSTASH REDIS ---

# Endpoint from Upstash console (e.g., usw1-fine-crane-12345.upstash.io)
UPSTASH_REDIS_HOST=your-database-name.upstash.io

# Default Redis port
UPSTASH_REDIS_PORT=6379

# From Upstash console → your database → Connect → Password
UPSTASH_REDIS_PASSWORD=AXxx_long_random_password_here
```

---

###  Google OAuth2

Google OAuth2 handles all user login. No username/password system exists — every user logs in via their Google account.

**Setup steps:**
1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services** → **OAuth consent screen**
   - Choose **External** user type → fill in App name, support email, developer email → **Save and Continue**
   - No scopes needed beyond the default (email, profile, openid) → **Save and Continue**
   - Add test users if in testing mode → **Save and Continue**
4. Navigate to **APIs & Services** → **Credentials**
5. Click **+ Create Credentials** → **OAuth 2.0 Client ID**
6. Application type: **Web application**
7. Under **Authorised redirect URIs**, add:
   ```
   http://localhost:8080/api/auth/oauth2/callback/google
   ```
8. Click **Create** → copy the **Client ID** and **Client secret**

```dotenv
# --- GOOGLE OAUTH2 ---

# Client ID from Google Cloud Console (ends in .apps.googleusercontent.com)
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com

# Client Secret from Google Cloud Console
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

---

###  JWT Secret

The backend signs JWT tokens with this secret. Generate a strong random value — never use a short or guessable string.

```bash
# Run this in your terminal to generate a secure 256-bit secret:
openssl rand -base64 32
```

```dotenv
# --- JWT ---

# Paste the output of: openssl rand -base64 32
JWT_SECRET=k3F8mPqR2sXvYz7aBcDeHiJlNoTuWxZa9bCdEfGhIjKlMnOpQr==

# Token validity in milliseconds (86400000 = 24 hours)
JWT_EXPIRATION_MS=86400000
```

---

###  Frontend

```dotenv
# --- FRONTEND ---

# URL of the backend API (change this to your Railway URL in production)
NEXT_PUBLIC_API_URL=http://localhost:8080/api

# URL of the ML service (used server-side only)
FACENET_SERVICE_URL=http://localhost:8001
```

---

###  Complete `.env` Template

```dotenv
# ============================================================
# SUPABASE (Database)
# ============================================================
SUPABASE_DB_URL=jdbc:postgresql://aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require
SUPABASE_DB_USER=postgres.YOUR_PROJECT_REF
SUPABASE_DB_PASSWORD=your_database_password
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ============================================================
# UPSTASH REDIS (QR Token Cache)
# ============================================================
UPSTASH_REDIS_HOST=your-db.upstash.io
UPSTASH_REDIS_PORT=6379
UPSTASH_REDIS_PASSWORD=your_redis_password

# ============================================================
# GOOGLE OAUTH2
# ============================================================
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret

# ============================================================
# JWT
# ============================================================
JWT_SECRET=your_base64_secret_here
JWT_EXPIRATION_MS=86400000

# ============================================================
# FRONTEND
# ============================================================
NEXT_PUBLIC_API_URL=http://localhost:8080/api
FACENET_SERVICE_URL=http://localhost:8001
```

---

## ️ Database Schema Setup

The database schema must be applied to Supabase before the application can run. This only needs to be done once.

### Step 1 — Enable pgvector Extension

In your Supabase dashboard:
1. Go to **Database** → **Extensions**
2. Search for **vector**
3. Toggle it **ON**

Alternatively, run this in the SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 2 — Apply the Schema

1. In Supabase dashboard → **SQL Editor** → **New Query**
2. Open `schema.sql` from the project root in your editor
3. Copy the entire contents and paste into the SQL Editor
4. Click **Run** (or press `Ctrl+Enter`)

The schema creates the following tables:

| Table | Purpose |
|---|---|
| `users` | All users (students, teachers, admins) with Google OAuth info |
| `branches` | Academic branches/departments |
| `years` | Year levels within branches |
| `subjects` | Subjects linked to branch + year |
| `teacher_subjects` | Many-to-many: teacher ↔ subject assignments |
| `student_subjects` | Many-to-many: student ↔ subject enrollments |
| `sessions` | Attendance sessions created by teachers |
| `attendance_records` | Per-student attendance (PRESENT / ABSENT) per session |
| `face_embeddings` | 512-dim pgvector embeddings per student |

The schema also creates:
- `ivfflat` index on `face_embeddings.embedding` for fast cosine similarity search
- Row Level Security (RLS) policies on sensitive tables
- `updated_at` auto-update triggers

### Step 3 — Seed Initial Admin User

After running the schema, you need to create the first admin user manually (since Google OAuth creates users with `STUDENT` role by default on first login).

**Option A — Before first login (recommended):**
1. Supabase Dashboard → **Table Editor** → `users` table
2. Click **Insert row**
3. Fill in:
   - `email`: your Google account email
   - `name`: your name
   - `role`: `ADMIN`
   - `is_enabled`: `true`
   - `google_id`: leave blank for now (will be filled on first OAuth login)

**Option B — After first login:**
1. Log in with your Google account (you'll be created as STUDENT)
2. Supabase Dashboard → **Table Editor** → `users`
3. Find your record → click **Edit** → change `role` to `ADMIN` → **Save**

---

##  Manual Setup (Without Docker)

If you prefer to run each service directly without Docker, follow these steps. You'll need Supabase and Upstash already configured.

### Backend (Spring Boot)

```bash
# Navigate to the backend directory
cd backend

# Ensure your .env is loaded (or export variables manually)
# On Windows PowerShell:
Get-Content ../.env | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.+)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

# Build and run
mvn spring-boot:run

# Or build a JAR first and then run it:
mvn clean package -DskipTests
java -jar target/attendance-system-*.jar
```

The backend starts on **http://localhost:8080**. You should see Spring Boot banner in the logs and `Started AttendanceSystemApplication` when it's ready.

### Frontend (Next.js)

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend starts on **http://localhost:3000**. The development server supports Hot Module Replacement (HMR) — changes are reflected instantly without restart.

To build for production locally:

```bash
npm run build
npm start
```

### ML Service (FastAPI + FaceNet)

```bash
# Navigate to the ML service directory
cd ml-service

# Create a virtual environment (recommended)
python -m venv venv

# Activate it:
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies (this may take 2-5 minutes; PyTorch is large)
pip install -r requirements.txt

# Start the service
python main.py

# Or use uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

The ML service starts on **http://localhost:8001**. The first startup downloads InceptionResnetV1 model weights (~90 MB) from PyTorch Hub — subsequent starts are instant.

> [!NOTE]
> The ML service exposes two endpoints:
> - `POST /embed` — accepts a face image, returns a 512-dim embedding vector
> - `POST /verify` — accepts an image + stored embedding, returns cosine similarity score
> - `GET /health` — health check (returns `{"status": "ok"}`)

---

##  First-Run Setup Order

Follow this exact sequence to get the system working end-to-end for the first time.

```
1.  Apply database schema
   └── Supabase SQL Editor → run schema.sql → run seed (pgvector extension)

2.  Start all services
   └── docker-compose up --build
       OR start backend + frontend + ml-service manually

3.  Create first admin user
   └── Option A: Insert directly into users table in Supabase dashboard
   └── Option B: Log in with Google → then update role to ADMIN in Supabase

4.  Log in as Admin
   └── http://localhost:3000 → Sign in with Google
   └── You'll be redirected to /admin dashboard

5.  Set up academic structure
   └── Admin Dashboard → Branches → Create Branch (e.g., "Computer Science")
   └── Admin Dashboard → Years → Create Year (e.g., "3rd Year") → assign to branch
   └── Admin Dashboard → Subjects → Create Subject (e.g., "Data Structures")
         → assign to branch + year

6.  Register Students
   └── Admin Dashboard → Students → Add Student (individual)
   └── OR: Students → Bulk Import → upload CSV file
   └── CSV format: name, email, roll_number, branch_id, year_id

7.  Register Teachers & Assign Subjects
   └── Admin Dashboard → Teachers → Add Teacher → assign subject(s)
   └── Teachers must use their Google email to log in

8.  Enroll Student Faces
   └── Admin Dashboard → Face Enrollment → select student
   └── Click "Start Webcam Capture" → capture 5 photos
   └── System sends to ML service → embeddings stored in Supabase
   └── Confirm: enrollment count shows 5/5

9.  Teacher Creates a Session
   └── Teacher logs in at http://localhost:3000 with Google
   └── /teacher → My Subjects → select subject → Create Session
   └── Set session name + date → Save

10.  Teacher Starts the Session
    └── /teacher → Sessions → select session → Start Session
    └── Open Projector View (opens full-screen QR display)
    └── QR rotates every 12 seconds automatically

11.  Students Scan & Verify
    └── Students go to http://localhost:3000/student/scanner (on their phone)
    └── Point camera at QR code on projector
    └── Complete liveness check (blink or head turn)
    └── Face is captured and verified →  PRESENT marked
    └── Teacher's projector shows the student's name appear in real time

12.  Teacher Ends the Session
    └── /teacher → Sessions → End Session
    └── All students who did not scan are automatically marked ABSENT
    └── Session report is now available for export
```

---

##  Production Deployment

###  Backend — Railway

Railway automatically detects the Spring Boot project and builds it using Maven.

1. Go to [https://railway.app](https://railway.app) → **New Project**
2. Click **Deploy from GitHub repo** → authorise Railway → select your repository
3. Railway auto-detects the `backend/` folder. If not, set **Root Directory** to `backend`
4. Go to **Variables** tab → add every variable from your `.env` file (all `SUPABASE_*`, `UPSTASH_*`, `GOOGLE_*`, `JWT_*` variables)
5. Also add:
   ```
   FACENET_SERVICE_URL=https://your-ml-service.railway.app
   ```
   (you will set this after deploying the ML service)
6. Click **Deploy** → wait for build to complete (~3-5 minutes)
7. Go to **Settings** → **Networking** → **Generate Domain** → copy the URL

> [!TIP]
> Railway uses `Dockerfile` if present, otherwise falls back to Buildpacks (Nixpacks). Both work. For consistent builds, keep the `Dockerfile` in `backend/`.

---

###  ML Service — Railway

1. In the same Railway project → click **+ New Service** → **GitHub Repo** → same repo
2. Set **Root Directory** to `ml-service`
3. Railway will detect the `Dockerfile` in `ml-service/` and use it automatically
4. Add environment variables:
   ```
   PORT=8001
   ```
5. Set **Health Check Path** to `/health` in the service settings
6. Click **Deploy** → first deploy is slower due to PyTorch model download
7. Copy the generated URL → go back to backend service → update `FACENET_SERVICE_URL`

---

### ▲ Frontend — Vercel

1. Go to [https://vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Set **Root Directory** to `frontend`
4. Under **Environment Variables**, add:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-service.railway.app/api
   ```
5. Click **Deploy** → Vercel builds and deploys in ~2 minutes
6. Copy your Vercel URL (e.g., `https://attendance-system.vercel.app`)

---

###  Update Google OAuth Redirect URI for Production

After deploying, you must register the production redirect URI in Google Cloud Console:

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. Click your OAuth 2.0 Client ID
3. Under **Authorised redirect URIs**, click **+ Add URI**
4. Add: `https://your-backend-service.railway.app/api/auth/oauth2/callback/google`
5. Click **Save**

> [!WARNING]
> The redirect URI must match **exactly** — including the path, no trailing slash. A mismatch causes `redirect_uri_mismatch` error and blocks all logins.

---

##  Docker Compose Details

The `docker-compose.yml` defines 4 services that work together in a local network:

```yaml
# Summary of services defined in docker-compose.yml

services:
  postgres:          # Local PostgreSQL 15 with pgvector
    port: 5432
    volume: postgres_data (persistent)

  redis:             # Local Redis 7
    port: 6379

  backend:           # Spring Boot 3.2 (Java 17)
    port: 8080
    depends_on: [postgres, redis]
    env: connects to local postgres + redis (not Supabase/Upstash)

  ml-service:        # FastAPI + FaceNet (Python 3.11)
    port: 8001
    depends_on: [backend]

  frontend:          # Next.js 14 (Node 18)
    port: 3000
    depends_on: [backend]
```

**Important notes about Docker mode:**
- The backend connects to the **local PostgreSQL** container, not Supabase
- Redis connections go to the **local Redis** container, not Upstash
- The local PostgreSQL container includes the `pgvector` extension pre-installed
- Data persists between restarts via Docker volumes
- To wipe all data and start fresh: `docker-compose down -v`

**Useful Docker commands:**

```bash
# Start all services (background)
docker-compose up -d

# View logs from all services
docker-compose logs -f

# View logs from a specific service
docker-compose logs -f backend

# Restart a single service after code change
docker-compose up --build backend

# Stop all services
docker-compose down

# Stop and delete all data volumes (full reset)
docker-compose down -v

# Check status of all containers
docker-compose ps
```

---

##  Troubleshooting

###  Port already in use

```bash
# Find and kill the process using port 8080 (Linux/Mac):
lsof -ti:8080 | xargs kill

# Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process

# Or change the port in application.properties:
server.port=8090
```

###  Camera not working on student scanner

The browser's `getUserMedia` API (camera access) requires a **secure context**:
-  `http://localhost` — always works (localhost is exempt)
-  `https://your-domain.com` — works in production
-  `http://192.168.1.x` — blocked by browsers (non-localhost HTTP)

**Fix for local network testing:**
- Use `mkcert` to create a locally-trusted HTTPS certificate
- Or access via `http://localhost:3000` on the same machine
- Or expose via a tunnel: `npx localtunnel --port 3000`

###  Face enrollment fails (MTCNN confidence too low)

The ML service requires clear, well-lit face images. Follow these guidelines:
-  Ensure bright, even lighting (face natural light or a desk lamp)
-  Remove glasses if possible (reflections reduce confidence)
-  Face the camera directly — avoid tilting more than 15° in any direction
-  Position your face to fill about 60% of the frame
- ️ Use a plain, non-cluttered background

If MTCNN confidence is still below 0.95, try increasing the `min_face_size` parameter in `ml-service/main.py`.

###  QR code expires before student can scan

Symptom: Students see "QR code expired" even when scanning immediately.

Causes and fixes:
1. **Upstash Redis not connected** — Check `UPSTASH_REDIS_HOST`, `UPSTASH_REDIS_PORT`, `UPSTASH_REDIS_PASSWORD` in your `.env`
2. **Clock skew** — Ensure your server and Upstash are in sync (use NTP)
3. **QR rotation too fast** — Change `QR_ROTATION_SECONDS=12` to `30` in your backend config for testing

```bash
# Test Upstash connectivity from your backend host:
redis-cli -h your-db.upstash.io -p 6379 -a your_password PING
# Expected response: PONG
```

###  Google OAuth redirect_uri_mismatch error

```
Error 400: redirect_uri_mismatch
```

This means the redirect URI in your Google Cloud Console doesn't match what the backend is sending.

**Fix:**
1. In Google Cloud Console → Credentials → your OAuth client
2. Check **Authorised redirect URIs**
3. Ensure it contains **exactly**: `http://localhost:8080/api/auth/oauth2/callback/google`
4. No trailing slash, no extra spaces, exact path
5. For production, add the Railway URL version too

###  ML service is slow on first request

Normal behaviour — PyTorch downloads the InceptionResnetV1 model weights (~90 MB) from PyTorch Hub on first startup. After the first run, the weights are cached locally. In Docker, the weights are re-downloaded each time the container is rebuilt unless you add a volume mount for the cache directory.

To pre-cache in Docker:

```dockerfile
# Add to ml-service/Dockerfile after pip install:
RUN python -c "from facenet_pytorch import InceptionResnetV1; InceptionResnetV1(pretrained='vggface2')"
```

###  Supabase connection pool exhausted

```
HikariPool: Connection is not available, request timed out after 30000ms
```

Supabase free tier allows **max 5 connections** on the transaction mode pooler. The backend is pre-configured to respect this:

```properties
# backend/src/main/resources/application.properties
spring.datasource.hikari.maximum-pool-size=4
spring.datasource.hikari.minimum-idle=1
```

If you're seeing this error, ensure no other clients are connected to your Supabase database simultaneously (e.g., DBeaver, TablePlus, or other backend instances).

###  Frontend shows "Network Error" calling the backend

Check that `NEXT_PUBLIC_API_URL` is set correctly:
- Local: `http://localhost:8080/api` (no trailing slash)
- Production: `https://your-backend.railway.app/api`

Also ensure the backend has the correct CORS configuration to allow requests from your frontend origin.

---

##  API Documentation

The backend exposes a fully documented REST API via **Swagger UI** (OpenAPI 3.0).

| Environment | Swagger URL |
|---|---|
| Local | http://localhost:8080/api/swagger-ui.html |
| Production | https://your-backend.railway.app/api/swagger-ui.html |

### Using Swagger with Authentication

Since all endpoints (except `/auth/**`) require JWT authentication:

1. Open Swagger UI in your browser
2. Click **Authorize** ( button at the top right)
3. In the **BearerAuth** field, paste your JWT token (without the `Bearer ` prefix)
4. Click **Authorize** → **Close**
5. All subsequent requests will include your token

**To get your JWT token:**
1. Log in via the frontend (`http://localhost:3000`)
2. Open browser DevTools → **Application** → **Local Storage** → `localhost:3000`
3. Copy the `token` value

### Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/auth/oauth2/login` | Initiate Google OAuth flow |
| `GET` | `/auth/me` | Get current authenticated user |
| `POST` | `/sessions` | Create a new attendance session |
| `PUT` | `/sessions/{id}/start` | Start session (activates QR rotation) |
| `PUT` | `/sessions/{id}/end` | End session (triggers auto-absent) |
| `GET` | `/sessions/{id}/qr` | Get current QR token for session |
| `POST` | `/attendance/verify` | Submit face + QR for attendance marking |
| `GET` | `/attendance/session/{id}` | Get attendance records for a session |
| `GET` | `/students` | List all students (admin only) |
| `POST` | `/students/bulk-import` | CSV bulk upload (admin only) |
| `POST` | `/face/enroll/{studentId}` | Enroll face embedding for a student |
| `GET` | `/reports/student/{id}` | Get attendance report for a student |
| `GET` | `/reports/session/{id}/export` | Download session CSV report |

---

##  Project Structure

```
Attendance System/
├── backend/                        # Spring Boot 3.2 (Java 17)
│   ├── pom.xml                     # Maven dependencies
│   ├── Dockerfile                  # Container definition
│   └── src/main/java/com/attendance/
│       ├── AttendanceSystemApplication.java   # Entry point
│       ├── controller/             # REST API controllers
│       │   ├── AuthController.java
│       │   ├── SessionController.java
│       │   ├── AttendanceController.java
│       │   ├── StudentController.java
│       │   ├── TeacherController.java
│       │   ├── FaceController.java
│       │   └── ReportController.java
│       ├── service/                # Business logic layer
│       │   ├── AttendanceService.java
│       │   ├── QRService.java      # Redis token rotation
│       │   ├── FaceService.java    # ML service integration
│       │   ├── SessionService.java
│       │   └── ReportService.java
│       ├── entity/                 # JPA entities (DB tables)
│       │   ├── User.java
│       │   ├── Session.java
│       │   ├── AttendanceRecord.java
│       │   ├── FaceEmbedding.java  # pgvector float[] column
│       │   ├── Subject.java
│       │   ├── Branch.java
│       │   └── Year.java
│       ├── repository/             # Spring Data JPA repos
│       ├── security/               # Auth & JWT
│       │   ├── JwtTokenProvider.java
│       │   ├── OAuth2UserService.java
│       │   └── SecurityConfig.java
│       ├── config/                 # Config beans
│       │   ├── WebSocketConfig.java
│       │   ├── RedisConfig.java
│       │   └── CorsConfig.java
│       └── dto/                    # Request/Response objects
│           ├── AttendanceRequest.java
│           ├── FaceVerifyResponse.java
│           └── SessionResponse.java
│
├── frontend/                       # Next.js 14 (TypeScript)
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── src/app/
│       ├── layout.tsx              # Root layout + auth provider
│       ├── page.tsx                # Landing / login page
│       ├── admin/                  # Admin dashboard
│       │   ├── page.tsx            # Dashboard overview
│       │   ├── students/           # Student CRUD + CSV upload
│       │   ├── teachers/           # Teacher management
│       │   ├── subjects/           # Subject + branch + year
│       │   ├── enrollment/         # Face enrollment webcam UI
│       │   └── reports/            # Attendance analytics
│       ├── teacher/                # Teacher portal
│       │   ├── page.tsx            # Teacher dashboard
│       │   ├── sessions/           # Session management
│       │   └── projector/          # Full-screen QR projector
│       └── student/                # Student portal
│           ├── page.tsx            # Student dashboard
│           ├── scanner/            # QR scan + liveness + face verify
│           │   └── LivenessCamera.tsx  # TF.js MediaPipe component
│           └── enrollment/         # Student self-enrollment
│
├── ml-service/                     # Python 3.11 FastAPI + FaceNet
│   ├── main.py                     # FastAPI app: /embed, /verify, /health
│   ├── face_utils.py               # MTCNN + InceptionResnetV1 helpers
│   ├── requirements.txt            # facenet-pytorch, torch, fastapi, etc.
│   └── Dockerfile                  # Python container with CUDA support
│
├── docker-compose.yml              # Local dev orchestration (4 services)
├── schema.sql                      # Full DB schema with pgvector
├── seed.sql                        # Initial data / admin bootstrap
├── .env.example                    # Template for environment variables
├── README.md                       # This file
└── intro.md                        # System overview and architecture
```

---

##  Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes with clear, descriptive commits
4. Ensure the backend builds: `mvn clean package`
5. Ensure the frontend builds: `npm run build`
6. Submit a pull request with a clear description of what changed and why

---

##  License

This project is licensed under the MIT License. See `LICENSE` file for details.

---

*Built with ️ for institutions that deserve better than paper attendance sheets.*
