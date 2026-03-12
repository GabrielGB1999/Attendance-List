import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, ChevronRight, ArrowLeft, Save, Plus, Trash2, Download, Upload } from 'lucide-react';

// Types
type Subject = { id: number; name: string };
type Course = { id: number; subject_id: number; name: string; schedule?: number[] };
type Student = { id: number; listNumber: number; name: string; group?: string };
type AttendanceRecord = Record<string, Record<string, string>>; // Month -> Day -> StudentId -> Status

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lun', fullName: 'Lunes' },
  { id: 2, name: 'Mar', fullName: 'Martes' },
  { id: 3, name: 'Mie', fullName: 'Miercoles' },
  { id: 4, name: 'Jue', fullName: 'Jueves' },
  { id: 5, name: 'Vie', fullName: 'Viernes' },
  { id: 6, name: 'Sab', fullName: 'Sabado' },
  { id: 0, name: 'Dom', fullName: 'Domingo' },
];

// Components
function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  requirePassword = true
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: (password?: string) => void; 
  onCancel: () => void;
  requirePassword?: boolean;
}) {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-xl font-bold text-rose-600 mb-2">{title}</h2>
        <p className="text-slate-600 mb-4">{message}</p>
        
        {requirePassword && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña de Administrador</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ingrese contraseña para confirmar"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={() => { setPassword(''); onCancel(); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
          <button 
            onClick={() => { onConfirm(password); setPassword(''); }} 
            disabled={requirePassword && !password}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            Eliminar
          </button>
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

  const handleDeleteSubject = async (password?: string) => {
    if (!subjectToDelete) return;
    const res = await fetch(`/api/subjects/${subjectToDelete.id}`, { 
      method: 'DELETE',
      headers: { 'x-admin-password': password || '' }
    });
    
    if (res.status === 403) {
      alert('Contraseña incorrecta');
      return;
    }

    setSubjectToDelete(null);
    fetchSubjects();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-indigo-600" />
          Materias
        </h1>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <a
            href="/api/backup"
            download
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Respaldo
          </a>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Añadir Materia
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddSubject} className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="Nombre de la Materia (ej: Matemática)"
            className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors w-full sm:w-auto">
            Guardar
          </button>
        </form>
      )}

      {subjects.length === 0 && !isAdding && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
          <p className="text-slate-500 mb-4">No hay materias, cree una para empezar</p>
          <button 
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Añadir Materia
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
        title="Eliminar Materia"
        message={`Estás Seguro que queres elimiar "${subjectToDelete?.name}"? Esto va a eliminar todos sus datos de asistencia. ESTA ACCIÓN NO SE PUEDE DESHACER`}
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

  const handleDeleteCourse = async (password?: string) => {
    if (!courseToDelete) return;
    const res = await fetch(`/api/courses/${courseToDelete.id}`, { 
      method: 'DELETE',
      headers: { 'x-admin-password': password || '' }
    });

    if (res.status === 403) {
      alert('Contraseña incorrecta');
      return;
    }

    setCourseToDelete(null);
    fetchCourses();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <button 
        onClick={() => navigate('/')}
        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a Materias
      </button>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Cursos</h1>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="w-full sm:w-auto flex justify-center items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> añadir Curso
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddCourse} className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
          <input
            type="text"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            placeholder="Nombre del Curso (ej: Álgebra I)"
            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Días de clase</label>
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
              Guardar Curso
            </button>
          </div>
        </form>
      )}

      {courses.length === 0 && !isAdding && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
          <p className="text-slate-500 mb-4">No hay cursos para esta materia, cree uno</p>
          <button 
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />Añadir Curso
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
        title="Eliminar Curso"
        message={`¿Estás seguro que quieres eliminar "${courseToDelete?.name}"? Esto eliminará permanentemente todos los estudiantes y registros de asistencia de este curso. ESTA ACCIÓN NO SE PUEDE DESHACER.`}
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
  const [activeTab, setActiveTab] = useState('Marzo');
  const [saving, setSaving] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGroup, setNewStudentGroup] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const months = ['Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Novembiembre', 'Diciembre', 'Porcentaje'];
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
    try {
      await fetch(`/api/courses/${courseId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance })
      });
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
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

  const handleDeleteStudent = async (password?: string) => {
    if (!studentToDelete) return;
    
    // Update list numbers for remaining students
    const updatedStudents = students
      .filter(s => s.id !== studentToDelete.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s, index) => ({ ...s, listNumber: index + 1 }));
      
    const res = await fetch(`/api/courses/${courseId}/students`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-password': password || ''
      },
      body: JSON.stringify({ students: updatedStudents })
    });

    if (res.status === 403) {
      alert('Contraseña incorrecta');
      return;
    }

    setStudents(updatedStudents);
    setStudentToDelete(null);
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
          if (status === 'P') presentDays++;
          else if (status === 'T') presentDays += 0.75;
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
            onClick={() => navigate(`/subjects/${course.subject_id}/courses`)}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-slate-800">{course.name} - Presentismo</h1>
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
            <span className="hidden sm:inline">Importar CSV</span>
            <span className="sm:hidden">Importar</span>
          </button>
          <button
            onClick={() => setIsAddingStudent(!isAddingStudent)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">añadir alumno</span>
            <span className="sm:hidden">añadir</span>
          </button>
          <button
            onClick={saveChanges}
            disabled={saving}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            <span className="sm:hidden">{saving ? '...' : 'Guardar'}</span>
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
              placeholder="Nombre del Estudiante"
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <input
              type="text"
              value={newStudentGroup}
              onChange={(e) => setNewStudentGroup(e.target.value)}
              placeholder="Grupo"
              className="w-full sm:w-64 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors w-full sm:w-auto">
              Añadir
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
          {activeTab === 'Porcentaje' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3 font-semibold text-slate-700 border-r border-slate-200 sticky left-0 z-20 bg-slate-50 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px]">Nombre del Alumno</th>
                  <th className="p-3 font-semibold text-slate-700 border-r border-slate-200 text-center sticky left-[140px] sm:left-[200px] z-20 bg-slate-50 min-w-[40px] max-w-[40px] w-[40px] sm:min-w-[48px] sm:max-w-[48px] sm:w-[48px]">Nº</th>
                  <th className="p-3 font-semibold text-slate-700 text-center">% de Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => (
                  <React.Fragment key={group}>
                    {groups.length > 1 || group !== 'Ungrouped' ? (
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <td className="p-2 text-sm font-semibold text-slate-700 sticky left-0 z-10 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px] bg-slate-100">
                          Grupo {group}
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
                    Días de clase
                  </th>
                </tr>
                {/* Row 2: Day Numbers */}
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2 border-r border-slate-200 min-w-[140px] max-w-[140px] w-[140px] sm:min-w-[200px] sm:max-w-[200px] sm:w-[200px] text-xs text-slate-500 font-medium sticky left-0 z-20 bg-slate-50">Nombre del ALumno</th>
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
                          Grupo {group}
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
                              title="Borrar Alumno"
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
                                  status === 'T' ? 'text-amber-600 font-bold' :
                                  status === 'A/P' ? 'text-blue-600 font-bold' :
                                  'text-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <option value=""></option>
                                <option value="P">P</option>
                                <option value="A">A</option>
                                <option value="T">T</option>
                                <option value="A/P">A/P</option>
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
        
        {activeTab !== 'Porcentaje' && (
          <div className="mt-4 flex gap-4 text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200 inline-flex">
            <div className="flex items-center gap-1"><span className="font-bold text-emerald-600">P</span> Presente</div>
            <div className="flex items-center gap-1"><span className="font-bold text-rose-600">A</span> Ausente</div>
            <div className="flex items-center gap-1"><span className="font-bold text-amber-600">T</span> Tarde</div>
            <div className="flex items-center gap-1"><span className="font-bold text-blue-600">A/P</span> Ausente con presencia</div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!studentToDelete}
        title="Eliminar Estudiante"
        message={`¿Estás seguro que quieres eliminar a "${studentToDelete?.name}"? Esto lo eliminará permanentemente del curso y borrará todos sus registros de asistencia. ESTA ACCIÓN NO SE PUEDE DESHACER.`}
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

