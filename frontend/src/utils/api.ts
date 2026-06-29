// Centralised API client — reads JWT from localStorage and attaches it to every request.
// Base URL points to Spring Boot backend.

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('jwt_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('token');
        // Redirect to local login page
        window.location.href = '/login';
        // Return a promise that never resolves to avoid page rendering crashes during redirect
        return new Promise(() => {});
      }
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Admin API calls ──────────────────────────────────────────────

export const adminApi = {
  // Stats
  getStats: () => request<Record<string, number>>('/admin/dashboard/stats'),

  // Branches
  getBranches: () => request<any[]>('/admin/branches'),
  createBranch: (body: { name: string; code: string; description?: string }) =>
    request('/admin/branches', { method: 'POST', body: JSON.stringify(body) }),
  deleteBranch: (id: string) =>
    request(`/admin/branches/${id}`, { method: 'DELETE' }),

  // Years
  getYears: () => request<any[]>('/admin/years'),
  getYearsByBranch: (branchId: string) =>
    request<any[]>(`/admin/years/branch/${branchId}`),
  createYear: (branchId: string, yearNumber: number, label: string) =>
    request(`/admin/years?branchId=${branchId}&yearNumber=${yearNumber}&label=${encodeURIComponent(label)}`,
      { method: 'POST' }),

  // Subjects
  getSubjects: () => request<any[]>('/admin/subjects'),
  createSubject: (body: { name: string; code: string; credits: number; yearId: string }) =>
    request('/admin/subjects', { method: 'POST', body: JSON.stringify(body) }),
  deleteSubject: (id: string) =>
    request(`/admin/subjects/${id}`, { method: 'DELETE' }),

  // Students
  getStudents: () => request<any[]>('/admin/students'),
  registerStudent: (body: any) =>
    request('/admin/students', { method: 'POST', body: JSON.stringify(body) }),
  toggleStudent: (id: string, enabled: boolean) =>
    request(`/admin/students/${id}/toggle?enabled=${enabled}`, { method: 'PATCH' }),
  deleteStudent: (id: string) =>
    request(`/admin/students/${id}`, { method: 'DELETE' }),

  // Batch CSV upload (multipart)
  batchUpload: (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE}/admin/students/batch-upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json());
  },

  // Teachers
  getTeachers: () => request<any[]>('/admin/teachers'),
  registerTeacher: (body: any) =>
    request('/admin/teachers', { method: 'POST', body: JSON.stringify(body) }),
  toggleTeacher: (id: string, enabled: boolean) =>
    request(`/admin/teachers/${id}/toggle?enabled=${enabled}`, { method: 'PATCH' }),
};

// ── Teacher Portal API calls ─────────────────────────────────────

export const teacherApi = {
  // Sessions
  getSessions: () => request<any[]>('/teacher/sessions'),
  createSession: (body: {
    title: string;
    room: string;
    subjectId: string;
    yearId: string;
    scheduledAt: string;
  }) => request('/teacher/sessions', { method: 'POST', body: JSON.stringify(body) }),
  startSession:  (id: string) =>
    request<{ status: string; token: string; tokenTtl: number; sessionId: string }>(
      `/teacher/sessions/${id}/start`, { method: 'POST' }),
  endSession:    (id: string) =>
    request<{ status: string; absentCount: number }>(
      `/teacher/sessions/${id}/end`, { method: 'POST' }),

  // QR token (HTTP fallback)
  getQrToken:    (id: string) =>
    request<{ token: string; sessionId: string; ttl: number }>(
      `/teacher/sessions/${id}/qr`),

  // Live attendance feed
  getFeed:       (id: string) => request<any[]>(`/teacher/sessions/${id}/feed`),

  // Subjects for session creation dropdowns
  getSubjects:   () => request<any[]>('/admin/subjects'),   // Teacher can read subjects
  getYears:      () => request<any[]>('/admin/years'),
};

// ── Student Portal API calls ─────────────────────────────────────

export const studentApi = {
  /** Submit attendance (QR + liveness + face frame). */
  submitAttendance: (body: {
    sessionId: string;
    qrToken: string;
    imageFrame: string;      // base64 jpeg
    livenessPassed: boolean;
    deviceInfo?: string;
  }) => request<{ status: string; message: string; similarity?: string; markedAt?: string }>(
    '/student/attendance/submit',
    { method: 'POST', body: JSON.stringify(body) }
  ),

  /** Get the logged-in student's own profile. */
  getProfile: () => request<any>('/student/profile'),

  /** Get full attendance history for the student. */
  getHistory: () => request<any[]>('/student/attendance/history'),

  /** Student self-enrolls their own face. */
  selfEnrollFace: (imageB64: string) =>
    request<{ status: string; message: string; enrolledAt?: string }>(
      '/student/enroll-face',
      { method: 'POST', body: JSON.stringify({ imageB64 }) }
    ),
};

// ── Face Enrollment API ──────────────────────────────────────────
export const enrollmentApi = {
  /** Admin enrolls a specific student's face by UUID. */
  adminEnroll: (studentId: string, imageB64: string) =>
    request<{ status: string; message: string; enrolledAt?: string }>(
      `/admin/students/${studentId}/enroll-face`,
      { method: 'POST', body: JSON.stringify({ imageB64 }) }
    ),

  /** Admin resets a student's enrollment (clears embedding). */
  resetEnrollment: (studentId: string) =>
    request<{ status: string; message: string }>(
      `/admin/students/${studentId}/enroll-face`,
      { method: 'DELETE' }
    ),
};

// ── Utility ──────────────────────────────────────────────────────
export function getApiBase(): string {
  return API_BASE;
}

export { getToken };
