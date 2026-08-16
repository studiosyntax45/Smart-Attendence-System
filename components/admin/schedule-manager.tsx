
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Coffee,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  DAY_NAMES,
  deleteScheduleEntry,
  formatTimeRange,
  upsertScheduleEntry,
  type ScheduleActionState,
  type ScheduleEntry,
} from "@/lib/class-schedule";
import { firstRow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface FacultyOption {
  id: string;
  full_name: string;
}

export interface GeofenceOption {
  id: string;
  room_name: string;
}

export interface CourseOption {
  code: string;
  name: string;
}

export interface ClassOption {
  id: string;
  name: string;
  branch: string;
  semester: string;
  section: string;
}

const INITIAL: ScheduleActionState = {};

const selectClass =
  "flex h-11 w-full cursor-pointer rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";


export function ScheduleManager({
  entries,
  faculty,
  geofences,
  courses = [],
  classList = [],
}: {
  entries: ScheduleEntry[];
  faculty: FacultyOption[];
  geofences: GeofenceOption[];
  courses?: CourseOption[];
  classList?: ClassOption[];
}) {
  const qc = useQueryClient();
  const [state, setState] = useState<ScheduleActionState>(INITIAL);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [filterClassId, setFilterClassId] = useState<string>("ALL");
  const [selectedCourseOption, setSelectedCourseOption] = useState<string>("");
  const [customCourse, setCustomCourse] = useState<string>("");
  const [facultyId, setFacultyId] = useState("");
  const [geofenceId, setGeofenceId] = useState("");
  const [classId, setClassId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  function resetForm() {
    setEditing(null);
    setSelectedCourseOption("");
    setCustomCourse("");
    setFacultyId("");
    setGeofenceId("");
    setClassId("");
    setDayOfWeek("1");
    setStartTime("09:00");
    setEndTime("10:00");
    setState(INITIAL);
  }

  function startEdit(e: ScheduleEntry) {
    setEditing(e);
    setFacultyId(e.faculty_id);
    setGeofenceId(e.geofence_id);
    setClassId(e.class_id || "");
    setDayOfWeek(String(e.day_of_week));
    setStartTime(e.start_time.slice(0, 5));
    setEndTime(e.end_time.slice(0, 5));
    setState(INITIAL);
    const matchingCourse = courses.find(
      (c) => c.code === e.course || c.name === e.course
    );

    if (matchingCourse) {
      setSelectedCourseOption(matchingCourse.code);
      setCustomCourse("");
    } else if (
      e.course.toLowerCase().includes("break") ||
      e.course.toLowerCase().includes("recess") ||
      e.course.toLowerCase().includes("lunch") ||
      e.course.toLowerCase().includes("tea")
    ) {
      setSelectedCourseOption("__BREAK__");
      setCustomCourse(e.course);
    } else {
      setSelectedCourseOption("__OTHER__");
      setCustomCourse(e.course);
    }
  }

  function handleCourseOptionChange(opt: string) {
    setSelectedCourseOption(opt);
    if (opt === "__BREAK__" && !customCourse) {
      setCustomCourse("Lunch Break");
    } else if (opt === "__OTHER__" && !customCourse) {
      setCustomCourse("");
    }
  }

  function setupQuickBreak() {
    resetForm();
    setSelectedCourseOption("__BREAK__");
    setCustomCourse("Lunch Break");
    setStartTime("13:00");
    setEndTime("14:00");
    if (faculty.length > 0) setFacultyId(faculty[0].id);
    if (geofences.length > 0) setGeofenceId(geofences[0].id);
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setPending(true);

    const finalCourse =
      selectedCourseOption === "__OTHER__" || selectedCourseOption === "__BREAK__"
        ? customCourse.trim() ||
          (selectedCourseOption === "__BREAK__" ? "Break" : "Other Course")
        : selectedCourseOption;

    const res = await upsertScheduleEntry({
      id: editing?.id,
      course: finalCourse,
      facultyId,
      geofenceId,
      classId: classId || null,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
    });
    setState(res);
    setPending(false);
    if (!res.error) {
      qc.invalidateQueries({ queryKey: ["admin-schedule"] });
      qc.invalidateQueries({ queryKey: ["faculty-dashboard"] });
      resetForm();
    }
  }

  async function remove(id: string) {
    setDelError(null);
    setDeletingId(id);
    const res = await deleteScheduleEntry(id);
    if (res.error) setDelError(res.error);
    else {
      qc.invalidateQueries({ queryKey: ["admin-schedule"] });
      qc.invalidateQueries({ queryKey: ["faculty-dashboard"] });
      if (editing?.id === id) resetForm();
    }
    setDeletingId(null);
  }

  const isBreakSlot = (courseName: string) => {
    if (!courseName) return false;
    const c = courseName.toLowerCase();
    return (
      c.includes("break") ||
      c.includes("recess") ||
      c.includes("lunch") ||
      c.includes("tea") ||
      c.includes("interval")
    );
  };

  const filteredEntries = entries.filter((e) => {
    if (filterClassId === "ALL") return true;
    if (filterClassId === "UNASSIGNED") return !e.class_id;
    return e.class_id === filterClassId;
  });

  return (
    <div className="space-y-5">
      
      {classList.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Filter by Class Section:</span>
          </div>
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="h-9 cursor-pointer rounded-md border border-input bg-card px-3 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ALL">All Classes / All Sections ({entries.length})</option>
            {classList.map((c) => {
              const count = entries.filter((e) => e.class_id === c.id).length;
              return (
                <option key={c.id} value={c.id}>
                  {c.name} ({count} slots)
                </option>
              );
            })}
            <option value="UNASSIGNED">General / All Classes Slots</option>
          </select>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          No timetable entries found for this class section filter. Add a slot below!
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-3 px-3 font-medium">Course / Activity</th>
                <th scope="col" className="py-3 pr-3 font-medium">Class Section</th>
                <th scope="col" className="py-3 pr-3 font-medium">Faculty</th>
                <th scope="col" className="py-3 pr-3 font-medium">Day</th>
                <th scope="col" className="py-3 pr-3 font-medium">Time</th>
                <th scope="col" className="py-3 pr-3 font-medium">Room</th>
                <th scope="col" className="py-3 pr-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e) => {
                const fac = firstRow(e.profiles);
                const room = firstRow(e.geofences);
                const cls = firstRow(e.classes);
                const isBreak = isBreakSlot(e.course);

                return (
                  <tr
                    key={e.id}
                    className="border-b transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <td className="py-3 px-3 font-medium">
                      {isBreak ? (
                        <Badge
                          variant="outline"
                          className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold px-2.5 py-1 text-xs"
                        >
                          <Coffee className="size-3.5 text-amber-500" />
                          {e.course}
                        </Badge>
                      ) : (
                        <span>{e.course}</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {cls ? (
                        <Badge variant="secondary" className="font-semibold text-xs px-2.5 py-0.5">
                          {cls.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">General / All</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {fac?.full_name ?? "—"}
                    </td>
                    <td className="py-3 pr-3 font-medium">
                      {DAY_NAMES[e.day_of_week] ?? e.day_of_week}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs">
                      {formatTimeRange(e.start_time, e.end_time)}
                    </td>
                    <td className="py-3 pr-3">
                      {room?.room_name ?? "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${e.course}`}
                          onClick={() => startEdit(e)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${e.course}`}
                          disabled={deletingId === e.id}
                          onClick={() => remove(e.id)}
                        >
                          {deletingId === e.id ? (
                            <LoaderCircle
                              className="size-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2
                              className="size-4 text-destructive"
                              aria-hidden="true"
                            />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {delError && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {delError}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-dashed p-4 sm:p-5 bg-card/50"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {editing ? `Edit “${editing.course}”` : "Add a class or break slot"}
          </p>
          {!editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={setupQuickBreak}
              className="h-8 gap-1.5 text-xs border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              <Coffee className="size-3.5 text-amber-500" />
              Quick Add Break Slot
            </Button>
          )}
        </div>

        
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="classId">Class Section</Label>
            <select
              id="classId"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className={selectClass}
            >
              <option value="">-- All Classes / General Slot --</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.branch} - Sem {c.semester} Sec {c.section})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="courseSelect">Course / Slot Type</Label>
            <select
              id="courseSelect"
              required
              value={selectedCourseOption}
              onChange={(e) => handleCourseOptionChange(e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>
                -- Choose Course or Break --
              </option>
              <optgroup label="Presets & Custom">
                <option value="__BREAK__">☕ Break / Recess / Lunch</option>
                <option value="__OTHER__">✏️ Other / Custom Course...</option>
              </optgroup>
              {courses.length > 0 && (
                <optgroup label="Available Institution Courses">
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        
        {(selectedCourseOption === "__OTHER__" ||
          selectedCourseOption === "__BREAK__") && (
          <div className="space-y-1.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <Label htmlFor="customCourse" className="text-xs text-muted-foreground font-medium">
              {selectedCourseOption === "__BREAK__"
                ? "Break Title"
                : "Enter Custom Course Name or Code"}
            </Label>
            <Input
              id="customCourse"
              value={customCourse}
              onChange={(e) => setCustomCourse(e.target.value)}
              placeholder={
                selectedCourseOption === "__BREAK__"
                  ? "e.g. Lunch Break, Tea Break, Short Recess"
                  : "e.g. Library Period, Guest Lecture, Seminar"
              }
              required
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="facultyId">Faculty</Label>
            <select
              id="facultyId"
              required
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>
                Choose faculty…
              </option>
              {faculty.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="geofenceId">Room</Label>
            <select
              id="geofenceId"
              required
              value={geofenceId}
              onChange={(e) => setGeofenceId(e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>
                Choose room…
              </option>
              {geofences.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.room_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Day</Label>
            <select
              id="dayOfWeek"
              required
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              className={selectClass}
            >
              {DAY_NAMES.map((name, i) => (
                <option key={name} value={String(i)}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time</Label>
            <Input
              id="startTime"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">End Time</Label>
            <Input
              id="endTime"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {state.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
        {state.message && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : selectedCourseOption === "__BREAK__" ? (
              <Coffee className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {pending
              ? "Saving…"
              : editing
                ? "Save changes"
                : selectedCourseOption === "__BREAK__"
                  ? "Add Break to Timetable"
                  : "Add to Timetable"}
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

