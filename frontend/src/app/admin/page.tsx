'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Layers,
  Upload, Plus, Trash2, Power, RefreshCw, CheckCircle,
  AlertCircle, X, ChevronDown, Search, Shield, LogOut
} from 'lucide-react';
import canvasConfetti from 'canvas-confetti';
import { adminApi } from '../../utils/api';

// ── Types ──────────────────────────────────────────────────────────
type Tab = 'overview' | 'students' | 'teachers' | 'branches' | 'subjects' | 'upload';

interface Stat { label: string; value: number | string; icon: React.ReactNode; color: string; }
interface Toast { id: number; type: 'success' | 'error'; message: string; }

// ── Reusable Components ────────────────────────────────────────────

// ── Subcomponents ──────────────────────────────────────────────────

function AddYearInline({ branchId, onAdd, toast }: { branchId: string; onAdd: () => void; toast: any }) {
  const [show, setShow] = useState(false);
  const [yearNumber, setYearNumber] = useState('1');
  const [label, setLabel] = useState('1st Year');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createYear(branchId, Number(yearNumber), label);
      toast('success', `Year "${label}" created successfully!`);
      setShow(false);
      setYearNumber('1');
      setLabel('1st Year');
      onAdd();
    } catch (err: any) {
      toast('error', err.message || 'Failed to create year');
    }
  };

  const handleYearNumberChange = (numStr: string) => {
    setYearNumber(numStr);
    const num = Number(numStr);
    if (num === 1) setLabel('1st Year');
    else if (num === 2) setLabel('2nd Year');
    else if (num === 3) setLabel('3rd Year');
    else if (num === 4) setLabel('4th Year');
    else setLabel(`${num}th Year`);
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-[10px] flex items-center gap-1 bg-indigo-600/10 border border-indigo-500/20 hover:border-indigo-500/60 text-indigo-400 px-2 py-1 rounded-lg transition-all cursor-pointer font-bold"
      >
        <Plus className="w-3 h-3" /> Add Year
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 p-1.5 rounded-lg">
      <select
        value={yearNumber}
        onChange={(e) => handleYearNumberChange(e.target.value)}
        className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500"
      >
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
      </select>
      <input
        type="text"
        required
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded px-2 py-0.5 w-20 focus:outline-none focus:border-indigo-500"
        placeholder="1st Year"
      />
      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer">
        Save
      </button>
      <button type="button" onClick={() => setShow(false)} className="text-slate-500 hover:text-slate-300 text-[9px] font-bold px-1 py-0.5 rounded cursor-pointer">
        Cancel
      </button>
    </form>
  );
}

function StatCard({ label, value, icon, color }: Stat) {
  return (
    <div className={`bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 flex items-center gap-5 hover:border-${color}/40 transition-all`}>
      <div className={`w-12 h-12 bg-${color}/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-slate-100">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Badge({ active }: { active: boolean }) {
  return active ? (
    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full">Active</span>
  ) : (
    <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-full">Disabled</span>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <input
        className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm text-slate-100 transition-colors"
        {...props}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Data state
  const [stats, setStats] = useState<Record<string, number>>({});
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  // Form state
  const [search, setSearch] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  // Forms
  const [branchForm, setBranchForm] = useState({ name: '', code: '', description: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', credits: '3', yearId: '' });
  const [studentForm, setStudentForm] = useState({ fullName: '', email: '', rollNumber: '', yearId: '' });
  const [teacherForm, setTeacherForm] = useState({ fullName: '', email: '', employeeId: '', department: '' });

  // Toast helpers
  const toast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  // ── Data fetchers ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, b, y, sub, st] = await Promise.all([
        adminApi.getStats(),
        adminApi.getTeachers(),
        adminApi.getBranches(),
        adminApi.getYears(),
        adminApi.getSubjects(),
        adminApi.getStudents(),
      ]);
      setStats(s); setTeachers(t); setBranches(b);
      setYears(y); setSubjects(sub); setStudents(st);
    } catch (e: any) {
      toast('error', e.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // ── Action handlers ──────────────────────────────────────────────
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createBranch(branchForm);
      toast('success', `Branch "${branchForm.name}" created!`);
      setBranchForm({ name: '', code: '', description: '' });
      load();
    } catch (e: any) { toast('error', e.message); }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createSubject({ ...subjectForm, credits: Number(subjectForm.credits) });
      toast('success', `Subject "${subjectForm.name}" created!`);
      setSubjectForm({ name: '', code: '', credits: '3', yearId: '' });
      load();
    } catch (e: any) { toast('error', e.message); }
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.registerStudent(studentForm);
      toast('success', `Student "${studentForm.fullName}" registered!`);
      setStudentForm({ fullName: '', email: '', rollNumber: '', yearId: '' });
      load();
    } catch (e: any) { toast('error', e.message); }
  };

  const handleRegisterTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.registerTeacher(teacherForm);
      toast('success', `Teacher "${teacherForm.fullName}" registered!`);
      setTeacherForm({ fullName: '', email: '', employeeId: '', department: '' });
      load();
    } catch (e: any) { toast('error', e.message); }
  };

  const handleBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setUploadStatus('loading');
    try {
      const result = await adminApi.batchUpload(csvFile);
      setUploadResult(result);
      setUploadStatus('done');
      if (result.successCount > 0) {
        canvasConfetti({ particleCount: 120, spread: 70 });
        toast('success', `${result.successCount} students registered successfully!`);
        load();
      }
    } catch (e: any) {
      toast('error', e.message);
      setUploadStatus('idle');
    }
  };

  // ── Filter helpers ───────────────────────────────────────────────
  const filteredStudents = students.filter(s =>
    s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTeachers = teachers.filter(t =>
    t.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Nav tabs ─────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',  label: 'Overview',   icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'students',  label: 'Students',   icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'teachers',  label: 'Teachers',   icon: <Users className="w-4 h-4" /> },
    { id: 'branches',  label: 'Branches',   icon: <Layers className="w-4 h-4" /> },
    { id: 'subjects',  label: 'Subjects',   icon: <BookOpen className="w-4 h-4" /> },
    { id: 'upload',    label: 'Bulk Upload', icon: <Upload className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* BG gradients */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── Toast Notifications ── */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold animate-slide-in
              ${t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/90 border-rose-500/40 text-rose-300'}`}>
            {t.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900/60 backdrop-blur-xl border-r border-slate-800/80 flex flex-col z-30">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-sm text-slate-100">Admin Console</h1>
              <p className="text-[10px] text-slate-500">Smart Attendance System</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer
                ${activeTab === tab.id
                  ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'students' && students.length > 0 && (
                <span className="ml-auto text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full">
                  {students.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Refresh */}
        <div className="p-4 border-t border-slate-800/60">
          <button
            onClick={load}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800/60 mt-auto">
          <button
            onClick={() => {
              localStorage.removeItem('jwt_token');
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/20 hover:border-rose-500/50 rounded-xl text-sm font-semibold text-rose-300 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="ml-64 p-8 min-h-screen">

        {/* Header */}
        <header className="mb-8">
          <h2 className="text-2xl font-black text-slate-100 capitalize">
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {activeTab === 'overview'  && 'System-wide statistics and health overview'}
            {activeTab === 'students'  && 'Manage student accounts and enrollments'}
            {activeTab === 'teachers'  && 'Manage teacher accounts and subject assignments'}
            {activeTab === 'branches'  && 'Create and manage academic branches'}
            {activeTab === 'subjects'  && 'Create and manage course subjects'}
            {activeTab === 'upload'    && 'Bulk register students via CSV file upload'}
          </p>
        </header>

        {/* ─────────────── OVERVIEW ─────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              <StatCard label="Total Students" value={stats.totalStudents ?? 0}
                icon={<GraduationCap className="w-6 h-6 text-cyan-400" />} color="cyan" />
              <StatCard label="Total Teachers" value={stats.totalTeachers ?? 0}
                icon={<Users className="w-6 h-6 text-indigo-400" />} color="indigo" />
              <StatCard label="Branches" value={stats.totalBranches ?? 0}
                icon={<Layers className="w-6 h-6 text-violet-400" />} color="violet" />
              <StatCard label="Subjects" value={stats.totalSubjects ?? 0}
                icon={<BookOpen className="w-6 h-6 text-amber-400" />} color="amber" />
              <StatCard label="Pending Face Enrollment" value={stats.pendingFaceEnrollment ?? 0}
                icon={<AlertCircle className="w-6 h-6 text-rose-400" />} color="rose" />
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setActiveTab('upload')}
                className="p-6 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl hover:border-violet-500/60 transition-all text-left group cursor-pointer">
                <Upload className="w-8 h-8 text-violet-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="font-bold text-slate-200">Bulk CSV Upload</h3>
                <p className="text-xs text-slate-500 mt-1">Register many students at once</p>
              </button>
              <button onClick={() => setActiveTab('branches')}
                className="p-6 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl hover:border-cyan-500/60 transition-all text-left group cursor-pointer">
                <Layers className="w-8 h-8 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="font-bold text-slate-200">Setup Branches</h3>
                <p className="text-xs text-slate-500 mt-1">Configure academic departments</p>
              </button>
            </div>
          </div>
        )}

        {/* ─────────────── STUDENTS ─────────────── */}
        {activeTab === 'students' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Register form */}
            <div className="col-span-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="font-bold text-slate-200 mb-5 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Register Student
              </h3>
              <form onSubmit={handleRegisterStudent} className="space-y-4">
                <Input label="Full Name" required value={studentForm.fullName}
                  onChange={e => setStudentForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Jane Doe" />
                <Input label="College Email" type="email" required value={studentForm.email}
                  onChange={e => setStudentForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@college.edu" />
                <Input label="Roll Number" required value={studentForm.rollNumber}
                  onChange={e => setStudentForm(f => ({ ...f, rollNumber: e.target.value }))}
                  placeholder="CSE2024001" />
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Year</label>
                  <select required value={studentForm.yearId}
                    onChange={e => setStudentForm(f => ({ ...f, yearId: e.target.value }))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm text-slate-100">
                    <option value="">Select year…</option>
                    {years.map((y: any) => (
                      <option key={y.id} value={y.id}>{y.branch?.name} — {y.label}</option>
                    ))}
                  </select>
                </div>
                <button type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl transition-all cursor-pointer text-sm">
                  Register Student
                </button>
              </form>
            </div>

            {/* Student table */}
            <div className="col-span-8 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search students…"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-100" />
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">{filteredStudents.length} students</span>
              </div>

              <div className="overflow-auto max-h-[520px] space-y-2 pr-1">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-16 text-slate-600">
                    <GraduationCap className="w-10 h-10 mx-auto mb-3" />
                    <p className="text-sm">No students found</p>
                  </div>
                ) : filteredStudents.map((s: any) => (
                  <div key={s.id}
                    className="flex items-center gap-4 p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl hover:border-indigo-500/30 transition-all">
                    <div className="w-9 h-9 bg-indigo-600/20 rounded-full flex items-center justify-center text-sm font-black text-indigo-400 flex-shrink-0">
                      {s.fullName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-200 text-sm truncate">{s.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">{s.email} · {s.rollNumber}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                        ${s.faceEnrolled
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                        {s.faceEnrolled ? 'Face OK' : 'No Face'}
                      </span>
                      <Badge active={s.isEnabled} />
                      <button onClick={() => adminApi.toggleStudent(s.id, !s.isEnabled).then(load)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-all cursor-pointer" title="Toggle">
                        <Power className="w-4 h-4 text-slate-400" />
                      </button>
                      <button onClick={() => adminApi.deleteStudent(s.id).then(load)}
                        className="p-1.5 hover:bg-rose-900/40 rounded-lg transition-all cursor-pointer" title="Delete">
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────── TEACHERS ─────────────── */}
        {activeTab === 'teachers' && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="font-bold text-slate-200 mb-5 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Register Teacher
              </h3>
              <form onSubmit={handleRegisterTeacher} className="space-y-4">
                <Input label="Full Name" required value={teacherForm.fullName}
                  onChange={e => setTeacherForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Prof. John Smith" />
                <Input label="College Email" type="email" required value={teacherForm.email}
                  onChange={e => setTeacherForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="john@college.edu" />
                <Input label="Employee ID" required value={teacherForm.employeeId}
                  onChange={e => setTeacherForm(f => ({ ...f, employeeId: e.target.value }))}
                  placeholder="EMP1042" />
                <Input label="Department" value={teacherForm.department}
                  onChange={e => setTeacherForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="CS Department" />
                <button type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl transition-all cursor-pointer text-sm">
                  Register Teacher
                </button>
              </form>
            </div>

            <div className="col-span-8 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search teachers…"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-100" />
                </div>
              </div>
              <div className="overflow-auto max-h-[520px] space-y-2 pr-1">
                {filteredTeachers.length === 0 ? (
                  <div className="text-center py-16 text-slate-600">
                    <Users className="w-10 h-10 mx-auto mb-3" />
                    <p className="text-sm">No teachers found</p>
                  </div>
                ) : filteredTeachers.map((t: any) => (
                  <div key={t.id}
                    className="flex items-center gap-4 p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl hover:border-indigo-500/30 transition-all">
                    <div className="w-9 h-9 bg-violet-600/20 rounded-full flex items-center justify-center text-sm font-black text-violet-400 flex-shrink-0">
                      {t.fullName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-200 text-sm truncate">{t.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">{t.email} · {t.employeeId}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge active={t.isEnabled} />
                      <button onClick={() => adminApi.toggleTeacher(t.id, !t.isEnabled).then(load)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-all cursor-pointer">
                        <Power className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────── BRANCHES ─────────────── */}
        {activeTab === 'branches' && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="font-bold text-slate-200 mb-5 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> New Branch
              </h3>
              <form onSubmit={handleCreateBranch} className="space-y-4">
                <Input label="Branch Name" required value={branchForm.name}
                  onChange={e => setBranchForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Computer Science Engineering" />
                <Input label="Code" required value={branchForm.code}
                  onChange={e => setBranchForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="CSE" />
                <Input label="Description (optional)" value={branchForm.description}
                  onChange={e => setBranchForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="4-year UG program…" />
                <button type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl transition-all cursor-pointer text-sm">
                  Create Branch
                </button>
              </form>
            </div>

            <div className="col-span-8 space-y-4">
              {branches.map((b: any) => (
                <div key={b.id}
                  className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-slate-200">{b.name}</h4>
                      <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold mt-1 inline-block">
                        {b.code}
                      </span>
                    </div>
                    <button onClick={() => adminApi.deleteBranch(b.id).then(load)}
                      className="p-1.5 hover:bg-rose-900/40 rounded-lg transition-all cursor-pointer">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3 items-center">
                    {b.years?.map((y: any) => (
                      <span key={y.id}
                        className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-1 rounded-lg">
                        {y.label}
                      </span>
                    ))}
                    <AddYearInline branchId={b.id} onAdd={load} toast={toast} />
                  </div>
                </div>
              ))}
              {branches.length === 0 && (
                <div className="text-center py-16 text-slate-600 bg-slate-900/30 rounded-2xl border border-slate-800/60">
                  <Layers className="w-10 h-10 mx-auto mb-3" />
                  <p className="text-sm">No branches yet. Create one to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────── SUBJECTS ─────────────── */}
        {activeTab === 'subjects' && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="font-bold text-slate-200 mb-5 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> New Subject
              </h3>
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <Input label="Subject Name" required value={subjectForm.name}
                  onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Data Structures & Algorithms" />
                <Input label="Course Code" required value={subjectForm.code}
                  onChange={e => setSubjectForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="CS-301" />
                <Input label="Credits" type="number" min={1} max={6} value={subjectForm.credits}
                  onChange={e => setSubjectForm(f => ({ ...f, credits: e.target.value }))} />
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Year</label>
                  <select required value={subjectForm.yearId}
                    onChange={e => setSubjectForm(f => ({ ...f, yearId: e.target.value }))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm text-slate-100">
                    <option value="">Select year…</option>
                    {years.map((y: any) => (
                      <option key={y.id} value={y.id}>{y.branch?.name} — {y.label}</option>
                    ))}
                  </select>
                </div>
                <button type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl transition-all cursor-pointer text-sm">
                  Create Subject
                </button>
              </form>
            </div>

            <div className="col-span-8 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
              <div className="grid grid-cols-1 gap-3 overflow-auto max-h-[600px]">
                {subjects.length === 0 ? (
                  <div className="text-center py-16 text-slate-600">
                    <BookOpen className="w-10 h-10 mx-auto mb-3" />
                    <p className="text-sm">No subjects found</p>
                  </div>
                ) : subjects.map((s: any) => (
                  <div key={s.id}
                    className="flex items-center gap-4 p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl hover:border-indigo-500/30 transition-all">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-200 text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.code} · {s.credits} credits</p>
                    </div>
                    <button onClick={() => adminApi.deleteSubject(s.id).then(load)}
                      className="p-1.5 hover:bg-rose-900/40 rounded-lg transition-all cursor-pointer flex-shrink-0">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────── BULK UPLOAD ─────────────── */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* CSV spec */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" /> CSV File Format
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Your CSV file must have a header row with exactly these column names:
              </p>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 font-mono text-xs text-indigo-300">
                Name,Email,RollNumber,YearId<br />
                Jane Doe,jane@college.edu,CSE2024001,&lt;uuid-of-year&gt;<br />
                John Smith,john@college.edu,CSE2024002,&lt;uuid-of-year&gt;
              </div>
              <p className="text-slate-500 text-xs mt-3">
                💡 Get YearId values from the <strong>Branches</strong> tab or call{' '}
                <code className="text-indigo-400">GET /api/admin/years</code>
              </p>
            </div>

            {/* Upload form */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8">
              <form onSubmit={handleBatchUpload} className="space-y-6">
                <label className="block border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl p-10 text-center cursor-pointer transition-all relative">
                  <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={e => { setCsvFile(e.target.files?.[0] ?? null); setUploadStatus('idle'); setUploadResult(null); }} />
                  <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${csvFile ? 'text-indigo-400' : 'text-slate-600'}`} />
                  {csvFile ? (
                    <div>
                      <p className="font-bold text-indigo-300">{csvFile.name}</p>
                      <p className="text-slate-500 text-sm mt-1">{(csvFile.size / 1024).toFixed(1)} KB — ready to upload</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-slate-300">Click or drag your CSV file here</p>
                      <p className="text-slate-600 text-sm mt-1">Maximum file size: 10MB</p>
                    </div>
                  )}
                </label>

                <button type="submit" disabled={!csvFile || uploadStatus === 'loading'}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                  {uploadStatus === 'loading'
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                    : <><Upload className="w-4 h-4" /> Upload & Register Students</>}
                </button>
              </form>

              {/* Upload results */}
              {uploadResult && (
                <div className="mt-6 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Processed', value: uploadResult.totalProcessed, color: 'slate' },
                      { label: 'Registered', value: uploadResult.successCount, color: 'emerald' },
                      { label: 'Failed', value: uploadResult.failureCount, color: 'rose' },
                    ].map(stat => (
                      <div key={stat.label} className={`bg-${stat.color}-500/10 border border-${stat.color}-500/20 rounded-xl p-4 text-center`}>
                        <p className={`text-2xl font-black text-${stat.color}-400`}>{stat.value}</p>
                        <p className={`text-xs text-${stat.color}-500 mt-0.5`}>{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {uploadResult.errors?.length > 0 && (
                    <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-4">
                      <p className="text-rose-400 font-bold text-sm mb-2">Errors:</p>
                      <ul className="space-y-1">
                        {uploadResult.errors.map((err: string, i: number) => (
                          <li key={i} className="text-rose-400/70 text-xs">{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
