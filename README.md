# PES Smart Attendance

A Smart Attendance. It combines faculty-managed attendance sessions, GPS geofencing, face verification, attendance reporting, marks, schedules, and parent read-only access.

## Prerequisites

- **Node.js 20+** ([Download](https://nodejs.org/))
- **Python 3.11+** ([Download](https://www.python.org/downloads/))
- **XAMPP** with MySQL ([Download](https://www.apachefriends.org/))

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
# Database (XAMPP MySQL - default credentials)
DATABASE_URL="mysql://root:@localhost:3306/smart_attendance"

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

### Step 3: Setup Database

1. Start XAMPP and launch MySQL service
2. Open phpMyAdmin (http://localhost/phpmyadmin)
3. Create a new database named `smart_attendance`
4. Run Prisma migrations and seed demo data:

```powershell
npm --prefix server run prisma:generate
npm --prefix server run prisma:push
npm --prefix server run seed
```

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

> **Important**: Ensure XAMPP MySQL is running before starting the backend service.

### Default Demo Users

After running the seed script, you can log in with these accounts:

| Role    | Email/Username       | Password   |
|---------|---------------------|------------|
| Admin   | admin@pesu.pes.edu  | admin123   |
| Faculty | faculty@pesu.pes.edu| faculty123 |
| Student | student@pesu.pes.edu| student123 |
| Parent  | parent@pesu.pes.edu | parent123  |

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
```powershell
# Frontend tests
npm run test

# Backend tests
npm --prefix server run test

# Face service tests
face-service\.venv\Scripts\python -m unittest discover -s face-service\tests
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
- Ensure XAMPP MySQL service is running
- Verify database `smart_attendance` exists in phpMyAdmin
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
   - Start XAMPP and ensure MySQL is running
   - Verify `.env` is configured correctly
   - Start all three services (face service, backend, frontend)

2. **Demo credentials are seeded** - see Default Demo Users table above

3. **No external services required** - Everything runs locally

4. **Key features to demonstrate**:
   - Multi-role authentication (Admin, Faculty, Student, Parent)
   - Face enrollment and verification
   - GPS-based geofencing for attendance
   - Real-time attendance tracking
   - Attendance analytics and reporting
   - Marks management by faculty
   - Parent dashboard (read-only access)