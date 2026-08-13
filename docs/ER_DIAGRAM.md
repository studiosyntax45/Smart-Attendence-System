# Entity-Relationship Diagram

Logical model after migrations **0010** (timetable) and **0011** (leave/appeals).
Rendered as Mermaid so it stays in-repo and diffable.

```mermaid
erDiagram
  profiles ||--o{ sessions : "opens (faculty_id)"
  profiles ||--o{ attendance : "marks (student_id)"
  profiles ||--o{ class_schedule : "teaches (faculty_id)"
  profiles ||--o{ leave_requests : "files (student_id)"
  profiles ||--o{ leave_requests : "reviews (reviewed_by)"
  profiles ||--o{ marks : "scored"
  profiles ||--o{ enrollments : "enrolled"

  geofences ||--o{ sessions : "locates"
  geofences ||--o{ class_schedule : "room"

  sessions ||--o{ attendance : "records"
  sessions ||--o{ leave_requests : "appealed"

  courses ||--o{ enrollments : "has"
  courses ||--o{ marks : "assessed"

  profiles {
    uuid id PK
    text full_name
    text roll_no
    user_role role
    jsonb face_embedding
  }

  geofences {
    uuid id PK
    text room_name
    numeric lat
    numeric lng
    int radius_m
  }

  sessions {
    uuid id PK
    text course
    uuid faculty_id FK
    uuid geofence_id FK
    timestamptz opened_at
    timestamptz closed_at
  }

  attendance {
    uuid id PK
    uuid session_id FK
    uuid student_id FK
    timestamptz entry_time
    timestamptz exit_time
    att_status status
    boolean excused "NEW — default false; audit-safe override"
    numeric face_confidence
    numeric entry_lat
    numeric entry_lng
  }

  class_schedule {
    uuid id PK
    text course
    uuid faculty_id FK
    uuid geofence_id FK
    smallint day_of_week "0=Sun … 6=Sat"
    time start_time
    time end_time
  }

  leave_requests {
    uuid id PK
    uuid student_id FK
    uuid session_id FK
    text reason "5–500 chars"
    text status "pending|approved|rejected"
    uuid reviewed_by FK
    timestamptz reviewed_at
  }

  courses ||--o{ class_courses : "linked"
  classes ||--o{ class_courses : "has"
  classes ||--o{ class_students : "enrolls"
  profiles ||--o{ class_students : "member"

  courses {
    text code PK
    text name
    numeric credits
    text semester
  }

  classes {
    uuid id PK
    text name
    text branch
    text semester
    text section
    text academic_year
  }

  class_students {
    uuid id PK
    uuid class_id FK
    uuid student_id FK
    timestamptz enrolled_at
  }

  class_courses {
    uuid id PK
    uuid class_id FK
    text course_code FK
    timestamptz created_at
  }

  enrollments {
    uuid student_id FK
    text course_code FK
    boolean active
    timestamptz enrolled_at
  }

  marks {
    uuid id PK
    uuid student_id FK
    text course
    text assessment
    numeric score
    numeric max_score
  }
```

## Relationships of note

1. **`class_schedule`** is independent of `sessions`. Opening a class from a
   timetable card calls the existing `openSession()` with pre-filled
   `course` + `geofence_id` — it does **not** FK-link schedule → session.
2. **`leave_requests`** is unique on `(student_id, session_id)` so a student
   files at most one appeal per session.
3. **`attendance.excused`** never rewrites `status`, `entry_time`, or GPS
   fields. The `attendance_summary` view excludes excused rows from both
   numerator and denominator.

## Known limitations

| Limitation | Why deferred |
|------------|--------------|
| No room double-booking constraint on `class_schedule` (same geofence, same day, overlapping times) | Scope: timetable MVP first; add an exclusion constraint or trigger later if needed |
| Faculty RLS allows faculty to write their own schedule rows, but app actions are **admin-only** for upsert/delete | Belt-and-suspenders; admin owns the institution timetable in the UI |
| Rejected appeals cannot be re-filed (unique constraint) | Prevents spam; staff can be asked to delete the row if a re-file is legitimate |
