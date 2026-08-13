
import { api } from "./api-client";

export interface ClassInput {
  name: string;
  branch: string;
  semester: string;
  section: string;
  academicYear: string;
}

export interface ClassItem {
  id: string;
  name: string;
  branch: string;
  semester: string;
  section: string;
  academic_year: string;
  created_at: string;
  student_count?: number;
  course_count?: number;
  assigned_courses?: string[];
}

export interface ClassStudentItem {
  student_id: string;
  full_name: string;
  roll_no: string | null;
  pesu_id?: string | null;
  enrolled_at: string;
}

export interface ClassActionState {
  error?: string;
  message?: string;
}


export function validateClassInput(input: Partial<ClassInput>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const name = input.name?.trim() ?? "";
  if (!name) {
    errors.name = "Class name is required";
  } else if (name.length < 2 || name.length > 100) {
    errors.name = "Class name must be between 2 and 100 characters";
  }

  const branch = input.branch?.trim() ?? "";
  if (!branch) errors.branch = "Branch is required";

  const semester = input.semester?.trim() ?? "";
  if (!semester) errors.semester = "Semester is required";

  const section = input.section?.trim() ?? "";
  if (!section) errors.section = "Section is required";

  const academicYear = input.academicYear?.trim() ?? "";
  if (!academicYear) errors.academicYear = "Academic year is required";

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}


export function filterClasses<T extends { name: string; branch: string; semester: string }>(
  classes: T[],
  searchTerm: string = "",
  branchFilter: string = "",
  semFilter: string = ""
): T[] {
  const term = searchTerm.trim().toLowerCase();
  const branch = branchFilter.trim().toLowerCase();
  const sem = semFilter.trim().toLowerCase();

  return classes.filter((c) => {
    const matchesSearch =
      !term ||
      c.name.toLowerCase().includes(term) ||
      c.branch.toLowerCase().includes(term) ||
      c.semester.toLowerCase().includes(term);
    const matchesBranch = !branch || c.branch.toLowerCase() === branch;
    const matchesSem = !sem || c.semester.toLowerCase() === sem;
    return matchesSearch && matchesBranch && matchesSem;
  });
}


export async function listAllClasses(): Promise<ClassItem[]> {
  try {
    const { classes } = await api.get<{
      classes: Array<ClassItem & { student_count: number; course_count: number; assigned_courses: string[] }>;
    }>("/classes");
    return classes;
  } catch (err) {
    console.error("Failed to list classes:", err);
    return [];
  }
}


export async function createClass(input: ClassInput): Promise<ClassActionState> {
  const { isValid, errors } = validateClassInput(input);
  if (!isValid) return { error: Object.values(errors)[0] };
  try {
    await api.post("/classes", {
      name: input.name.trim(),
      branch: input.branch.trim(),
      semester: input.semester.trim(),
      section: input.section.trim(),
      academicYear: input.academicYear.trim(),
    });
    return { message: `Class '${input.name}' created successfully.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create class." };
  }
}


export async function deleteClass(classId: string): Promise<ClassActionState> {
  if (!classId) return { error: "Missing class ID" };
  try {
    await api.del(`/classes/${classId}`);
    return { message: "Class deleted successfully." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete class." };
  }
}


export async function listStudentsInClass(classId: string): Promise<ClassStudentItem[]> {
  if (!classId) return [];
  try {
    const { students } = await api.get<{ students: ClassStudentItem[] }>(
      `/classes/${classId}/students`
    );
    return students;
  } catch (err) {
    console.error("Failed to list students in class:", err);
    return [];
  }
}


export async function listStudentPool(): Promise<{ id: string; full_name: string; roll_no: string | null }[]> {
  try {
    const { profiles } = await api.get<{
      profiles: { id: string; fullName: string; rollNo: string | null }[];
    }>("/profiles?role=student");
    return profiles.map((p) => ({ id: p.id, full_name: p.fullName, roll_no: p.rollNo }));
  } catch {
    return [];
  }
}


export async function assignStudentsToClass(
  classId: string,
  studentIds: string[]
): Promise<ClassActionState> {
  if (!classId) return { error: "Missing class ID" };
  if (!studentIds || studentIds.length === 0) return { error: "No students selected" };
  try {
    await api.post(`/classes/${classId}/students`, { studentIds });
    return { message: `Assigned ${studentIds.length} student(s) to class successfully.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to assign students." };
  }
}


export async function removeStudentFromClass(
  classId: string,
  studentId: string
): Promise<ClassActionState> {
  if (!classId || !studentId) return { error: "Missing parameters" };
  try {
    await api.del(`/classes/${classId}/students/${studentId}`);
    return { message: "Student removed from class." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to remove student." };
  }
}


export async function assignCourseToClass(
  classId: string,
  courseCode: string
): Promise<ClassActionState> {
  if (!classId || !courseCode) return { error: "Missing parameters" };
  try {
    await api.post(`/classes/${classId}/courses`, { courseCode });
    return { message: `Course '${courseCode}' linked to class successfully.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to assign course." };
  }
}


export async function removeCourseFromClass(
  classId: string,
  courseCode: string
): Promise<ClassActionState> {
  if (!classId || !courseCode) return { error: "Missing parameters" };
  try {
    await api.del(`/classes/${classId}/courses/${encodeURIComponent(courseCode)}`);
    return { message: "Course removed from class." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to remove course." };
  }
}
