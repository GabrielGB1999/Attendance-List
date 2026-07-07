import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import archiver from 'archiver';
import * as xlsx from 'xlsx';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'attendance.db');
const db = new Database(dbPath);

// Initialize database.
// NOTE: the legacy JSON columns (students_json, attendance_json) are kept for
// backwards compatibility and as a rollback safety net. Live data now lives in
// the normalized `students` and `attendance` tables (see migration below).
db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    schedule_json TEXT DEFAULT '[]',
    students_json TEXT DEFAULT '[]',
    attendance_json TEXT DEFAULT '{}',
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    course_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    group_name TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    course_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    day INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY (course_id, month, day, student_id)
  );

  CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance(course_id);
`);

// Idempotent column adds (older DBs may predate these columns).
for (const stmt of [
  'ALTER TABLE courses ADD COLUMN schedule_json TEXT DEFAULT "[]"',
  'ALTER TABLE courses ADD COLUMN year INTEGER DEFAULT 2026',
]) {
  try { db.exec(stmt); } catch (e) { /* column already exists */ }
}

// Correct a historical month-name typo. Because the month name is used as a
// storage key, existing data must be re-keyed rather than just relabeled.
const MONTH_FIXES: Record<string, string> = { 'Novembiembre': 'Noviembre' };

// One-time, non-destructive migration of the legacy JSON blobs into the
// normalized tables. Guarded by PRAGMA user_version so it runs exactly once and
// never duplicates or corrupts data. The JSON columns are left untouched.
const schemaVersion = db.pragma('user_version', { simple: true }) as number;
if (schemaVersion < 1) {
  const migrate = db.transaction(() => {
    const legacyCourses = db.prepare('SELECT id, students_json, attendance_json FROM courses').all() as any[];
    const insStudent = db.prepare('INSERT OR IGNORE INTO students (id, course_id, name, group_name) VALUES (?, ?, ?, ?)');
    const insAtt = db.prepare('INSERT OR IGNORE INTO attendance (course_id, month, day, student_id, status) VALUES (?, ?, ?, ?, ?)');

    for (const c of legacyCourses) {
      const students = JSON.parse(c.students_json || '[]');
      for (const s of students) {
        const id = s.id != null ? String(s.id) : randomUUID();
        insStudent.run(id, c.id, s.name ?? '', s.group ?? null);
      }
      const attendance = JSON.parse(c.attendance_json || '{}');
      for (const rawMonth in attendance) {
        const month = MONTH_FIXES[rawMonth] || rawMonth;
        for (const day in attendance[rawMonth]) {
          for (const studentId in attendance[rawMonth][day]) {
            const status = attendance[rawMonth][day][studentId];
            if (status) insAtt.run(c.id, month, Number(day), String(studentId), status);
          }
        }
      }
    }
    db.pragma('user_version = 1');
  });
  migrate();
}

// --- Helpers that read the normalized tables back into the API's shape ---
function getCourseStudents(courseId: number | string) {
  const rows = db.prepare('SELECT id, name, group_name FROM students WHERE course_id = ?').all(courseId) as any[];
  return rows.map(r => ({ id: r.id, name: r.name, group: r.group_name || undefined }));
}

function getCourseAttendance(courseId: number | string) {
  const rows = db.prepare('SELECT month, day, student_id, status FROM attendance WHERE course_id = ?').all(courseId) as any[];
  const attendance: Record<string, Record<string, Record<string, string>>> = {};
  for (const r of rows) {
    if (!attendance[r.month]) attendance[r.month] = {};
    if (!attendance[r.month][r.day]) attendance[r.month][r.day] = {};
    attendance[r.month][r.day][r.student_id] = r.status;
  }
  return attendance;
}

// Set (or clear, when status is empty) a single attendance cell.
function setAttendanceCell(courseId: number, month: string, day: number | string, studentId: string, status: string) {
  if (!status) {
    db.prepare('DELETE FROM attendance WHERE course_id = ? AND month = ? AND day = ? AND student_id = ?')
      .run(courseId, month, Number(day), String(studentId));
  } else {
    db.prepare(`INSERT INTO attendance (course_id, month, day, student_id, status) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(course_id, month, day, student_id) DO UPDATE SET status = excluded.status`)
      .run(courseId, month, Number(day), String(studentId), status);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // WebSocket handling
  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'attendance:update') {
          const { courseId, month, day, studentId, status } = message;

          // Update a single attendance cell in the normalized table
          setAttendanceCell(Number(courseId), month, day, String(studentId), status);

          // Broadcast to all other clients
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'attendance:updated',
                courseId,
                month,
                day,
                studentId,
                status
              }));
            }
          });
        }
      } catch (e) {
        console.error('WS Error:', e);
      }
    });
  });

  const verifyAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const password = req.headers['x-admin-password'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (password === adminPassword) {
      next();
    } else {
      res.status(403).json({ error: 'Unauthorized: Incorrect admin password' });
    }
  };

  // API Routes
  app.get('/api/subjects', (req, res) => {
    const subjects = db.prepare('SELECT * FROM subjects').all();
    res.json(subjects);
  });

  app.post('/api/subjects', (req, res) => {
    const { name } = req.body;
    const result = db.prepare('INSERT INTO subjects (name) VALUES (?)').run(name);
    res.json({ id: result.lastInsertRowid, name });
  });

  app.delete('/api/subjects/:id', verifyAdmin, (req, res) => {
    const subjectId = req.params.id;
    db.transaction(() => {
      const courseIds = (db.prepare('SELECT id FROM courses WHERE subject_id = ?').all(subjectId) as any[]).map(c => c.id);
      const delStudents = db.prepare('DELETE FROM students WHERE course_id = ?');
      const delAtt = db.prepare('DELETE FROM attendance WHERE course_id = ?');
      for (const cid of courseIds) { delStudents.run(cid); delAtt.run(cid); }
      db.prepare('DELETE FROM courses WHERE subject_id = ?').run(subjectId);
      db.prepare('DELETE FROM subjects WHERE id = ?').run(subjectId);
    })();
    res.json({ success: true });
  });

  app.get('/api/subjects/:id/courses', (req, res) => {
    const courses = db.prepare('SELECT id, name FROM courses WHERE subject_id = ?').all(req.params.id);
    res.json(courses);
  });

  app.post('/api/subjects/:id/courses', (req, res) => {
    const { name, schedule, year } = req.body;
    const courseYear = Number(year) || 2026;
    const result = db.prepare('INSERT INTO courses (subject_id, name, schedule_json, students_json, attendance_json, year) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.id, name, JSON.stringify(schedule || []), '[]', '{}', courseYear);
    res.json({ id: result.lastInsertRowid, subject_id: req.params.id, name, schedule, year: courseYear });
  });

  app.delete('/api/courses/:id', verifyAdmin, (req, res) => {
    const courseId = req.params.id;
    db.transaction(() => {
      db.prepare('DELETE FROM students WHERE course_id = ?').run(courseId);
      db.prepare('DELETE FROM attendance WHERE course_id = ?').run(courseId);
      db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
    })();
    res.json({ success: true });
  });

  app.get('/api/courses/:id', (req, res) => {
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id) as any;
    if (course) {
      res.json({
        ...course,
        schedule: JSON.parse(course.schedule_json || '[]'),
        year: course.year ?? 2026,
        students: getCourseStudents(course.id),
        attendance: getCourseAttendance(course.id)
      });
    } else {
      res.status(404).json({ error: 'Course not found' });
    }
  });

  app.post('/api/courses/:id/attendance', (req, res) => {
    const { attendance: incomingAttendance } = req.body;
    const courseId = Number(req.params.id);

    try {
      db.transaction(() => {
        const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
        if (!course) {
          throw new Error('Course not found');
        }
        for (const month in incomingAttendance) {
          for (const day in incomingAttendance[month]) {
            for (const studentId in incomingAttendance[month][day]) {
              setAttendanceCell(courseId, month, day, String(studentId), incomingAttendance[month][day][studentId]);
            }
          }
        }
      })();

      // Broadcast the full, current state (rebuilt from the table) to all clients
      const mergedAttendance = getCourseAttendance(courseId);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'attendance:full_update',
            courseId: String(courseId),
            attendance: mergedAttendance
          }));
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error saving attendance:', error);
      res.status(500).json({ error: 'Failed to save attendance' });
    }
  });

  app.post('/api/courses/:id/students', (req, res, next) => {
    // Only verify admin if students are being removed
    const { students } = req.body;
    const row = db.prepare('SELECT COUNT(*) AS c FROM students WHERE course_id = ?').get(req.params.id) as any;
    if (row && students.length < row.c) {
      return verifyAdmin(req, res, next);
    }
    next();
  }, (req, res) => {
    const { students } = req.body;
    const courseId = Number(req.params.id);
    // Sync the students table to the provided list: delete removed ones, upsert
    // the rest. Attendance rows are left untouched (orphans are ignored by the
    // UI, matching the previous JSON behaviour).
    db.transaction(() => {
      const incomingIds = new Set(students.map((s: any) => String(s.id)));
      const existing = db.prepare('SELECT id FROM students WHERE course_id = ?').all(courseId) as any[];
      const del = db.prepare('DELETE FROM students WHERE course_id = ? AND id = ?');
      for (const e of existing) {
        if (!incomingIds.has(String(e.id))) del.run(courseId, e.id);
      }
      const up = db.prepare(`INSERT INTO students (id, course_id, name, group_name) VALUES (?, ?, ?, ?)
                             ON CONFLICT(id) DO UPDATE SET name = excluded.name, group_name = excluded.group_name, course_id = excluded.course_id`);
      for (const s of students) {
        up.run(String(s.id), courseId, s.name ?? '', s.group ?? null);
      }
    })();
    res.json({ success: true });
  });

  app.get('/api/backup', (req, res) => {
    const subjects = db.prepare('SELECT * FROM subjects').all();
    const rawCourses = db.prepare('SELECT * FROM courses').all() as any[];

    // Rebuild the JSON columns from the normalized tables so the backup always
    // reflects current data. Shape is kept identical to the legacy format, so
    // both old and new backups restore through the same code path.
    const courses = rawCourses.map((c: any) => ({
      id: c.id,
      subject_id: c.subject_id,
      name: c.name,
      schedule_json: c.schedule_json || '[]',
      year: c.year ?? 2026,
      students_json: JSON.stringify(getCourseStudents(c.id)),
      attendance_json: JSON.stringify(getCourseAttendance(c.id)),
    }));

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.attachment('attendance_backup.zip');
    archive.pipe(res);

    archive.append(JSON.stringify({ subjects, courses }, null, 2), { name: 'backup_data.json' });

    for (const subject of subjects as any[]) {
      const subjectCourses = courses.filter((c: any) => c.subject_id === subject.id);
      for (const course of subjectCourses as any[]) {
        const students = JSON.parse(course.students_json || '[]');
        const attendance = JSON.parse(course.attendance_json || '{}');

        const wb = xlsx.utils.book_new();

        const wsData = [['ID', 'Name', 'Group']];
        students.forEach((s: any) => {
          wsData.push([s.id, s.name, s.group || '']);
        });
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        xlsx.utils.book_append_sheet(wb, ws, 'Students');

        const attData = [['Month', 'Day', 'Student ID', 'Status']];
        for (const month in attendance) {
          for (const day in attendance[month]) {
            for (const studentId in attendance[month][day]) {
              attData.push([month, day, studentId, attendance[month][day][studentId]]);
            }
          }
        }
        const wsAtt = xlsx.utils.aoa_to_sheet(attData);
        xlsx.utils.book_append_sheet(wb, wsAtt, 'Attendance');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        archive.append(buffer, { name: `${subject.name}/${course.name}.xlsx` });
      }
    }

    archive.finalize();
  });

  const upload = multer({ storage: multer.memoryStorage() });

  app.post('/api/restore', verifyAdmin, upload.single('backup'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const zip = new AdmZip(req.file.buffer);
      const zipEntries = zip.getEntries();
      
      let backupDataJson = null;
      
      for (const entry of zipEntries) {
        if (entry.entryName === 'backup_data.json') {
          backupDataJson = entry.getData().toString('utf8');
          break;
        }
      }

      if (backupDataJson) {
        const { subjects, courses } = JSON.parse(backupDataJson);
        
        db.transaction(() => {
          db.prepare('DELETE FROM attendance').run();
          db.prepare('DELETE FROM students').run();
          db.prepare('DELETE FROM courses').run();
          db.prepare('DELETE FROM subjects').run();

          if (subjects && subjects.length > 0) {
            const insertSubject = db.prepare('INSERT INTO subjects (id, name) VALUES (?, ?)');
            for (const sub of subjects) {
              insertSubject.run(sub.id, sub.name);
            }
          }

          if (courses && courses.length > 0) {
            // Keep the legacy JSON columns for compatibility AND populate the
            // normalized tables. Works for both old backups (that already carry
            // students_json/attendance_json) and new ones (same shape).
            const insertCourse = db.prepare('INSERT INTO courses (id, subject_id, name, schedule_json, students_json, attendance_json, year) VALUES (?, ?, ?, ?, ?, ?, ?)');
            const insStudent = db.prepare('INSERT OR IGNORE INTO students (id, course_id, name, group_name) VALUES (?, ?, ?, ?)');
            const insAtt = db.prepare('INSERT OR IGNORE INTO attendance (course_id, month, day, student_id, status) VALUES (?, ?, ?, ?, ?)');

            for (const c of courses) {
              const studentsJson = c.students_json ?? '[]';
              const attendanceJson = c.attendance_json ?? '{}';
              insertCourse.run(c.id, c.subject_id, c.name, c.schedule_json ?? '[]', studentsJson, attendanceJson, c.year ?? 2026);

              const students = JSON.parse(studentsJson || '[]');
              for (const s of students) {
                const id = s.id != null ? String(s.id) : randomUUID();
                insStudent.run(id, c.id, s.name ?? '', s.group ?? null);
              }
              const attendance = JSON.parse(attendanceJson || '{}');
              for (const rawMonth in attendance) {
                const month = MONTH_FIXES[rawMonth] || rawMonth;
                for (const day in attendance[rawMonth]) {
                  for (const studentId in attendance[rawMonth][day]) {
                    const status = attendance[rawMonth][day][studentId];
                    if (status) insAtt.run(c.id, month, Number(day), String(studentId), status);
                  }
                }
              }
            }
          }
        })();

        // Broadcast a refresh to all clients to reload their data
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'restore:complete' }));
          }
        });

        return res.json({ success: true });
      } else {
        return res.status(400).json({ error: 'The uploaded file does not contain a valid backup_data.json. Legacy Excel-only backups cannot be restored automatically.' });
      }
    } catch (error: any) {
      console.error('Restore error:', error);
      return res.status(500).json({ error: 'Failed to restore backup: ' + error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
