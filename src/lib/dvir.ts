// src/lib/dvir.ts
// Client-side DVIR Photo Retention & Alerting helpers

const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface DvirUploadParams {
  file: File;
  truckId: string;
  companyId: string;
  driverId?: string;
  inspectionPoint?: string;
  status?: 'ok' | 'defective';
  notes?: string;
}

interface DvirPhoto {
  id: string;
  company_id: string;
  truck_id: string;
  driver_id: string | null;
  inspection_point: string | null;
  status: string;
  notes: string | null;
  storage_path: string;
  url: string;
  is_protected: boolean;
  captured_at: string;
  delete_at: string;
}

interface DefectAlertParams {
  photoId?: string;
  companyId: string;
  truckId: string;
  driverName?: string;
  inspectionPoint?: string;
  notes?: string;
  photoUrl?: string;
}

export async function uploadDvirPhoto(params: DvirUploadParams): Promise<DvirPhoto> {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('truck_id', params.truckId);
  formData.append('company_id', params.companyId);
  if (params.driverId) formData.append('driver_id', params.driverId);
  if (params.inspectionPoint) formData.append('inspection_point', params.inspectionPoint);
  if (params.status) formData.append('status', params.status);
  if (params.notes) formData.append('notes', params.notes);

  const endpoint = SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/dvir-upload`
    : `${API_URL}/api/dvir/upload`;

  const headers: Record<string, string> = {};
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY;
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(endpoint, { method: 'POST', headers, body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.photo;
}

export async function sendDefectAlert(params: DefectAlertParams): Promise<{ message: string }> {
  const endpoint = SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/dvir-defect-alert`
    : `${API_URL}/api/dvir/defect-alert`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY;
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      photo_id: params.photoId,
      company_id: params.companyId,
      truck_id: params.truckId,
      driver_name: params.driverName,
      inspection_point: params.inspectionPoint,
      notes: params.notes,
      photo_url: params.photoUrl,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Defect alert failed');
  return data;
}

export async function triggerAutoDelete(): Promise<{ deleted: number; errors: number }> {
  const endpoint = SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/dvir-auto-delete`
    : `${API_URL}/api/dvir/auto-delete`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY;
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(endpoint, { method: 'POST', headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Auto-delete failed');
  return data;
}
