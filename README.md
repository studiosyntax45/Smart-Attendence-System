# PES Smart Attendance

A college attendance system for PES University. Students mark attendance with face verification inside a GPS geofence while their faculty has a session open. On top of that it covers marks and results, attendance health and low-attendance alerts, leave requests and appeals, an audit log, bulk CSV imports, and a read-only parent view.

## Prerequisites

- **Node.js 20+** ([Download](https://nodejs.org/))
- **Python 3.11+** ([Download](https://www.python.org/downloads/))
- **MySQL 8** with **MySQL Workbench** ([Download](https://dev.mysql.com/downloads/workbench/)) — the schema is browsed with Prisma Studio

## Local Setup

### Step 1: Install JavaScript Dependencies

Clone the repository and install all Node.js dependencies:

```powershell
npm install
npm --prefix server install
```

### Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env` in the project root:

```powershell
copy .env.example .env
```

2. Generate JWT secrets (required for authentication):

```powershell
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
```

3. Open `.env` and update these required values:

```env
# Database (local MySQL 8 — use the root password you set during MySQL install)
DATABASE_URL="mysql://root:YOUR_MYSQL_PASSWORD@localhost:3306/smart_attendance"

# JWT Secrets (paste the generated values from step 2)
JWT_ACCESS_SECRET=your-generated-access-secret-here
JWT_REFRESH_SECRET=your-generated-refresh-secret-here
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# College Domain
COLLEGE_DOMAIN=pesu.pes.edu

# CORS - Frontend origin
WEB_ORIGIN=http://localhost:3000

# Face Service
FACE_SERVICE_URL=http://localhost:8000
FACE_SERVICE_TOKEN=
FACE_SERVICE_TIMEOUT_MS=15000

# Backend Server
PORT=4000

# Frontend Environment Variables
VITE_API_BASE_URL=http://localhost:4000
VITE_COLLEGE_DOMAIN=pesu.pes.edu
VITE_FACE_VERIFICATION=true
```

> **Note**: For Google OAuth (optional), add your credentials from [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
> - `GOOGLE_CLIENT_ID`
> - `GOOGLE_CLIENT_SECRET`
> - `GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback`
>
> Without them the Google button returns to the login page with a short explanation, and everyone signs in with email and password.

> **Optional: AI performance feedback.** The student dashboard can ask a local [Ollama](https://ollama.com) model for study advice. Without it, the card shows rule-based advice instead. These are the defaults:
> ```env
> OLLAMA_ENABLED=true
> OLLAMA_BASE_URL=http://127.0.0.1:11434
> OLLAMA_MODEL=qwen2.5:7b-instruct
> OLLAMA_TIMEOUT_MS=8000
> ```
> To use it, install Ollama and run `ollama pull qwen2.5:7b-instruct`. Set `OLLAMA_ENABLED=false` to always use the rule-based advice.

### Step 3: Setup Database

1. Start the MySQL 8 service (Windows: Services, or MySQL Notifier)
2. Open MySQL Workbench, connect to `localhost:3306` as `root`
3. Create the database: `CREATE DATABASE smart_attendance;`
4. Push the Prisma schema and seed demo data:

```powershell
npm --prefix server run prisma:generate
npm --prefix server run prisma:push
npm --prefix server run seed
```

5. Browse and edit rows with Prisma Studio (http://localhost:5555):

```powershell
npm --prefix server run prisma:studio
```

> MySQL Workbench is for SQL, users and backups; Prisma Studio is the quicker way
> to look at application rows during a demo.

### Step 4: Setup Face Recognition Service

1. Create a Python virtual environment:

```powershell
python -m venv face-service\.venv
```

2. Activate the virtual environment and install dependencies:

```powershell
face-service\.venv\Scripts\activate
pip install -r face-service\requirements.txt
deactivate
```

> **Troubleshooting**: If you encounter pip errors, try upgrading pip first:
> ```powershell
> face-service\.venv\Scripts\python -m pip install --upgrade pip
> ```

## Running the Application

### Start All Services

Open **three separate PowerShell terminals** from the project root and run these commands:

#### Terminal 1: Face Recognition Service
```powershell
face-service\.venv\Scripts\python -m uvicorn app:app --app-dir face-service --host 127.0.0.1 --port 8000
```

#### Terminal 2: Express Backend API
```powershell
npm --prefix server run dev
```

#### Terminal 3: Vite Frontend
```powershell
npm run dev
```

### Access the Application

Once all services are running:
- **Frontend**: http://localhost:3000 (Open this URL in your browser)
- **Backend API**: http://localhost:4000
- **Face Service**: http://localhost:8000

> **Important**: Ensure the MySQL service is running before starting the backend service.

### Default Demo Users

After running the seed script, you can log in with these accounts:

| Role    | Email/Username       | Password   |
|---------|---------------------|------------|
| Admin   | admin@pesu.pes.edu  | Pes@12345   |
| Faculty | faculty@pesu.pes.edu| Pes@12345 |
| Student | student@pesu.pes.edu| Pes@12345 |

The seed also creates a CSE Sem-5 cohort of 24 students (`PES1UG23CS001`–`024`, e.g.
`nandini.murthy@pesu.pes.edu`), two more faculty, four courses with attendance, marks,
leave, appeals, notifications and audit history. Every seeded account uses the password
`Pes@12345`. Re-running the seed is safe.

## Development Commands

### Type Checking
```powershell
# Frontend type checking
npm run typecheck

# Backend type checking
npm --prefix server run typecheck
```

### Building for Production
```powershell
# Build frontend
npm run build

# Build backend
npm --prefix server run build
```

### Testing
The test files are kept out of the demo build, in a git stash on this branch. A stash lives only in the local clone and is not pushed:

```powershell
git stash list    # "test files (removed from working tree for the demo build)"
git checkout 759a952 -- "lib/*.test.ts" server/src/test face-service/tests    # older tests only
git stash pop     # new and updated tests on top
```

These checks stay in the project:

```powershell
npm run typecheck
npm --prefix server run typecheck
npm run check:encoding
```

### Database Management
```powershell
# Generate Prisma Client
npm --prefix server run prisma:generate

# Push schema changes to database
npm --prefix server run prisma:push

# Run migrations (development)
npm --prefix server run prisma:migrate

# Open Prisma Studio (database GUI)
npm --prefix server run prisma:studio

# Reseed database
npm --prefix server run seed
```

## Troubleshooting

### MySQL Connection Issues
- Ensure the MySQL 8 service is running
- Verify database `smart_attendance` exists (MySQL Workbench → Schemas)
- Check `DATABASE_URL` in `.env` matches your MySQL credentials

### Face Service Errors
- Verify Python version: `python --version` (should be 3.11+)
- Reinstall dependencies: `pip install -r face-service\requirements.txt`
- Check port 8000 is not already in use

### Port Conflicts
If default ports are occupied:
1. Update `PORT` in `.env` for backend
2. Update `VITE_API_BASE_URL` to match backend port
3. Update `FACE_SERVICE_URL` if changing face service port

### JWT Secret Not Set
If you see authentication errors:
- Ensure JWT secrets are generated and set in `.env`
- Restart the backend service after updating `.env`

### "You appear to be … m from the classroom"
The seeded room, Room B-204, uses fixed coordinates. Sign in as admin, open Dashboard → Classroom geofences, stand in the real room and click **Use my current location**.

### Face enrolment fails
With `VITE_FACE_VERIFICATION=true`, enrolment sends one photo to the face service, so that service must be running on port 8000. The camera needs a real webcam, and the browser allows it on `localhost`.

## Project Structure

```
smart-attendance/
├── app/                    # Frontend routes (Next.js-style routing)
├── components/             # React components
├── face-service/           # Python FastAPI face recognition service
├── server/                 # Express backend API
│   ├── src/
│   └── prisma/            # Database schema and migrations
├── lib/                   # Frontend utilities
├── hooks/                 # React hooks
├── stores/                # Zustand state management
└── public/                # Static assets
```

## For Viva/Demo Presentation

1. **Before the demo**:
   - Start the MySQL service and confirm the connection in MySQL Workbench
   - Verify `.env` is configured correctly
   - Start all three services (face service, backend, frontend). Ollama is optional.
   - Move the Room B-204 geofence to the room you are presenting in (see Troubleshooting)
   - Enrol one student's face on the demo laptop beforehand

2. **Demo credentials are seeded** - see Default Demo Users table above. Parents sign in at `/parent-login` with their child's student email and password.

3. **No external services required** - Everything runs locally. Notifications are demo-only; no SMS or email is sent.

4. **Key features to demonstrate**:
   - Multi-role authentication (Admin, Faculty, Student, Parent), with admin password reset for forgotten passwords
   - Face enrollment and verification
   - GPS-based geofencing for attendance, with a per-session radius (default 100 m)
   - Live attendance roster as students mark in
   - Attendance health: students grouped as 75% and above, 65–74%, and below 65%, plus low-attendance alerts
   - Attendance record search with filters; CSV/PDF export of the filtered rows
   - Marks and results (CGPA), with performance analytics
   - Leave requests (date range) and per-session appeals, with faculty review and comments
   - Audit log of who changed what
   - Parent dashboard (read-only)
   - Bulk CSV import with a preview before anything is saved: students, faculty, courses, enrollments, weekly timetable, attendance corrections and marks. Templates can be downloaded on each import screen, and copies are in `public/templates/`.