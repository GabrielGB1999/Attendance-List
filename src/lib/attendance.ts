// Pure attendance calculations shared between the UI and tests.
// Attendance is stored as Month -> Day -> StudentId -> Status.
export type AttendanceRecord = Record<string, Record<string, Record<string, string>>>;

// Student ids can be numbers (legacy) or strings (uuid); JSON keys are strings.
export type StudentId = number | string;

/**
 * Attendance percentage for a student across all recorded days.
 * - P (present) counts as a full day (1).
 * - T (late) counts as 3/4 of a present, i.e. penalizes only 1/4 of an absence.
 * - A and A/P (absent) count as 0.
 * Only cells that have a value are counted as an effectively-given class.
 */
export function getAttendancePercentage(attendance: AttendanceRecord, studentId: StudentId): number {
  let totalDays = 0;
  let presentDays = 0;
  const key = String(studentId);

  Object.values(attendance).forEach(monthData => {
    Object.values(monthData).forEach(dayData => {
      const status = dayData[key];
      if (status) {
        totalDays++;
        if (status === 'P') presentDays++;
        else if (status === 'T') presentDays += 0.75;
      }
    });
  });

  if (totalDays === 0) return 0;
  return Math.round((presentDays / totalDays) * 100);
}

export type AttendanceStats = {
  clasesDadas: number; // cells with any value
  presentes: number; // P
  ausentes: number; // A and A/P
  tardes: number; // T
};

/** Raw counts per status for a student across all recorded days. */
export function getAttendanceStats(attendance: AttendanceRecord, studentId: StudentId): AttendanceStats {
  let clasesDadas = 0;
  let presentes = 0;
  let ausentes = 0;
  let tardes = 0;
  const key = String(studentId);

  Object.values(attendance).forEach(monthData => {
    Object.values(monthData).forEach(dayData => {
      const status = dayData[key];
      if (status) {
        clasesDadas++;
        if (status === 'P') presentes++;
        else if (status === 'A' || status === 'A/P') ausentes++;
        else if (status === 'T') tardes++;
      }
    });
  });

  return { clasesDadas, presentes, ausentes, tardes };
}
