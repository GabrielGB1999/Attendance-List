import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, ChevronRight, ArrowLeft, Save, Plus, Trash2, Download, Upload } from 'lucide-react';

// Types
type Subject = { id: number; name: string };
type Course = { id: number; subject_id: number; name: string; schedule?: number[] };
type Student = { id: number; listNumber: number; name: string; group?: string };
type AttendanceRecord = Record<string, Record<string, string>>; // Month -> Day -> StudentId -> Status

const DAYS_OF_WEEK = [
  { id: 1, name: 'Mon', fullName: 'Monday' },
  { id: 2, name: 'Tue', fullName: 'Tuesday' },
  { id: 3, name: 'Wed', fullName: 'Wednesday' },
  { id: 4, name: 'Thu', fullName: 'Thursday' },
  { id: 5, name: 'Fri', fullName: 'Friday' },
  { id: 6, name: 'Sat', fullName: 'Saturday' },
  { id: 0, name: 'Sun', fullName: 'Sunday' },
];

// Components
function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void; 
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-xl font-bold text-rose-600 mb-2">{title}</h2>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

function SubjectList() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  const fetchSubjects = () => {
    fetch('/api/subjects')
      .then(res => res.json())
      .then(setSubjects);
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    
    await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSubjectName })
    });
    
    setNewSubjectName('');
    setIsAdding(false);
    fetchSubjects();
  };

  const handleDeleteSubject = async () => {
    if (!subjectToDelete) return;
    await fetch(`/api/subjects/${subjectToDelete.id}`, { method: 'DELETE' });
    setSubjectToDelete(null);
    fetchSubjects();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-indigo-600" />
          Subjects
        </h1>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <a
            href="/api/backup"
            download
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Backup
          </a>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddSubject} className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="Subject Name (e.g., Mathematics)"
            className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors w-full sm:w-auto">
            Save
          </button>
        </form>
      )}

      {subjects.length === 0 && !isAdding && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
          <p className="text-slate-500 mb-4">No subjects found. Create one to get started.</p>
          <button 
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map(subject => (
          <Link
            key={subject.id}
            to={`/subjects/${subject.id}/courses`}
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all group flex items-center justify-between"
          >
            <span className="text-lg font-medium text-slate-700 group-hover:text-indigo-700">
              {subject.name}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSubjectToDelete(subject);
                }}
                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Delete Subject"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
            </div>
          </Link>
        ))}
      </div>

      <ConfirmModal
        isOpen={!!subjectToDelete}
        title="Delete Subject"
        message={`Are you sure you want to delete "${subjectToDelete?.name}"? This will also delete all courses and attendance records associated with it. This action cannot be undone.`}
        onConfirm={handleDeleteSubject}
        onCancel={() => setSubjectToDelete(null)}
      />
    </div>
  );
}

function CourseList() {
  const { subjectId } = useParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourseName, setNewCourseName] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const navigate = useNavigate();

  const fetchCourses = () => {
    fetch(`/api/subjects/${subjectId}/courses`)
      .then(res => res.json())
      .then(setCourses);
  };

  useEffect(() => {
    fetchCourses();
  }, [subjectId]);

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || selectedDays.length === 0) {
      alert('Please enter a course name and select at least one day.');
      return;
    }
    
    await fetch(`/api/subjects/${subjectId}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCourseName, schedule: selectedDays })
    });
    
    setNewCourseName('');
    setSelectedDays([]);
    setIsAdding(false);
    fetchCourses();
  };

  const toggleDay = (dayId: number) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId].sort()
    );
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    await fetch(`/api/courses/${courseToDelete.id}`, { method: 'DELETE' });
    setCourseToDelete(null);
    fetchCourses();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <button 
        onClick={() => navigate('/')}
        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Subjects
      </button>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Courses</h1>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="w-full sm:w-auto flex justify-center items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Course
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddCourse} className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
          <input
            type="text"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            placeholder="Course Name (e.g., Algebra I)"
            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Class Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedDays.includes(day.id)
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {day.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <button type="submit" className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
              Save Course
            </button>
          </div>
        </form>
      )}

      {courses.length === 0 && !isAdding && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
          <p className="text-slate-500 mb-4">No courses found for this subject. Create one to get started.</p>
          <button 
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Course
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map(course => (
          <Link
            key={course.id}
            to={`/courses/${course.id}`}
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all group flex items-center justify-between"
          >
            <span className="text-lg font-medium text-slate-700 group-hover:text-indigo-700">
              {course.name}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCourseToDelete(course);
                }}
                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Delete Course"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
            </div>
          </Link>
        ))}
      </div>

      <ConfirmModal
        isOpen={!!courseToDelete}
        title="Delete Course"
        message={`Are you sure you want to delete "${courseToDelete?.name}"? This will permanently delete all students and attendance records for this course. This action cannot be undone.`}
        onConfirm={handleDeleteCourse}
        onCancel={() => setCourseToDelete(null)}
      />
    </div>
  );
}

function ExcelGrid() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [activeTab, setActiveTab] = useState('March');
  const [saving, setSaving] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGroup, setNewStudentGroup] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const months = ['March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Summary'];
  const YEAR = 2026;

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then(res => res.json())
      .then(data => {
        setCourse(data);
        const sortedStudents = (data.students || [])
          .sort((a: Student, b: Student) => a.name.localeCompare(b.name))
          .map((s: Student, index: number) => ({ ...s, listNumber: index + 1 }));
        setStudents(sortedStudents);
        setAttendance(data.attendance || {});
      });
  }, [courseId]);

  // Calculate valid class days for the selected month
  const getMonthDays = () => {
    if (!course || !course.schedule || course.schedule.length === 0) return [];
    
    const monthIndex = months.indexOf(activeTab) + 2; // March is index 0, but month 2 (0-indexed)
    if (monthIndex > 11) return []; // Summary tab or invalid
    
    const daysInMonth = new Date(YEAR, monthIndex + 1, 0).getDate();
    const validDays = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(YEAR, monthIndex, day);
      if (course.schedule.includes(date.getDay())) {
        validDays.push({
          day,
          date,
          dayOfWeek: DAYS_OF_WEEK.find(d => d.id === date.getDay())?.name || ''
        });
      }
    }
    
    return validDays;
  };

  const validDays = getMonthDays();

  const groupedStudents = students.reduce((acc, student) => {
    const group = student.group || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(student);
    return acc;
  }, {} as Record<string, Student[]>);
  
  const groups = Object.keys(groupedStudents).sort();

  const handleAttendanceChange = (studentId: number, day: number, status: string) => {
    setAttendance(prev => {
      const newAttendance = { ...prev };
      if (!newAttendance[activeTab]) newAttendance[activeTab] = {};
      if (!newAttendance[activeTab][day]) newAttendance[activeTab][day] = {};
      newAttendance[activeTab][day][studentId] = status;
      return newAttendance;
    });
  };

  const saveChanges = async () => {
    setSaving(true);
    await fetch(`/api/courses/${courseId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance })
    });
    setSaving(false);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    const newStudent: Student = {
      id: Date.now(), // simple ID generation
      listNumber: 0,
      name: newStudentName,
      group: newStudentGroup.trim() || undefined
    };

    const updatedStudents = [...students, newStudent]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s, index) => ({ ...s, listNumber: index + 1 }));

    setStudents(updatedStudents);
    setNewStudentName('');
    setNewStudentGroup('');
    setIsAddingStudent(false);

    await fetch(`/api/courses/${courseId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: updatedStudents })
    });
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    
    // Update list numbers for remaining students
    const updatedStudents = students
      .filter(s => s.id !== studentToDelete.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s, index) => ({ ...s, listNumber: index + 1 }));
      
    setStudents(updatedStudents);
    setStudentToDelete(null);
    
    await fetch(`/api/courses/${courseId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: updatedStudents })
    });
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      
      const newStudents: Student[] = [];
      
      lines.forEach((line, index) => {
        // Skip header if it looks like one, or just parse all non-empty lines
        const [name, group] = line.split(',').map(s => s.trim());
        if (name && name.toLowerCase() !== 'name' && name.toLowerCase() !== 'student name') {
          newStudents.push({
            id: Date.now() + index, // Ensure unique ID
            listNumber: 0,
            name,
            group: group || undefined
          });
        }
      });

      if (newStudents.length > 0) {
        const updatedStudents = [...students, ...newStudents]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s, index) => ({ ...s, listNumber: index + 1 }));

        setStudents(updatedStudents);

        await fetch(`/api/courses/${courseId}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: updatedStudents })
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getPercentage = (studentId: number) => {
    let totalDays = 0;
    let presentDays = 0;
    
    Object.values(attendance).forEach(monthData => {
      Object.values(monthData).forEach(dayData => {
        const status = dayData[studentId];
        if (status) {
          totalDays++;
          if (status === 'P' || status === 'L') presentDays++;
        }
      });
    });

    if (totalDays === 0) return 0;
    return Math.round((presentDays / totalDays) * 100);
  };

  if (!course) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-slate-800">{course.name} - Attendance</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </button>
          <button
            onClick={() => setIsAddingStudent(!isAddingStudent)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Student</span>
            <span className="sm:hidden">Add</span>
          </button>
          <button
            onClick={saveChanges}
            disabled={saving}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Changes'}</span>
            <span className="sm:hidden">{saving ? '...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {isAddingStudent && (
        <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
          <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row gap-4 max-w-2xl w-full">
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="Student Name (e.g., John Doe)"
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <input
              type="text"
              value={newStudentGroup}
              onChange={(e) => setNewStudentGroup(e.target.value)}
              placeholder="Group (e.g., A, B) - Optional"
              className="w-full sm:w-64 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors w-full sm:w-auto">
              Add
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 flex overflow-x-auto shrink-0 no-scrollbar">
        {months.map(month => (
          <button
            key={month}
            onClick={() => setActiveTab(month)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === month 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {month}
          </button>
        ))}
      </div>

      {/* Excel Grid Container */}
      <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-auto flex-1">
          {activeTab === 'Summary' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3 font-semibold text-slate-700 border-r border-slate-200 sticky left-0 z-20 bg-slate-50 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px]">Student Name</th>
                  <th className="p-3 font-semibold text-slate-700 border-r border-slate-200 text-center sticky left-[140px] sm:left-[200px] z-20 bg-slate-50 min-w-[40px] max-w-[40px] w-[40px] sm:min-w-[48px] sm:max-w-[48px] sm:w-[48px]">Nº</th>
                  <th className="p-3 font-semibold text-slate-700 text-center">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => (
                  <React.Fragment key={group}>
                    {groups.length > 1 || group !== 'Ungrouped' ? (
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <td className="p-2 text-sm font-semibold text-slate-700 sticky left-0 z-10 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px] bg-slate-100">
                          Group {group}
                        </td>
                        <td className="p-2 text-sm font-semibold text-slate-700 sticky left-[140px] sm:left-[200px] z-10 min-w-[40px] max-w-[40px] w-[40px] sm:min-w-[48px] sm:max-w-[48px] sm:w-[48px] bg-slate-100"></td>
                        <td className="bg-slate-100"></td>
                      </tr>
                    ) : null}
                    {groupedStudents[group].map(student => (
                      <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 group">
                        <td className="p-0 border-r border-slate-200 font-medium text-slate-700 sticky left-0 z-10 bg-white group-hover:bg-slate-50 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px]">
                          <div className="p-3">
                            <span className="truncate block">{student.name}</span>
                          </div>
                        </td>
                        <td className="p-3 border-r border-slate-200 text-center text-slate-500 sticky left-[140px] sm:left-[200px] z-10 bg-white group-hover:bg-slate-50 min-w-[40px] max-w-[40px] w-[40px] sm:min-w-[48px] sm:max-w-[48px] sm:w-[48px]">{student.listNumber}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-sm font-medium ${
                            getPercentage(student.id) >= 80 ? 'bg-emerald-100 text-emerald-800' : 
                            getPercentage(student.id) >= 60 ? 'bg-amber-100 text-amber-800' : 
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {getPercentage(student.id)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                {/* Row 1: Month Header */}
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th colSpan={2} className="p-2 border-r border-slate-300 bg-slate-200 text-center font-semibold text-slate-700 sticky left-0 z-20">
                    {activeTab} {YEAR}
                  </th>
                  <th colSpan={validDays.length} className="p-2 border-r border-slate-300 text-center font-semibold text-slate-700 tracking-widest uppercase text-xs">
                    Class Days
                  </th>
                </tr>
                {/* Row 2: Day Numbers */}
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2 border-r border-slate-200 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px] text-xs text-slate-500 font-medium sticky left-0 z-20 bg-slate-50">Student Name</th>
                  <th className="p-2 border-r border-slate-200 min-w-[40px] max-w-[40px] w-[40px] sm:min-w-[48px] sm:max-w-[48px] sm:w-[48px] text-center text-xs text-slate-500 font-medium sticky left-[140px] sm:left-[200px] z-20 bg-slate-50">Nº</th>
                  {validDays.map((d, i) => (
                    <th key={i} className={`p-2 border-r border-slate-200 w-12 text-center text-xs text-slate-500 font-medium ${i > 0 && d.date.getDay() === 1 ? 'border-l-2 border-l-slate-400' : ''}`}>
                      {d.day}
                    </th>
                  ))}
                </tr>
                {/* Row 3: Day of Week */}
                <tr className="bg-slate-50 border-b-2 border-slate-300">
                  <th className="p-1 border-r border-slate-200 sticky left-0 z-20 bg-slate-50 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px]"></th>
                  <th className="p-1 border-r border-slate-200 sticky left-[140px] sm:left-[200px] z-20 bg-slate-50 min-w-[40px] max-w-[40px] w-[40px] sm:min-w-[48px] sm:max-w-[48px] sm:w-[48px]"></th>
                  {validDays.map((d, i) => (
                    <th key={i} className={`p-1 border-r border-slate-200 text-center text-[10px] text-slate-400 font-medium ${i > 0 && d.date.getDay() === 1 ? 'border-l-2 border-l-slate-400' : ''}`}>
                      {d.dayOfWeek}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(group => (
                  <React.Fragment key={group}>
                    {groups.length > 1 || group !== 'Ungrouped' ? (
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <td className="p-2 text-sm font-semibold text-slate-700 sticky left-0 z-10 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px] bg-slate-100">
                          Group {group}
                        </td>
                        <td className="p-2 text-sm font-semibold text-slate-700 sticky left-[140px] sm:left-[200px] z-10 min-w-[40px] max-w-[40px] w-[40px] sm:min-w-[48px] sm:max-w-[48px] sm:w-[48px] bg-slate-100"></td>
                        {validDays.map((d, i) => (
                          <td key={i} className={`bg-slate-100 border-r border-slate-200 ${i > 0 && d.date.getDay() === 1 ? 'border-l-2 border-l-slate-400' : ''}`}></td>
                        ))}
                      </tr>
                    ) : null}
                    {groupedStudents[group].map((student, rowIndex) => (
                      <tr key={student.id} className="border-b border-slate-200 hover:bg-indigo-50 transition-colors group">
                        <td className="p-0 border-r border-slate-200 text-sm font-medium text-slate-700 bg-white group-hover:bg-indigo-50 whitespace-nowrap sticky left-0 z-10 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px]">
                          <div className="p-2 flex items-center justify-between h-full">
                            <span className="truncate pr-2 block">{student.name}</span>
                            <button
                              onClick={() => setStudentToDelete(student)}
                              className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                              title="Delete Student"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center text-sm text-slate-500 bg-slate-50 group-hover:bg-indigo-50 sticky left-[140px] sm:left-[200px] z-10 min-w-[40px] max-w-[40px] w-[40px] sm:min-w-[48px] sm:max-w-[48px] sm:w-[48px]">
                          {student.listNumber}
                        </td>
                        {validDays.map((d, dayIndex) => {
                          const day = d.day;
                          const status = attendance[activeTab]?.[day]?.[student.id] || '';
                          
                          return (
                            <td key={day} className={`p-0 border-r border-slate-200 relative ${dayIndex > 0 && d.date.getDay() === 1 ? 'border-l-2 border-l-slate-400' : ''}`}>
                              <select
                                value={status}
                                onChange={(e) => handleAttendanceChange(student.id, day, e.target.value)}
                                className={`w-full h-full min-h-[36px] appearance-none bg-transparent text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 cursor-pointer ${
                                  status === 'P' ? 'text-emerald-600 font-bold' :
                                  status === 'A' ? 'text-rose-600 font-bold' :
                                  status === 'L' ? 'text-amber-600 font-bold' :
                                  status === 'E' ? 'text-blue-600 font-bold' :
                                  'text-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <option value=""></option>
                                <option value="P">P</option>
                                <option value="A">A</option>
                                <option value="L">L</option>
                                <option value="E">E</option>
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {activeTab !== 'Summary' && (
          <div className="mt-4 flex gap-4 text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200 inline-flex">
            <div className="flex items-center gap-1"><span className="font-bold text-emerald-600">P</span> Present</div>
            <div className="flex items-center gap-1"><span className="font-bold text-rose-600">A</span> Absent</div>
            <div className="flex items-center gap-1"><span className="font-bold text-amber-600">L</span> Late</div>
            <div className="flex items-center gap-1"><span className="font-bold text-blue-600">E</span> Excused</div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!studentToDelete}
        title="Delete Student"
        message={`Are you sure you want to delete "${studentToDelete?.name}"? This will permanently remove them from the course and delete all their attendance records. This action cannot be undone.`}
        onConfirm={handleDeleteStudent}
        onCancel={() => setStudentToDelete(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans">
        <Routes>
          <Route path="/" element={<SubjectList />} />
          <Route path="/subjects/:subjectId/courses" element={<CourseList />} />
          <Route path="/courses/:courseId" element={<ExcelGrid />} />
        </Routes>
      </div>
    </Router>
  );
}

