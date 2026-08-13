# Known Limitations

## Class timetable (`class_schedule`)

- **No double-booking constraint.** Two (or more) schedule rows may share the
  same `geofence_id` on the same `day_of_week` with overlapping
  `start_time`/`end_time`. Room conflicts are possible; coordinate manually
  or add a future exclusion constraint / trigger.
- **No FK from schedule → session.** Opening from a timetable card is a
  convenience pre-fill of `openSession()`; historical sessions are not tied
  back to a schedule row.
- **One live session at a time** (existing product rule) still applies —
  opening a second session while one is live is rejected by `openSession()`.

## Leave / appeals (`leave_requests`)

- **One appeal per session** (`unique (student_id, session_id)`). A rejected
  appeal blocks re-filing unless a staff member deletes the row.
- **Approval does not rewrite capture fields.** `status`, `entry_time`,
  coordinates, and face confidence stay as recorded; only `excused` flips.
  Eligibility math treats excused as “not conducted,” never as attended.
- **Faculty scope is enforced in the action layer** (join on
  `sessions.faculty_id`). RLS lets staff read all leave rows; the
  `reviewLeaveRequest` action refuses faculty reviews of other faculty’s
  sessions.

## General

- See README “Security model” for the face-descriptor client-side caveat and
  the optional server-side DeepFace path.
