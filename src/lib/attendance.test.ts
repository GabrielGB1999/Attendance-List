import { describe, it, expect } from 'vitest';
import { getAttendancePercentage, getAttendanceStats, type AttendanceRecord } from './attendance';

// Helper: build a single-month attendance record from a list of statuses for one student.
function record(studentId: string, statuses: string[]): AttendanceRecord {
  const month: Record<string, Record<string, string>> = {};
  statuses.forEach((status, i) => {
    month[String(i + 1)] = { [studentId]: status };
  });
  return { Marzo: month };
}

describe('getAttendancePercentage', () => {
  it('returns 0 when there are no records', () => {
    expect(getAttendancePercentage({}, '1')).toBe(0);
    expect(getAttendancePercentage(record('1', []), '1')).toBe(0);
  });

  it('counts a full P as a whole present day', () => {
    expect(getAttendancePercentage(record('1', ['P', 'P', 'P']), '1')).toBe(100);
  });

  it('counts A and A/P as absences (0)', () => {
    expect(getAttendancePercentage(record('1', ['A', 'A/P']), '1')).toBe(0);
    expect(getAttendancePercentage(record('1', ['P', 'A']), '1')).toBe(50);
  });

  it('counts a late (T) as 3/4 of a present, i.e. 1/4 of an absence', () => {
    // P,P,A,T,P -> (3 + 0.75) / 5 = 75%
    expect(getAttendancePercentage(record('1', ['P', 'P', 'A', 'T', 'P']), '1')).toBe(75);
    // single T -> 75%
    expect(getAttendancePercentage(record('1', ['T']), '1')).toBe(75);
  });

  it('ignores empty cells (not effectively-given classes)', () => {
    expect(getAttendancePercentage(record('1', ['P', '', 'P']), '1')).toBe(100);
  });

  it('matches numeric (legacy) and string student ids', () => {
    const rec = record('1751812345678', ['P', 'A']);
    expect(getAttendancePercentage(rec, 1751812345678)).toBe(50);
    expect(getAttendancePercentage(rec, '1751812345678')).toBe(50);
  });
});

describe('getAttendanceStats', () => {
  it('counts classes given, presents, absents (A + A/P) and lates', () => {
    // A,T,P,A/P,P
    const stats = getAttendanceStats(record('1', ['A', 'T', 'P', 'A/P', 'P']), '1');
    expect(stats).toEqual({ clasesDadas: 5, presentes: 2, ausentes: 2, tardes: 1 });
  });

  it('returns zeros when there are no records', () => {
    expect(getAttendanceStats({}, '1')).toEqual({ clasesDadas: 0, presentes: 0, ausentes: 0, tardes: 0 });
  });

  it('ignores empty cells', () => {
    const stats = getAttendanceStats(record('1', ['P', '', 'T']), '1');
    expect(stats).toEqual({ clasesDadas: 2, presentes: 1, ausentes: 0, tardes: 1 });
  });
});
