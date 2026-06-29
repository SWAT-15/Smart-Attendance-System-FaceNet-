#  Smart Attendance System — Project Introduction

> A production-grade, biometric-verified, anti-spoofing attendance platform built for universities and institutions. No proxies, no buddy-punching, no paper sheets.

---

##  What Is This System?

The **Smart Attendance System** is a full-stack web application that replaces traditional manual or RFID-based attendance with a **multi-layered biometric verification pipeline**. A teacher starts a session; a time-sensitive rotating QR code appears on the projector. Each student scans the QR code with their phone, passes an on-device **liveness detection** check (blink or head-turn), and is then verified against their enrolled face embedding via **FaceNet cosine similarity** — all in under 10 seconds.

The system is designed to be:

-  **Tamper-proof** — rotating QR codes invalidate every 12 seconds; screenshots are useless
-  **Anti-spoof** — on-device MediaPipe liveness detection rejects photos and videos
-  **Biometric** — 512-dimensional FaceNet embeddings ensure the right student is present
-  **Real-time** — WebSocket push updates let teachers watch attendance populate live
- ️ **Free-tier deployable** — runs entirely on Supabase + Upstash + Railway + Vercel free tiers

---

##  Key Features

###  Time-Sensitive Rotating QR Codes
- Each active session generates a new QR token **every 12 seconds** stored in **Upstash Redis** with TTL
- The QR payload is a signed, session-scoped token — not a static URL
- Old tokens are invalidated automatically; a screenshot taken 13 seconds ago is permanently useless
- The teacher's projector view auto-fetches and re-renders the new QR without any manual refresh

### ️ On-Device Liveness Detection
- Built with **TensorFlow.js** and **@tensorflow-models/face-landmarks-detection** (MediaPipe FaceMesh 468-point mesh)
- Students must complete one of: **eye blink** (EAR ratio drop < 0.25) or **head turn** (yaw angle > 20°)
- All inference runs **entirely in the browser** — no video is ever sent to the server
- Only after passing liveness does the student's face snapshot proceed to FaceNet verification
- Defeats photo attacks, video replays, and mask-based spoofing attempts

###  FaceNet Biometric Face Verification
- ML service runs **InceptionResnetV1** (pretrained on VGGFace2 via `facenet-pytorch`)
- **MTCNN** handles face detection and alignment before embedding generation
- Embeddings are **512-dimensional float vectors** stored in Supabase using the **pgvector** extension
- Verification uses **cosine similarity** with a configurable threshold of **0.80**
- Similarity ≥ 0.80 →  PRESENT; below threshold →  rejected (wrong person or spoof)
- Students can have multiple enrolled embeddings (different angles, lighting) for robustness

###  Google OAuth2 Login (Domain-Restricted)
- Authentication via **Google OAuth2** with **Spring Security**
- Domain restriction can be configured to allow only `@yourinstitution.edu` emails
- On first login, the backend auto-provisions a user record linked to the Google profile
- Role assignment (ADMIN / TEACHER / STUDENT) is managed by admin post-creation
- JWT tokens are issued after OAuth callback for stateless API authentication

###  Real-Time WebSocket Updates
- Backend exposes a **STOMP-over-SockJS** WebSocket endpoint
- When a student successfully marks attendance, a push event fires to the teacher's session topic
- Teacher's projector view shows student name, photo thumbnail, and timestamp appear in real time
- No polling — pure event-driven; scales cleanly across concurrent sessions

###  Auto-Absent Marking
- When a teacher clicks **End Session**, the backend computes the symmetric difference between enrolled students and present students for that subject
- Every student who did **not** scan is automatically inserted as `status = ABSENT`
- This ensures 100% session coverage — no manual reconciliation needed
- Absentees receive an optional email notification (configurable)

### ️ Admin Panel
- Full CRUD for: **Students**, **Teachers**, **Branches**, **Years**, **Subjects**, **Subject-Teacher assignments**
- **Bulk CSV upload** for student registration (name, email, roll number, branch, year)
- Student enable/disable toggle (disabled students cannot mark attendance)
- View all sessions, attendance records, and face enrollment status per student
- Manage face embeddings: re-enroll, delete, or view enrollment count per student

###  Face Enrollment System
- **Admin-side webcam capture**: Admin opens enrollment panel, selects student, captures 5 photos via webcam — embeddings generated and stored
- **Student self-enrollment**: Students can go to `/student/enroll`, capture their own face (with liveness gate to prevent photo upload), embeddings stored pending admin approval
- Each student can have up to **10 embeddings** for multi-pose robustness
- Enrollment quality check: MTCNN confidence < 0.95 rejects blurry or off-angle captures

###  Reports & Analytics
- **Per-student attendance percentage** across any date range or subject
- **Session-level attendance sheets** (who was present, who was absent, timestamps)
- **Export to CSV** — compatible with Excel and Google Sheets
- **Teacher dashboard** — historical session list, completion stats
- **Admin analytics** — institution-wide attendance heatmaps per branch/year/subject

###  Fully Free-Tier Deployable

| Service | Free Tier Limits | Used For |
|---|---|---|
| Supabase | 500 MB DB, 2 GB bandwidth | PostgreSQL + pgvector embeddings |
| Upstash Redis | 10,000 commands/day | QR token rotation |
| Railway | 500 hours/month | Spring Boot + FastAPI |
| Vercel | Unlimited hobby deploys | Next.js frontend |

---

## ️ Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Backend** | Spring Boot | 3.2 — REST API, business logic |
| | Spring Security | OAuth2 Resource Server + JWT |
| | Spring Data JPA | Hibernate ORM, entity relationships |
| | Lombok | Boilerplate reduction |
| **Database** | Supabase (PostgreSQL) | v15 + pgvector extension for embeddings |
| **Cache / QR** | Upstash Redis | Serverless, HTTP-based, 12s TTL tokens |
| **Authentication** | Google OAuth2 + JWT | Domain-restricted, stateless after login |
| **Real-Time** | Spring WebSocket (STOMP/SockJS) | Live attendance push to projector |
| **ML / Face** | Python FastAPI | Microservice exposing `/embed` + `/verify` |
| | facenet-pytorch | InceptionResnetV1 pretrained on VGGFace2 |
| | MTCNN | Face detection + alignment |
| **Frontend** | Next.js 14 (App Router) | TypeScript, server + client components |
| | Tailwind CSS | Utility-first styling |
| **Liveness** | TensorFlow.js | In-browser ML inference |
| | MediaPipe FaceMesh | 468-landmark mesh via `@tensorflow-models/face-landmarks-detection` |
| **QR Scanning** | jsQR | Real-time camera frame decoding |
| **Deployment** | Railway | Backend + ML containerized services |
| | Vercel | Frontend CDN deployment |

---

## ️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                               │
│                                                                     │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────────┐   │
│  │  Teacher    │   │   Student    │   │  Admin Dashboard       │   │
│  │  Projector  │   │   Scanner    │   │  (CRUD + Enrollment)   │   │
│  │  (WebSocket)│   │  (jsQR +     │   │                        │   │
│  │             │   │  TF.js Live) │   │                        │   │
│  └──────┬──────┘   └──────┬───────┘   └───────────┬────────────┘   │
│         │  Next.js 14 (App Router / TypeScript)    │               │
└─────────┼──────────────────┼───────────────────────┼───────────────┘
          │  HTTPS / WSS     │  REST + WebSocket      │  REST
          ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SPRING BOOT 3.2 BACKEND                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Auth Layer  │  │  REST API    │  │  WebSocket Broker        │  │
│  │  (OAuth2 +   │  │  Controllers │  │  (STOMP / SockJS)        │  │
│  │   JWT)       │  │              │  │                          │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────────────┘  │
│                           │                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Service Layer                              │   │
│  │  AttendanceService | QRService | FaceService | SessionService│   │
│  └────────┬───────────┴─────┬─────┴──────┬──────┴──────────────┘   │
└───────────┼─────────────────┼────────────┼────────────────────────┘
            │                 │            │
            ▼                 ▼            ▼
  ┌─────────────────┐  ┌────────────┐  ┌──────────────────────────┐
  │    SUPABASE     │  │  UPSTASH   │  │   PYTHON ML SERVICE      │
  │  (PostgreSQL 15)│  │   REDIS    │  │   (FastAPI + FaceNet)    │
  │                 │  │            │  │                          │
  │  • users        │  │  QR tokens │  │  POST /embed             │
  │  • sessions     │  │  (12s TTL) │  │   → 512-dim embedding    │
  │  • attendance   │  │            │  │                          │
  │  • face_embeds  │  │            │  │  POST /verify            │
  │    (pgvector)   │  │            │  │   → cosine similarity    │
  └─────────────────┘  └────────────┘  └──────────────────────────┘
```

---

##  User Roles & Capabilities

###  Admin
The Admin has unrestricted access to all system functions.

| Capability | Details |
|---|---|
| Manage Branches | Create / edit / delete academic branches (CS, EE, ME, etc.) |
| Manage Years | Configure year levels (1st year, 2nd year, etc.) |
| Manage Subjects | Create subjects, assign to branch+year combinations |
| Manage Teachers | Register teachers, assign subjects, enable/disable |
| Manage Students | Register students, assign to branch+year, bulk CSV import |
| Face Enrollment | Enroll student faces via webcam, manage/delete embeddings |
| View All Sessions | See all historical sessions by any teacher |
| View All Attendance | Export full institution attendance records as CSV |
| System Settings | Configure domain restriction, attendance threshold, liveness settings |
| Approve Self-Enrollment | Review and approve student self-enrolled face embeddings |

###  Teacher
Teachers manage their own assigned sessions and subjects.

| Capability | Details |
|---|---|
| Create Session | Choose subject → create a new attendance session |
| Start Session | Activates QR rotation, opens session to student scans |
| Projector View | Full-screen display of rotating QR + live scan feed |
| End Session | Closes session, triggers auto-absent marking |
| View Session History | See all past sessions for their subjects |
| View Attendance | Per-session attendance list (present/absent) |
| Export Session Report | Download session attendance as CSV |
| View Student Profiles | See enrolled students and their face enrollment status |

###  Student
Students interact with the system only during active sessions.

| Capability | Details |
|---|---|
| Scan QR Code | Use phone camera to scan the session QR code |
| Liveness Check | Complete blink or head-turn challenge via TensorFlow.js |
| Face Verification | Camera capture sent to FaceNet for identity confirmation |
| View Own Attendance | See per-subject attendance percentage and history |
| Self-Enrollment | Enroll own face (pending admin approval) |
| View Session Status | See if their attendance was marked successfully |

---

##  Security Architecture

### 6-Step Attendance Verification Pipeline

Every attendance marking attempt goes through all 6 steps in sequence. Failure at any step aborts the process.

```
STEP 1 — QR TOKEN VALIDATION
──────────────────────────────────────────────────────────────
  Student scans QR → token extracted → backend looks up token
  in Upstash Redis → token must exist (not expired, TTL 12s)
  → token is session-scoped (cannot be reused for other sessions)

   Failure: Token expired or not found → "QR code expired, please rescan"

STEP 2 — JWT AUTHENTICATION
──────────────────────────────────────────────────────────────
  Request must carry valid JWT in Authorization header
  → backend validates signature, expiry, and issuer
  → extracted user identity must match a student record

   Failure: Invalid/expired JWT → 401 Unauthorized

STEP 3 — SESSION ELIGIBILITY
──────────────────────────────────────────────────────────────
  Student must be enrolled in the subject linked to the session
  → session must be in ACTIVE state (not ended/cancelled)
  → student must not have already marked attendance for this session

   Failure: Not enrolled, session closed, or duplicate scan → 403 Forbidden

STEP 4 — LIVENESS VERIFICATION
──────────────────────────────────────────────────────────────
  TensorFlow.js MediaPipe FaceMesh runs in-browser
  → 468 facial landmarks tracked in real-time
  → EAR (Eye Aspect Ratio) measured for blink detection
  → Yaw angle measured for head-turn detection
  → A challenge token is signed by frontend upon completion

   Failure: No liveness event detected within 30 seconds → retry required

STEP 5 — FACE CAPTURE & EMBEDDING
──────────────────────────────────────────────────────────────
  Post-liveness frame captured → sent to ML service
  → MTCNN detects and aligns face (confidence threshold 0.95)
  → InceptionResnetV1 generates 512-dim L2-normalised embedding

   Failure: No face detected, low confidence, or multiple faces → rejected

STEP 6 — COSINE SIMILARITY VERIFICATION
──────────────────────────────────────────────────────────────
  New embedding compared against all stored embeddings for
  the authenticated student using pgvector cosine distance
  → similarity = 1 - cosine_distance
  → best match score must be ≥ 0.80

   Pass: attendance record written as PRESENT with timestamp
   Failure: Score < 0.80 → "Face not recognised, please try again"
```

### Additional Security Measures

| Measure | Implementation |
|---|---|
| **Domain restriction** | Only `@institution.edu` emails can complete OAuth login |
| **CSRF protection** | Stateless JWT eliminates CSRF; SameSite cookie policy enforced |
| **Rate limiting** | Max 5 verification attempts per student per session |
| **Embedding encryption** | pgvector rows are in a private Supabase schema (RLS enabled) |
| **No raw video storage** | Only the single post-liveness frame is ever transmitted |
| **Token single-use** | QR tokens are deleted from Redis immediately after first scan use |
| **HTTPS enforcement** | Camera API requires secure context; HTTP blocked in production |

---

*For setup instructions, environment configuration, and deployment guide, see [README.md](./README.md).*
