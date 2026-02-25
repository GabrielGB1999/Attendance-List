import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import archiver from 'archiver';
import * as xlsx from 'xlsx';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'attendance.db');
const db = new Database(dbPath);

// Initialize database
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
`);

try {
  db.exec('ALTER TABLE courses ADD COLUMN schedule_json TEXT DEFAULT "[]"');
} catch (e) {
  // Column already exists
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

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
    db.prepare('DELETE FROM courses WHERE subject_id = ?').run(req.params.id);
    db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/subjects/:id/courses', (req, res) => {
    const courses = db.prepare('SELECT id, name FROM courses WHERE subject_id = ?').all(req.params.id);
    res.json(courses);
  });

  app.post('/api/subjects/:id/courses', (req, res) => {
    const { name, schedule } = req.body;
    const result = db.prepare('INSERT INTO courses (subject_id, name, schedule_json, students_json, attendance_json) VALUES (?, ?, ?, ?, ?)').run(req.params.id, name, JSON.stringify(schedule || []), '[]', '{}');
    res.json({ id: result.lastInsertRowid, subject_id: req.params.id, name, schedule });
  });

  app.delete('/api/courses/:id', verifyAdmin, (req, res) => {
    db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/courses/:id', (req, res) => {
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (course) {
      res.json({
        ...course,
        schedule: JSON.parse((course as any).schedule_json || '[]'),
        students: JSON.parse((course as any).students_json),
        attendance: JSON.parse((course as any).attendance_json)
      });
    } else {
      res.status(404).json({ error: 'Course not found' });
    }
  });

  app.post('/api/courses/:id/attendance', (req, res) => {
    const { attendance } = req.body;
    db.prepare('UPDATE courses SET attendance_json = ? WHERE id = ?').run(JSON.stringify(attendance), req.params.id);
    res.json({ success: true });
  });

  app.post('/api/courses/:id/students', (req, res, next) => {
    // Only verify admin if students are being removed
    const { students } = req.body;
    const course = db.prepare('SELECT students_json FROM courses WHERE id = ?').get(req.params.id);
    if (course) {
      const currentStudents = JSON.parse((course as any).students_json || '[]');
      if (students.length < currentStudents.length) {
        return verifyAdmin(req, res, next);
      }
    }
    next();
  }, (req, res) => {
    const { students } = req.body;
    db.prepare('UPDATE courses SET students_json = ? WHERE id = ?').run(JSON.stringify(students), req.params.id);
    res.json({ success: true });
  });

  app.get('/api/backup', (req, res) => {
    const subjects = db.prepare('SELECT * FROM subjects').all();
    const courses = db.prepare('SELECT * FROM courses').all();

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.attachment('attendance_backup.zip');
    archive.pipe(res);

    for (const subject of subjects as any[]) {
      const subjectCourses = courses.filter((c: any) => c.subject_id === subject.id);
      for (const course of subjectCourses as any[]) {
        const students = JSON.parse(course.students_json || '[]');
        const attendance = JSON.parse(course.attendance_json || '{}');
        
        const wb = xlsx.utils.book_new();
        
        const wsData = [['ID', 'List Number', 'Name', 'Group']];
        students.forEach((s: any) => {
          wsData.push([s.id, s.listNumber, s.name, s.group || '']);
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

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
