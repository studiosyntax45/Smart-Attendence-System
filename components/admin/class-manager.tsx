
import { useState } from "react";
import {
  Users,
  Plus,
  Trash2,
  BookOpen,
  Search,
  CheckCircle2,
  UserPlus,
  X,
  Building2,
  Calendar,
} from "lucide-react";
import {
  createClass,
  deleteClass,
  assignStudentsToClass,
  removeStudentFromClass,
  assignCourseToClass,
  removeCourseFromClass,
  listStudentsInClass,
  filterClasses,
  type ClassItem,
  type ClassStudentItem,
} from "@/lib/classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CourseOption {
  code: string;
  name: string;
  semester: string;
}

interface StudentOption {
  id: string;
  full_name: string;
  roll_no: string | null;
}

interface ClassManagerProps {
  initialClasses: ClassItem[];
  availableCourses: CourseOption[];
  availableStudents: StudentOption[];
  onRefresh: () => void;
}

export function ClassManager({
  initialClasses,
  availableCourses,
  availableStudents,
  onRefresh,
}: ClassManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [semFilter, setSemFilter] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("CSE");
  const [semester, setSemester] = useState("Sem-4");
  const [section, setSection] = useState("A");
  const [academicYear, setAcademicYear] = useState("2024-2025");
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeClass, setActiveClass] = useState<ClassItem | null>(null);
  const [modalMode, setModalMode] = useState<"students" | "courses" | null>(null);
  const [classStudents, setClassStudents] = useState<ClassStudentItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedCourseCode, setSelectedCourseCode] = useState("");

  const filtered = filterClasses(initialClasses, searchTerm, branchFilter, semFilter);
  async function handleOpenModal(c: ClassItem, mode: "students" | "courses") {
    setActiveClass(c);
    setModalMode(mode);
    setFormError(null);
    setFormMessage(null);
    setSelectedStudentIds([]);

    if (mode === "students") {
      setIsLoadingStudents(true);
      const students = await listStudentsInClass(c.id);
      setClassStudents(students);
      setIsLoadingStudents(false);
    }
  }

  function handleCloseModal() {
    setActiveClass(null);
    setModalMode(null);
    setClassStudents([]);
    setSelectedStudentIds([]);
    setFormError(null);
    setFormMessage(null);
  }
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormMessage(null);
    setIsSubmitting(true);

    const res = await createClass({
      name: name || `${branch} ${semester}-${section}`,
      branch,
      semester,
      section,
      academicYear,
    });

    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      setFormMessage(res.message ?? "Class created!");
      setName("");
      setIsCreating(false);
      onRefresh();
    }
  }
  async function handleDelete(classId: string, className: string) {
    if (!confirm(`Are you sure you want to delete '${className}'?`)) return;
    const res = await deleteClass(classId);
    if (res.error) {
      alert(res.error);
    } else {
      onRefresh();
    }
  }
  async function handleAssignStudents() {
    if (!activeClass || selectedStudentIds.length === 0) return;
    setFormError(null);
    setFormMessage(null);

    const res = await assignStudentsToClass(activeClass.id, selectedStudentIds);
    if (res.error) {
      setFormError(res.error);
    } else {
      setFormMessage(res.message ?? "Students assigned!");
      setSelectedStudentIds([]);
      const updated = await listStudentsInClass(activeClass.id);
      setClassStudents(updated);
      onRefresh();
    }
  }
  async function handleRemoveStudent(studentId: string) {
    if (!activeClass) return;
    const res = await removeStudentFromClass(activeClass.id, studentId);
    if (res.error) {
      alert(res.error);
    } else {
      const updated = await listStudentsInClass(activeClass.id);
      setClassStudents(updated);
      onRefresh();
    }
  }
  async function handleLinkCourse() {
    if (!activeClass || !selectedCourseCode) return;
    setFormError(null);
    setFormMessage(null);

    const res = await assignCourseToClass(activeClass.id, selectedCourseCode);
    if (res.error) {
      setFormError(res.error);
    } else {
      setFormMessage(res.message ?? "Course linked!");
      setSelectedCourseCode("");
      onRefresh();
    }
  }
  async function handleUnlinkCourse(courseCode: string) {
    if (!activeClass) return;
    const res = await removeCourseFromClass(activeClass.id, courseCode);
    if (res.error) {
      alert(res.error);
    } else {
      onRefresh();
    }
  }
  function toggleStudentSelection(sid: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid]
    );
  }
  const currentStudentIds = new Set(classStudents.map((s) => s.student_id));
  const poolFiltered = availableStudents
    .filter((s) => !currentStudentIds.has(s.id))
    .filter((s) => {
      if (!studentSearch.trim()) return true;
      const term = studentSearch.toLowerCase();
      return (
        s.full_name.toLowerCase().includes(term) ||
        (s.roll_no && s.roll_no.toLowerCase().includes(term))
      );
    });

  return (
    <div className="space-y-6">
      
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Input
            placeholder="Branch filter (e.g. CSE)"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Semester (e.g. Sem-4)"
            value={semFilter}
            onChange={(e) => setSemFilter(e.target.value)}
            className="w-40"
          />
        </div>

        <Button onClick={() => setIsCreating(!isCreating)} className="gap-2">
          <Plus className="h-4 w-4" />
          {isCreating ? "Cancel" : "New Class Section"}
        </Button>
      </div>

      
      {isCreating && (
        <Card className="border-primary/20 bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Create New Class Section</CardTitle>
            <CardDescription>
              Define a new student cohort (e.g., Branch: CSE, Semester: Sem-4, Section: A).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}
              {formMessage && (
                <div className="rounded-md bg-emerald-500/15 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                  {formMessage}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
                <div>
                  <Label htmlFor="c-branch">Branch</Label>
                  <Input
                    id="c-branch"
                    placeholder="e.g. CSE"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="c-sem">Semester</Label>
                  <Input
                    id="c-sem"
                    placeholder="e.g. Sem-4"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="c-sec">Section</Label>
                  <Input
                    id="c-sec"
                    placeholder="e.g. A"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="c-name">Class Name</Label>
                  <Input
                    id="c-name"
                    placeholder="e.g. Sem-4 CSE-A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="c-year">Academic Year</Label>
                  <Input
                    id="c-year"
                    placeholder="e.g. 2024-2025"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Save Class Section"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No class sections found. Click &quot;New Class Section&quot; to create one.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="relative transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{c.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 pt-1 text-xs">
                      <Building2 className="h-3.5 w-3.5" /> {c.branch} &bull; {c.semester} (Sec {c.section})
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Calendar className="h-3 w-3" /> {c.academic_year}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between border-y py-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    {c.student_count ?? 0} Students
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <BookOpen className="h-4 w-4 text-primary" />
                    {c.course_count ?? 0} Courses Linked
                  </span>
                </div>

                
                {c.assigned_courses && c.assigned_courses.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {c.assigned_courses.map((code) => (
                      <Badge key={code} variant="secondary" className="text-[11px]">
                        {code}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic text-muted-foreground">
                    No courses linked yet.
                  </p>
                )}

                
                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenModal(c, "students")}
                      className="gap-1 text-xs"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Students
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenModal(c, "courses")}
                      className="gap-1 text-xs"
                    >
                      <BookOpen className="h-3.5 w-3.5" /> Courses
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(c.id, c.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      
      {activeClass && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="text-lg">
                  {modalMode === "students"
                    ? `Manage Roster: ${activeClass.name}`
                    : `Link Courses: ${activeClass.name}`}
                </CardTitle>
                <CardDescription className="text-xs">
                  {modalMode === "students"
                    ? "Assign students to this section or remove existing ones."
                    : "Link courses to this section to auto-enroll all students."}
                </CardDescription>
              </div>
              <Button size="icon" variant="ghost" onClick={handleCloseModal}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}
              {formMessage && (
                <div className="rounded-md bg-emerald-500/15 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                  {formMessage}
                </div>
              )}

              
              {modalMode === "students" && (
                <div className="space-y-6">
                  
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" /> Current Roster ({classStudents.length})
                    </h4>
                    {isLoadingStudents ? (
                      <p className="text-xs text-muted-foreground">Loading roster...</p>
                    ) : classStudents.length === 0 ? (
                      <p className="text-xs italic text-muted-foreground">No students in this class section yet.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                        {classStudents.map((s) => (
                          <div
                            key={s.student_id}
                            className="flex items-center justify-between p-2.5 text-xs"
                          >
                            <div>
                              <p className="font-medium text-foreground">{s.full_name}</p>
                              {s.roll_no && (
                                <p className="font-mono text-muted-foreground">{s.roll_no}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleRemoveStudent(s.student_id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-sm">Add Students to Class</h4>
                      {selectedStudentIds.length > 0 && (
                        <Button
                          size="sm"
                          onClick={handleAssignStudents}
                          className="gap-1 text-xs"
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Add Selected ({selectedStudentIds.length})
                        </Button>
                      )}
                    </div>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search unassigned students by name or SRN..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="pl-9 text-xs"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                      {poolFiltered.length === 0 ? (
                        <p className="p-3 text-xs italic text-muted-foreground text-center">
                          No matching students available to add.
                        </p>
                      ) : (
                        poolFiltered.map((s) => {
                          const isSelected = selectedStudentIds.includes(s.id);
                          return (
                            <div
                              key={s.id}
                              onClick={() => toggleStudentSelection(s.id)}
                              className={`flex items-center justify-between p-2.5 text-xs cursor-pointer transition-colors ${
                                isSelected ? "bg-primary/10 font-medium" : "hover:bg-muted/50"
                              }`}
                            >
                              <div>
                                <p>{s.full_name}</p>
                                {s.roll_no && <p className="font-mono text-muted-foreground text-[11px]">{s.roll_no}</p>}
                              </div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudentSelection(s.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              
              {modalMode === "courses" && (
                <div className="space-y-6">
                  
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-primary" /> Currently Linked Courses
                    </h4>
                    {activeClass.assigned_courses && activeClass.assigned_courses.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeClass.assigned_courses.map((code) => (
                          <div
                            key={code}
                            className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs"
                          >
                            <span className="font-medium">{code}</span>
                            <button
                              onClick={() => handleUnlinkCourse(code)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">No courses linked yet.</p>
                    )}
                  </div>

                  
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="font-semibold text-sm">Link Course & Auto-enroll Roster</h4>
                    <p className="text-xs text-muted-foreground">
                      Linking a course automatically enrolls all current students in this class section into that course.
                    </p>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCourseCode}
                        onChange={(e) => setSelectedCourseCode(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select a course to link...</option>
                        {availableCourses
                          .filter((c) => !activeClass.assigned_courses?.includes(c.code))
                          .map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code} — {c.name} ({c.semester})
                            </option>
                          ))}
                      </select>

                      <Button
                        size="sm"
                        disabled={!selectedCourseCode}
                        onClick={handleLinkCourse}
                        className="gap-1 text-xs shrink-0"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Link & Enroll
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
