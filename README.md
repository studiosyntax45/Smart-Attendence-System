# PES Smart Attendance

A college attendance system for PES University. Students mark attendance with face verification inside a GPS geofence while their faculty has a session open. On top of that it covers marks and results, attendance health and low-attendance alerts, leave requests and appeals, an audit log, bulk CSV imports, AI study advice, and a read-only parent view.

This guide assumes **no prior experience**. Follow it top to bottom and you will have the whole system running on your own laptop. It is written for **Windows 10/11**, and every command is typed into **PowerShell**.

---

## Contents

1. [How the project fits together](#1-how-the-project-fits-together)
2. [Install the tools](#2-install-the-tools)
3. [Download the project](#3-download-the-project)
4. [Install the project's packages](#4-install-the-projects-packages)
5. [Set up MySQL (the database)](#5-set-up-mysql-the-database)
6. [Create the `.env` settings file](#6-create-the-env-settings-file)
7. [Create the tables and demo data](#7-create-the-tables-and-demo-data)
8. [Set up the face service (Python)](#8-set-up-the-face-service-python)
9. [Set up Ollama (AI advice, optional)](#9-set-up-ollama-ai-advice-optional)
10. [Start everything](#10-start-everything)
11. [Log in and try it](#11-log-in-and-try-it)
12. [Everyday use](#12-everyday-use)
13. [Troubleshooting](#13-troubleshooting)
14. [Reference](#14-reference)

---

## 1. How the project fits together

The system is four programs that talk to each other, plus a database:

| Part | What it does | Folder | Runs at | Needed? |
|---|---|---|---|---|
| **Frontend** (React + Vite) | The website you open in the browser | project root | http://localhost:3000 | Yes |
| **Backend** (Node.js + Express) | Logins, attendance, marks, every API call | `server/` | http://localhost:4000 | Yes |
| **MySQL 8** | Stores all the data | installed on your PC | localhost:3306 | Yes |
| **Face service** (Python) | Checks a student's face on the server during enrolment | `face-service/` | http://localhost:8000 | Only if `VITE_FACE_VERIFICATION=true` |
| **Ollama** | Local AI model that writes study advice | installed on your PC | http://localhost:11434 | No: without it, rule-based advice is shown |

```
Browser  ──►  Frontend :3000  ──►  Backend :4000  ──►  MySQL :3306
                                        │
                                        ├──►  Face service :8000   (optional)
                                        └──►  Ollama :11434        (optional)
```

Everything runs locally. Nothing is sent to the internet, and no SMS or email is sent.

---

## 2. Install the tools

Install these once. Accept the installer defaults unless a step below says otherwise.

| Tool | Version | Download | Why |
|---|---|---|---|
| **Git** | any recent | https://git-scm.com/downloads | To download the project |
| **Node.js** | **20 or 22 (LTS)** | https://nodejs.org/ | Runs the frontend and backend |
| **MySQL Community Server** | **8.0 or 8.4** | https://dev.mysql.com/downloads/mysql/ | The database |
| **MySQL Workbench** | latest | https://dev.mysql.com/downloads/workbench/ | A window to look at the database (optional but helpful) |
| **Python** | **3.11** | https://www.python.org/downloads/release/python-3119/ | Runs the face service |
| **Ollama** | **0.5 or newer** | https://ollama.com/download | AI advice (optional) |
| **A code editor** | e.g. VS Code | https://code.visualstudio.com/ | To edit the `.env` file |

### 2.1 Node.js

Download the **LTS** installer and run it. Leave every option ticked.

### 2.2 Python 3.11

Use **3.11** exactly. The face service depends on TensorFlow, which does not support every Python version.

On the first installer screen, **tick "Add python.exe to PATH"**, then click *Install Now*.

### 2.3 MySQL Server

1. Download the MySQL Community Server installer for your system and run it.
2. When asked for a setup type, choose **Server only** (or *Custom* and pick *MySQL Server* and *MySQL Workbench*).
3. **Type and Networking**: keep port **3306**.
4. **Authentication**: keep the recommended (strong password) option.
5. **Accounts and Roles**: set a **root password** and **write it down**. You need it in step 6.
   - Tip: a password with only letters and numbers avoids an extra step later. Symbols such as `@ # % /` are allowed, but must be encoded in step 6.
6. **Windows Service**: keep *Configure MySQL Server as a Windows Service* and *Start the MySQL Server at System Startup* ticked. This keeps MySQL running in the background.
7. Finish the installer. Install **MySQL Workbench** too if it was not included.

### 2.4 Check that everything installed

**Close and reopen** PowerShell so it picks up the new programs (Start menu → type *PowerShell* → open *Windows PowerShell*). Then run:

```powershell
git --version
node --version
npm --version
py -3.11 --version
```

Each should print a version number: Node `v20.x` or `v22.x`, Python `3.11.x`.

> If `npm` fails with *"running scripts is disabled on this system"*, run this once and try again:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
> (Answer `Y` if asked.)

---

## 3. Download the project

Choose a folder for your projects, for example `Documents`, and download the code there:

```powershell
cd $HOME\Documents
git clone https://github.com/studiosyntax45/Smart-Attendence-System.git
cd Smart-Attendence-System
```

From now on, **every command in this guide is run from inside this `Smart-Attendence-System` folder** (the "project root") unless it says otherwise.

> No Git? On the GitHub page click **Code → Download ZIP**, extract it, then `cd` into the extracted folder.

---

## 4. Install the project's packages

These commands download the libraries the project uses. They take a few minutes the first time.

```powershell
npm install
npm --prefix server install
npm run download-models
```

| Command | What it installs |
|---|---|
| `npm install` | Frontend libraries (into `node_modules/`) |
| `npm --prefix server install` | Backend libraries (into `server/node_modules/`) |
| `npm run download-models` | The in-browser face-detection models (into `public/models/`, about 7 MB). **Face enrolment and marking attendance do not work without these.** |

Warnings such as `npm WARN deprecated` are normal. Only a line that says `npm ERR!` means something failed.

---

## 5. Set up MySQL (the database)

### 5.1 Make sure MySQL is running

Press `Win + R`, type `services.msc`, press Enter. Find **MySQL80** (or **MySQL84**). Its status should be *Running*. If not, right-click it and choose **Start**.

### 5.2 Check your password works (recommended)

1. Open **MySQL Workbench**.
2. Click the **Local instance** tile (or the `+` next to *MySQL Connections*, with host `127.0.0.1`, port `3306`, user `root`).
3. Enter the root password from step 2.3.

If it connects, MySQL is ready. You can also create the database yourself here by running this in a query tab (the lightning-bolt button runs it):

```sql
CREATE DATABASE IF NOT EXISTS smart_attendance;
```

This step is optional: step 7 creates the database automatically if it does not exist.

---

## 6. Create the `.env` settings file

The project reads all its settings from one file named `.env` in the project root. A template is provided.

### 6.1 Copy the template

```powershell
copy .env.example .env
```

### 6.2 Generate two secret keys

These keys sign the login tokens. Run each line and copy the output:

```powershell
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
```

### 6.3 Edit `.env`

Open `.env` in your editor (`code .env` if you use VS Code, or `notepad .env`) and change these lines:

```env
DATABASE_URL="mysql://root:YOUR_MYSQL_PASSWORD@localhost:3306/smart_attendance"
JWT_ACCESS_SECRET=paste-the-first-generated-value
JWT_REFRESH_SECRET=paste-the-second-generated-value
```

- Replace `YOUR_MYSQL_PASSWORD` with your MySQL root password. Keep the quotes.
- Paste only the long value after `=` for each secret (or paste the whole printed line in place of the existing one).

> **Password has symbols?** Inside `DATABASE_URL` some characters must be written as codes:
>
> | Character | Write it as |
> |---|---|
> | `@` | `%40` |
> | `#` | `%23` |
> | `%` | `%25` |
> | `/` | `%2F` |
> | `:` | `%3A` |
> | `?` | `%3F` |
>
> Example: password `Pes@2024#` becomes `mysql://root:Pes%402024%23@localhost:3306/smart_attendance`.

Everything else in `.env` can stay as it is for now. Section 14 explains every setting.

> **Never share or commit `.env`.** It holds your passwords. Git already ignores it.

---

## 7. Create the tables and demo data

```powershell
npm --prefix server run prisma:generate
npm --prefix server run prisma:push
npm --prefix server run seed
```

| Command | What it does | Success looks like |
|---|---|---|
| `prisma:generate` | Prepares the backend's database code | `Generated Prisma Client` |
| `prisma:push` | Creates the database (if needed) and all its tables | `Your database is now in sync with your Prisma schema` |
| `seed` | Fills the database with demo users, courses, attendance and marks | A list of users ending in `Done.` |

Running the seed again later is safe; it does not create duplicates.

If `prisma:push` fails, see [Database errors](#database-errors).

---

## 8. Set up the face service (Python)

When a student enrols their face, the backend sends one photo to this service to double-check it. You need it while `VITE_FACE_VERIFICATION=true` (the default).

> **Want to skip it?** Set `VITE_FACE_VERIFICATION=false` in `.env`. Face matching then happens only in the browser, and you can skip this whole section.

### 8.1 Create a virtual environment and install packages

A *virtual environment* is a private folder of Python packages just for this project.

```powershell
py -3.11 -m venv face-service\.venv
face-service\.venv\Scripts\python -m pip install --upgrade pip
face-service\.venv\Scripts\python -m pip install -r face-service\requirements.txt
```

This downloads TensorFlow and other large packages (about 1 GB). It can take 5 to 15 minutes.

### 8.2 First start downloads the face model

The first time the face service starts (step 10), it downloads its recognition model (about 100 MB) and loads it. Allow a minute or two, and keep the internet on for that first start. Later starts are quick.

---

## 9. Set up Ollama (AI advice, optional)

The student dashboard shows study advice. With Ollama running, a local AI model writes it; without Ollama, the app shows simpler rule-based advice. **Everything else works either way.**

### 9.1 Install and download a model

1. Install Ollama from https://ollama.com/download (version **0.5 or newer**). It starts automatically and shows a llama icon in the system tray (bottom-right, next to the clock).
2. Download the model the project uses (about 4.7 GB; needs about 8 GB of RAM):

   ```powershell
   ollama pull qwen2.5:7b-instruct
   ```

   **Laptop with 8 GB RAM or less?** Use the smaller model instead (about 2 GB):

   ```powershell
   ollama pull qwen2.5:3b-instruct
   ```

   and set `OLLAMA_MODEL=qwen2.5:3b-instruct` in `.env`.

3. Check it is installed and answering:

   ```powershell
   ollama list
   ollama run qwen2.5:7b-instruct "Say hello in five words"
   ```

   (Use the model name you pulled.) The first answer can take a while because the model is loading into memory.

### 9.2 Ollama settings in `.env`

```env
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
OLLAMA_TIMEOUT_MS=8000
```

- **No graphics card, or advice always says "rule-based"?** The backend waits `OLLAMA_TIMEOUT_MS` milliseconds for the AI, then falls back. On a CPU-only laptop set it higher, for example `OLLAMA_TIMEOUT_MS=30000`, and restart the backend.
- **Don't want AI at all?** Set `OLLAMA_ENABLED=false`.

### 9.3 How to tell it is working

On a student dashboard, the advice card ends with one of these lines:

- *"AI-generated guidance — verify with your faculty."*: Ollama is working.
- *"Rule-based guidance shown because the local AI model is unavailable."*: Ollama is not running, the model is not downloaded, or it took longer than `OLLAMA_TIMEOUT_MS`.

---

## 10. Start everything

Start MySQL first (it normally starts with Windows, see 5.1). Then open **three PowerShell windows**, `cd` into the project root in each, and run one command per window. **Leave these windows open** while you use the app; closing a window stops that part.

**Window 1: Face service** (skip if `VITE_FACE_VERIFICATION=false`)

```powershell
face-service\.venv\Scripts\python -m uvicorn app:app --app-dir face-service --host 127.0.0.1 --port 8000
```

Ready when it prints `Application startup complete`.

**Window 2: Backend**

```powershell
npm --prefix server run dev
```

Ready when it prints `[server] local demo backend: http://localhost:4000`. It first updates the database tables automatically. If it prints a **DATABASE PROBLEM** banner, read it: it says exactly what is wrong.

**Window 3: Frontend**

```powershell
npm run dev
```

Ready when it prints `Local: http://localhost:3000/`.

**Ollama** (optional) runs in the background on its own after installing. If it is not running, start the Ollama app, or run `ollama serve` in a fourth window.

### Check each part

Open these in your browser:

| URL | Expected |
|---|---|
| http://localhost:4000/health | `"status":"ok"` and `"db":{"ok":true,...}` |
| http://localhost:8000/health | a JSON reply (face service) |
| http://localhost:11434 | `Ollama is running` |
| http://localhost:3000 | the login page |

---

## 11. Log in and try it

Open **http://localhost:3000**. The seed created these accounts. **Every password is `Pes@12345`.**

| Role | Email |
|---|---|
| Admin | `admin@pesu.pes.edu` |
| Faculty | `faculty@pesu.pes.edu` |
| Student | `student@pesu.pes.edu` |
| Parent | Go to http://localhost:3000/parent-login and sign in with a **student's** email and password |

The seed also creates a CSE Sem-5 cohort of 24 students (`PES1UG23CS001`–`024`, e.g. `nandini.murthy@pesu.pes.edu`), two more faculty, and four courses with attendance, marks, leave, appeals, notifications and audit history.

### Try a full attendance round

1. **Admin:** Dashboard → *Classroom geofences* → open **Room B-204** → stand where you are and click **Use my current location**. (The seeded room has fixed coordinates, so attendance fails from anywhere else. See [Location errors](#location-and-camera).)
2. **Student:** open **Enrol Face**, allow the camera, and follow the steps.
3. **Faculty:** on the dashboard, use **Open session** for one of your courses in that room.
4. **Student:** open **Mark Attendance**, allow location and camera. The faculty's live roster updates.

The browser only allows camera and location on `localhost` (or HTTPS), so always use `http://localhost:3000`, not your PC's IP address.

---

## 12. Everyday use

**Starting the app again another day:** make sure MySQL is running, then repeat [step 10](#10-start-everything). You do not need to repeat any setup.

**Stopping:** press `Ctrl + C` in each window, or just close the windows.

**After downloading new code** (`git pull`):

```powershell
git pull
npm install
npm --prefix server install
```

then start the backend with `npm --prefix server run dev` as usual. Read the output of `git pull`: if it says *error* or *Aborting*, nothing was updated (see [Troubleshooting](#13-troubleshooting)). `npm run doctor` tells you whether your code is up to date. It updates the database tables automatically before starting. If `face-service/requirements.txt` changed, also re-run the `pip install` line from 8.1.

**Start over with fresh demo data:** in MySQL Workbench run `DROP DATABASE smart_attendance;`, then repeat [step 7](#7-create-the-tables-and-demo-data). This deletes all data.

**Look at the data:** `npm --prefix server run prisma:studio` opens a table browser at http://localhost:5555. MySQL Workbench works too.

---

## 13. Troubleshooting

**Start here:** with the app running, open a new PowerShell window in the project folder and run

```powershell
npm run doctor
```

It checks your code version, installed packages, `.env`, MySQL, and every running part, and prints `[FAIL]` lines with the exact command that fixes each problem. Fix them from the top down and run it again.

### Installation

| Problem | Fix |
|---|---|
| `'npm' is not recognized` / `'node' is not recognized` | Node.js is not installed or PowerShell was open during install. Reinstall Node.js, then **close and reopen** PowerShell. |
| `npm.ps1 cannot be loaded because running scripts is disabled` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, answer `Y`, try again. |
| `py` or `python` opens the Microsoft Store / is not found | Install Python 3.11 from python.org with *Add python.exe to PATH* ticked. Turn off the Store alias in *Settings → Apps → Advanced app settings → App execution aliases*. |
| `pip install` fails on `tensorflow` | You are probably not on Python 3.11. Delete the `face-service\.venv` folder and redo 8.1 with `py -3.11`. |
| `npm run download-models` fails | Check your internet connection and run it again. The files go into `public/models/`. |

### Database errors

| Message | Meaning and fix |
|---|---|
| `Environment variable not found: DATABASE_URL` | There is no `.env` in the project root, or `DATABASE_URL` is missing from it. Redo step 6. |
| `P1000: Authentication failed` | Wrong MySQL password in `DATABASE_URL`, or it has symbols that are not encoded (see 6.3). |
| `P1001: Can't reach database server at localhost:3306` | MySQL is not running. Start it (5.1). |
| `DATABASE PROBLEM ... schema is out of date` (backend window) | The tables are older than the code. Stop the backend (`Ctrl + C`) and start it again with `npm --prefix server run dev`, or run `npm --prefix server run prisma:push`. |

### "This page didn't load"

The card shows the reason under the message:

- **Can't reach the server:** the backend (window 2) is not running or crashed. Start it again. The page reloads by itself once the backend is back.
- **Database schema is out of date:** see the table above.
- **Session expired:** click *Sign in again*.
- **Anything else:** the backend window shows the full error. http://localhost:4000/health also reports database problems.

After the code is updated or the frontend restarts, an already open tab reloads itself once to pick up the new version. That is expected.

### Login

| Problem | Fix |
|---|---|
| *Invalid email or password* | Use the seeded accounts (section 11). All passwords are `Pes@12345`. Did step 7 finish with `Done.`? |
| Login does nothing or shows a network error | Open `http://localhost:3000` exactly (not `127.0.0.1:3000` or your IP address): the backend only accepts the address in `WEB_ORIGIN`. Also check the backend window is running. |
| *"Google sign-in isn't set up on this server"* | Normal: Google sign-in is optional and off until you add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (section 14). Use email and password instead. |
| Changed `.env` but nothing changed | Restart the backend (and the frontend for `VITE_...` settings). `.env` is only read at start-up. |

### Location and camera

| Problem | Fix |
|---|---|
| *"You appear to be … m from the classroom"* | The room's saved location is elsewhere. As admin, open Dashboard → Classroom geofences, stand in the real room and click **Use my current location**. |
| Camera or location never asks for permission | Use `http://localhost:3000`. Browsers block camera and GPS on plain `http://` addresses other than `localhost`. Check the site permissions (padlock icon in the address bar). |
| Face enrolment or marking fails | Run `npm run download-models` (step 4). With `VITE_FACE_VERIFICATION=true` the face service (window 1) must also be running. Use good lighting and look straight at the camera. |
| Face service is slow to start | The first start downloads the model (8.2). Wait for `Application startup complete`. |

### Ollama

| Problem | Fix |
|---|---|
| Advice always says *rule-based* | Check http://localhost:11434 says `Ollama is running`; check `ollama list` shows the model named in `OLLAMA_MODEL`; raise `OLLAMA_TIMEOUT_MS` to `30000` on a laptop without a graphics card; restart the backend. |
| `ollama` is not recognized | Ollama is not installed, or PowerShell was open during install. Reinstall, then reopen PowerShell. |
| AI replies but advice is still rule-based | Update Ollama to 0.5 or newer (the project uses structured JSON replies). |
| PC becomes very slow | The 7B model needs about 8 GB of free RAM. Switch to `qwen2.5:3b-instruct` (9.1) or set `OLLAMA_ENABLED=false`. |

### Ports already in use

*"address already in use"* / *"Port 3000 is in use"* means another program (often an old window of this project) is using the port.

1. Close any old project windows and try again.
2. Still stuck? Find the program: `netstat -ano | findstr :4000` (use the port from the message). The last number is the process ID; stop it with `taskkill /PID <number> /F`.
3. Or move the backend to another port: change `PORT` in `.env` and set `VITE_API_BASE_URL` to the same port, then restart both. For the face service port, change the `--port` in window 1 and `FACE_SERVICE_URL` together.

---

## 14. Reference

### All `.env` settings

| Setting | Used by | Default / example | Meaning |
|---|---|---|---|
| `DATABASE_URL` | backend | `mysql://root:PASSWORD@localhost:3306/smart_attendance` | How to reach MySQL: user, password, host, port, database name |
| `JWT_ACCESS_SECRET` | backend | *(generate)* | Secret for short-lived login tokens |
| `JWT_REFRESH_SECRET` | backend | *(generate)* | Secret for "stay signed in" tokens |
| `JWT_ACCESS_TTL` | backend | `15m` | How long a login token lasts before it is silently renewed |
| `JWT_REFRESH_TTL` | backend | `7d` | How long you stay signed in |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | backend | empty | Optional Google sign-in for students. Create them at https://console.cloud.google.com/apis/credentials |
| `GOOGLE_CALLBACK_URL` | backend | `http://localhost:4000/auth/google/callback` | Must also be added as an authorised redirect URI in Google Cloud |
| `COLLEGE_DOMAIN` | backend | `pesu.pes.edu` | Only emails from this domain can use Google sign-in |
| `WEB_ORIGIN` | backend | `http://localhost:3000` | The frontend address allowed to call the backend |
| `FACE_SERVICE_URL` | backend | `http://localhost:8000` | Where the face service runs |
| `FACE_SERVICE_TOKEN` | backend + face service | empty | Optional shared password between backend and face service |
| `FACE_SERVICE_TIMEOUT_MS` | backend | `15000` | How long to wait for the face service |
| `OLLAMA_ENABLED` | backend | `true` | `false` turns AI advice off |
| `OLLAMA_BASE_URL` | backend | `http://127.0.0.1:11434` | Where Ollama runs |
| `OLLAMA_MODEL` | backend | `qwen2.5:7b-instruct` | Which model to use (must be pulled with `ollama pull`) |
| `OLLAMA_TIMEOUT_MS` | backend | `8000` | How long to wait for the AI before showing rule-based advice |
| `PORT` | backend | `4000` | Backend port |
| `VITE_API_BASE_URL` | frontend | `http://localhost:4000` | Where the frontend finds the backend |
| `VITE_COLLEGE_DOMAIN` | frontend | `pesu.pes.edu` | Domain check on the login page |
| `VITE_FACE_VERIFICATION` | frontend | `true` | `true`: enrolment is also checked by the face service. `false`: browser-only, no Python needed |

The face service has its own optional settings (`FACE_MODEL`, `FACE_DETECTOR`, `FACE_WARM_ON_STARTUP`), described in `face-service/README.md`.

### Useful commands

Run from the project root.

```powershell
# Start
npm --prefix server run dev          # backend (also updates DB tables)
npm run dev                          # frontend

# Database
npm --prefix server run prisma:push     # create/update tables to match the code
npm --prefix server run seed            # add demo data (safe to repeat)
npm --prefix server run prisma:studio   # browse data at http://localhost:5555

# Checks
npm run typecheck                    # frontend type check
npm --prefix server run typecheck    # backend type check
npm run check:encoding               # catches broken characters in text files

# Production build
npm run build                        # frontend, into dist/
npm --prefix server run build        # backend
```

### Tests

The test files are kept out of the demo build, in a git stash on this branch. A stash lives only in the local clone and is not pushed:

```powershell
git stash list    # "test files (removed from working tree for the demo build)"
git checkout 759a952 -- "lib/*.test.ts" server/src/test face-service/tests    # older tests only
git stash pop     # new and updated tests on top
```

### Project structure

```
Smart-Attendence-System/
├── app/            # Pages (one folder per screen: student/, faculty/, admin/, parent/)
├── components/     # Reusable React components
├── lib/            # Frontend helpers (API client, auth, calculations)
├── hooks/          # React hooks
├── stores/         # Zustand state
├── src/            # App entry point, router, providers
├── public/         # Static files, CSV templates, face models (downloaded)
├── server/         # Express backend
│   ├── prisma/     #   Database schema (schema.prisma)
│   └── src/        #   Routes, services, seed data
├── face-service/   # Python FastAPI face recognition service
├── scripts/        # Helper scripts (model download, encoding check)
└── .env.example    # Template for your .env
```

### For a viva or demo

1. **Before the demo:**
   - Start MySQL and the three windows from step 10 (Ollama is optional).
   - Open http://localhost:4000/health and check it says `"status":"ok"`.
   - Move the Room B-204 geofence to the room you are presenting in (section 11).
   - Enrol one student's face on the demo laptop beforehand.
2. **Accounts:** see section 11. Parents sign in at `/parent-login` with their child's student email and password.
3. **Everything runs locally.** Notifications are demo-only; no SMS or email is sent.
4. **Features to show:**
   - Multi-role sign-in (admin, faculty, student, parent), with admin password reset for forgotten passwords
   - Face enrolment and verification
   - GPS geofencing for attendance, with a per-session radius (default 100 m)
   - Live attendance roster as students mark in
   - Attendance health: students grouped as 75% and above, 65–74%, and below 65%, plus low-attendance alerts
   - Drill-downs: click a number, chart or row to see the records behind it
   - Attendance record search with filters; CSV/PDF export of the filtered rows
   - Marks and results (CGPA), with performance analytics and AI study advice
   - Leave requests (date range) and per-session appeals, with faculty review and comments
   - Audit log of who changed what
   - Parent dashboard (read-only)
   - Bulk CSV import with a preview before anything is saved: students, faculty, courses, enrollments, weekly timetable, attendance corrections and marks. Templates can be downloaded on each import screen, and copies are in `public/templates/`.
