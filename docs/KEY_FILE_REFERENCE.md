# Chapter 11: Key File Reference

Quick map of the files that own each concern in the PES Smart Attendance
System. Prefer extending these over inventing parallel modules.

## Core libraries (`lib/`)

| File | Responsibility |
|------|----------------|
| `lib/attendance.ts` | 75% eligibility policy, `STATUS_WEIGHTS`, summary rollups, **excused-aware** `countEligibility`, **Target Attendance Calculator** (`classesNeededForEligibility`) |
| `lib/class-schedule.ts` | Weekly timetable validators + admin/faculty schedule actions (`listScheduleForFaculty`, `upsertScheduleEntry`, `deleteScheduleEntry`, `listAllSchedule`) |
| `lib/leave-requests.ts` | Attendance-appeal filing + staff review (`fileLeaveRequest`, `listPendingLeaveRequests`, `reviewLeaveRequest`); approval sets `attendance.excused` only |
| `lib/gps-settings.ts` | Institution GPS policy row (grace m, late-after min) |
| `lib/geofence.ts` | Haversine distance calculations |
| `lib/face.ts` / `lib/face-client.ts` | Descriptor match + EAR blink liveness |
| `lib/auth.tsx` | JWT session, profile, parent-view flag |
| `lib/utils.ts` | `Role`, `AttendanceStatus`, `firstRow`, `startOfToday` |
| `lib/api-client.ts` | Express REST API client |

## Route tree & guards

| File | Responsibility |
|------|----------------|
| `src/router.tsx` | `createBrowserRouter` tree — student / faculty / admin / parent |
| `src/guards.tsx` | `RequireRole`, `RequireParentView` |
| `components/app-shell.tsx` | Role-scoped nav (includes **Timetable** for admin) |

## Role pages

| Path | File | Notes |
|------|------|-------|
| `/faculty/dashboard` | `app/faculty/dashboard/page.tsx` | Today's Classes one-tap open, pending appeals queue, live roster, ad-hoc disclosure |
| `/admin/classes` | `app/admin/classes/page.tsx` | Class sections & student roster management (admin-only) |
| `/admin/schedule` | `app/admin/schedule/page.tsx` | Weekly timetable CRUD (admin-only) |
| `/admin/settings` | `app/admin/settings/page.tsx` | GPS policy |
| `/student/attendance` | `app/student/attendance/page.tsx` | Per-course % + Target Calculator + session history appeals |
| `/student/dashboard` | `app/student/dashboard/page.tsx` | 30-day ring; excused shown grey |
| `/parent/dashboard` | `app/parent/dashboard/page.tsx` | Read-only; excused grey badge |

## UI building blocks

| File | Responsibility |
|------|----------------|
| `components/admin/class-manager.tsx` | Class section CRUD + student roster assignment + course linking |
| `components/faculty/todays-classes.tsx` | Schedule cards → `openSession()` pre-filled |
| `components/faculty/pending-appeals.tsx` | Approve / Reject queue |
| `components/admin/schedule-manager.tsx` | Timetable table + form |
| `components/attendance/appeal-button.tsx` | Student appeal modal + status badges |
| `components/status-pill.tsx` | Present/Late/Absent/Partial **or** grey Excused |

## Schema & backend

| File | Adds |
|------|------|
| `server/prisma/schema.prisma` | MySQL schema: users, profiles, geofences, sessions, attendance, marks, classes, schedules, leave requests |

## Tests

| File | Covers |
|------|--------|
| `lib/classes.test.ts` | Input validation, class filtering, student assignment logic |
| `lib/attendance.test.ts` | Eligibility, rollups, **excused exclusion**, Target Calculator |
| `lib/class-schedule.test.ts` | Time validation, day filter, day_of_week bounds |
| `lib/leave-requests.test.ts` | Reason length, appealable statuses, approval/rejection contract |

```bash
npm run typecheck
npm test
```
