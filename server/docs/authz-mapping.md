# Authorization mapping

This file is the **single source of truth** for Express authorization guards. Every controller that writes to a table should reference the row that names it, so a reviewer can verify the mapping without grep.

| Table | Policy Description | Enforcement |
|---|---|---|
| `profiles` | `read own or staff` — id = uid OR role ∈ {faculty, admin} | `readProfile`: own row always; staff sees all. |
| `profiles` | `update own` — id = uid AND role unchanged | `updateProfile`: own row; role field blocked unless admin. |
| `profiles` | `admin full access` | admin override in every profile controller. |
| `geofences` | `read for authenticated` | any signed-in user. |
| `geofences` | `admin writes` | `requireRole('admin')` on POST/PATCH/DELETE. |
| `sessions` | `read for authenticated` | any signed-in user. |
| `sessions` | `staff manage` — role ∈ {faculty, admin} | `requireRole('faculty' \| 'admin')`; `faculty_id` always forced to `req.user.id`. |
| `attendance` | `read own or staff` | `readAttendance`: own rows always; staff sees all. |
| `attendance` | `student inserts own` — student_id = uid | `markEntry`: student role, student_id forced to `req.user.id`. |
| `attendance` | `student updates own (exit)` | `markExit`: student_id forced to `req.user.id`; never trust client student_id. |
| `attendance` | `staff manage` | staff override in update/approve paths. |
| `marks` | `read own or staff` | `readMarks`: own rows always; staff sees all. |
| `marks` | `staff write / update` | `requireRole('faculty' \| 'admin')`; `updated_by` always forced to `req.user.id`. |
| `courses` | `read for authenticated` | any signed-in user. |
| `courses` | `staff manage` | `requireRole('faculty' \| 'admin')`. |
| `enrollments` | `read own or staff` | `readEnrollments`: own rows always; staff sees all. |
| `enrollments` | `staff manage` | `requireRole('faculty' \| 'admin')`. |
| `gps_settings` | `read for authenticated` | any signed-in user. |
| `gps_settings` | `admin writes` | `requireRole('admin')`. |
| `student_details` | `read own or staff` | `readStudentDetails`: own row always; staff sees all. |
| `student_details` | `upsert own / update own` — student_id = uid | `writeStudentDetails`: own row; student_id forced to `req.user.id`. |
| `student_details` | `admin manage` | admin override. |
| `classes` | `read authenticated` | any signed-in user. |
| `classes` | `staff manage` | `requireRole('faculty' \| 'admin')`. |
| `class_students` | `read authenticated` | any signed-in user. |
| `class_students` | `staff manage` | `requireRole('faculty' \| 'admin')`. |
| `class_courses` | `read authenticated` | any signed-in user. |
| `class_courses` | `staff manage` | `requireRole('faculty' \| 'admin')`. |
| `class_schedule` | `select_authenticated` | any signed-in user. |
| `class_schedule` | `admin_all` OR `faculty_own` (faculty_id = uid) | admin: full; faculty: only own rows. |
| `leave_requests` | `student_own` select / insert | `fileLeaveRequest`: student role, student_id forced to `req.user.id`. |
| `leave_requests` | `staff_all` | staff override on review. |
| `users` (auth) | Auth table | bcrypt hash + JWT — `services/auth.ts`. Google OAuth domain check in `routes/auth.ts`. |

**Constraint:** a row in this table with `New enforcement = n/a` is a blocked security gap. None currently exist.
