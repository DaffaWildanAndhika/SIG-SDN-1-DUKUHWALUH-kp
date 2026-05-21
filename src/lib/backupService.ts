import { supabase } from "./supabase";

export interface BackupData {
  teachers: any[];
  students: any[];
  classes: any[];
  schedules: any[];
  attendance: any[];
  grades: any[];
  announcements: any[];
  picket_schedules?: any[];
  agendas?: any[];
  lesson_materials?: any[];
  semester_grades?: any[];
}

/**
 * Downloads backup JSON object as a file in browser
 */
export function downloadBackupFile(data: BackupData) {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(data, null, 2)
  )}`;
  const downloadAnchor = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  downloadAnchor.setAttribute("href", jsonString);
  downloadAnchor.setAttribute("download", `backup-${today}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Performs backup by fetching all tables in security/foreign-key safe order
 */
export async function performBackup(): Promise<BackupData> {
  const { data: teachers, error: teachersError } = await supabase
    .from("profiles")
    .select("*");
  if (teachersError) {
    throw new Error("Gagal mengekspor data guru (profiles): " + teachersError.message);
  }

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("*");
  if (studentsError) {
    throw new Error("Gagal mengekspor data siswa: " + studentsError.message);
  }

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("*");
  if (classesError) {
    throw new Error("Gagal mengekspor data kelas: " + classesError.message);
  }

  const { data: schedules, error: schedulesError } = await supabase
    .from("teaching_schedules")
    .select("*");
  if (schedulesError) {
    throw new Error("Gagal mengekspor data jadwal mengajar: " + schedulesError.message);
  }

  const { data: picketSchedules } = await supabase
    .from("picket_schedules")
    .select("*");

  const { data: agendas } = await supabase
    .from("agendas")
    .select("*");

  const { data: lessonMaterials } = await supabase
    .from("lesson_materials")
    .select("*");

  const { data: studentGrades, error: gradesError } = await supabase
    .from("student_grades")
    .select("*");
  if (gradesError) {
    throw new Error("Gagal mengekspor nilai siswa: " + gradesError.message);
  }

  const { data: semesterGrades } = await supabase
    .from("semester_grades")
    .select("*");

  const { data: announcements, error: announcementsError } = await supabase
    .from("announcements")
    .select("*");
  if (announcementsError) {
    throw new Error("Gagal mengekspor data pengumuman: " + announcementsError.message);
  }

  // Attendance may not have a dedicated schema in some projects, default to empty
  let attendance: any[] = [];
  try {
    const { data } = await supabase.from("attendance").select("*");
    if (data) attendance = data;
  } catch (e) {
    console.warn("Attendance table does not exist or has RLS restrictions, defaulting to empty array.");
  }

  return {
    teachers: teachers || [],
    students: students || [],
    classes: classes || [],
    schedules: schedules || [],
    attendance,
    grades: studentGrades || [],
    announcements: announcements || [],
    picket_schedules: picketSchedules || [],
    agendas: agendas || [],
    lesson_materials: lessonMaterials || [],
    semester_grades: semesterGrades || []
  };
}

/**
 * Validates a loaded backup file's fields
 */
export function validateBackupSchema(parsed: any): parsed is BackupData {
  if (!parsed || typeof parsed !== "object") return false;

  const requiredKeys = [
    "teachers",
    "students",
    "classes",
    "schedules",
    "attendance",
    "grades",
    "announcements"
  ];

  for (const key of requiredKeys) {
    if (!(key in parsed) || !Array.isArray(parsed[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Restores database from standard backup
 */
export async function performRestore(backup: BackupData): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    throw new Error("Akses ditolak: Administrator tidak terautentikasi.");
  }

  // --- Step 1: Delete dependent child records to parent rows ---
  // 1. Delete grades and semester grades
  const { error: delSg } = await supabase
    .from("semester_grades")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delSg) console.warn("Restore clear error (semester_grades):", delSg.message);

  const { error: delGr } = await supabase
    .from("student_grades")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delGr) console.warn("Restore clear error (student_grades):", delGr.message);

  // 2. Delete lesson_materials
  const { error: delLm } = await supabase
    .from("lesson_materials")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delLm) console.warn("Restore clear error (lesson_materials):", delLm.message);

  // 3. Delete schedules
  const { error: delSch } = await supabase
    .from("teaching_schedules")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delSch) console.warn("Restore clear error (teaching_schedules):", delSch.message);

  const { error: delPic } = await supabase
    .from("picket_schedules")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delPic) console.warn("Restore clear error (picket_schedules):", delPic.message);

  // 4. Delete announcements and agendas
  const { error: delAn } = await supabase
    .from("announcements")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delAn) console.warn("Restore clear error (announcements):", delAn.message);

  const { error: delAg } = await supabase
    .from("agendas")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delAg) console.warn("Restore clear error (agendas):", delAg.message);

  // 5. Delete students
  const { error: delSt } = await supabase
    .from("students")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delSt) console.warn("Restore clear error (students):", delSt.message);

  // 6. Delete classes
  const { error: delCl } = await supabase
    .from("classes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delCl) console.warn("Restore clear error (classes):", delCl.message);

  // 7. Delete other user profiles EXCEPT the current authenticated administrator!
  // This is vital to prevent losing RLS insert authorization on subsequent steps.
  const { error: delPr } = await supabase
    .from("profiles")
    .delete()
    .neq("id", currentUserId);
  if (delPr) {
    throw new Error("Gagal membersihkan data guru (profiles): " + delPr.message);
  }

  // --- Step 2: Insert restored records in parent-to-child order ---
  // 1. Recover teachers (profiles)
  if (backup.teachers && backup.teachers.length > 0) {
    // Upsert to handle current admin's profile updates or potential constraints cleanly without duplicates
    const { error: insPr } = await supabase.from("profiles").upsert(backup.teachers);
    if (insPr) {
      throw new Error("Gagal memulihkan data guru (profiles): " + insPr.message);
    }
  }

  // 2. Recover classes
  if (backup.classes && backup.classes.length > 0) {
    const { error: insCl } = await supabase.from("classes").insert(backup.classes);
    if (insCl) {
      throw new Error("Gagal memulihkan data kelas: " + insCl.message);
    }
  }

  // 3. Recover students
  if (backup.students && backup.students.length > 0) {
    const { error: insSt } = await supabase.from("students").insert(backup.students);
    if (insSt) {
      throw new Error("Gagal memulihkan data siswa: " + insSt.message);
    }
  }

  // 4. Recover teaching_schedules
  if (backup.schedules && backup.schedules.length > 0) {
    const { error: insSch } = await supabase.from("teaching_schedules").insert(backup.schedules);
    if (insSch) {
      throw new Error("Gagal memulihkan jadwal mengajar: " + insSch.message);
    }
  }

  // 5. Recover picket schedules (optional)
  if (backup.picket_schedules && backup.picket_schedules.length > 0) {
    const { error: insPic } = await supabase.from("picket_schedules").insert(backup.picket_schedules);
    if (insPic) console.warn("Picket schedules recovery bypassed/failed:", insPic.message);
  }

  // 6. Recover lesson materials (optional)
  if (backup.lesson_materials && backup.lesson_materials.length > 0) {
    const { error: insLm } = await supabase.from("lesson_materials").insert(backup.lesson_materials);
    if (insLm) console.warn("Lesson materials recovery bypassed/failed:", insLm.message);
  }

  // 7. Recover agendas (optional)
  if (backup.agendas && backup.agendas.length > 0) {
    const { error: insAg } = await supabase.from("agendas").insert(backup.agendas);
    if (insAg) console.warn("Agendas recovery bypassed/failed:", insAg.message);
  }

  // 8. Recover announcements
  if (backup.announcements && backup.announcements.length > 0) {
    const { error: insAn } = await supabase.from("announcements").insert(backup.announcements);
    if (insAn) {
      throw new Error("Gagal memulihkan pengumuman: " + insAn.message);
    }
  }

  // 9. Recover grades
  if (backup.grades && backup.grades.length > 0) {
    const { error: insGr } = await supabase.from("student_grades").insert(backup.grades);
    if (insGr) {
      throw new Error("Gagal memulihkan nilai siswa: " + insGr.message);
    }
  }

  // 10. Recover semester grades (optional)
  if (backup.semester_grades && backup.semester_grades.length > 0) {
    const { error: insSg } = await supabase.from("semester_grades").insert(backup.semester_grades);
    if (insSg) console.warn("Semester grades recovery bypassed/failed:", insSg.message);
  }

  // 11. Custom attendance table (optional)
  if (backup.attendance && backup.attendance.length > 0) {
    try {
      await supabase.from("attendance").insert(backup.attendance);
    } catch (e) {
      console.warn("Attendance restore skipped - table not present.");
    }
  }
}
