import type { AppSnapshot, AddClothesPayload, ClothesItem } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';

type JsonResponse<T> = Promise<T>;

async function request<T>(path: string, options?: RequestInit): JsonResponse<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(message?.message || response.statusText || 'Request failed');
  }

  return response.json();
}

export function fetchSnapshot(): JsonResponse<AppSnapshot> {
  return request<AppSnapshot>('/state');
}

export function createClothes(payload: AddClothesPayload): JsonResponse<ClothesItem> {
  return request<ClothesItem>('/clothes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateClothes(id: string, payload: AddClothesPayload): JsonResponse<ClothesItem> {
  return request<ClothesItem>(`/clothes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function fetchClothingTypes(): JsonResponse<{ types: string[] }> {
  return request<{ types: string[] }>('/types');
}

export function createClothingType(name: string): JsonResponse<{ types: string[] }> {
  return request<{ types: string[] }>('/types', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateClothingType(oldName: string, newName: string): JsonResponse<{ types: string[] }> {
  return request<{ types: string[] }>(`/types/${encodeURIComponent(oldName)}`, {
    method: 'PUT',
    body: JSON.stringify({ name: newName }),
  });
}

export function deleteClothingType(name: string): JsonResponse<{ types: string[] }> {
  return request<{ types: string[] }>(`/types/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export function fetchMaterialTypes(): JsonResponse<{ materials: string[] }> {
  return request<{ materials: string[] }>('/materials');
}

export function createMaterialType(name: string): JsonResponse<{ materials: string[] }> {
  return request<{ materials: string[] }>('/materials', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateMaterialType(oldName: string, newName: string): JsonResponse<{ materials: string[] }> {
  return request<{ materials: string[] }>(`/materials/${encodeURIComponent(oldName)}`, {
    method: 'PUT',
    body: JSON.stringify({ name: newName }),
  });
}

export function deleteMaterialType(name: string): JsonResponse<{ materials: string[] }> {
  return request<{ materials: string[] }>(`/materials/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export function recordWear(clothesIds: string[]): JsonResponse<Pick<AppSnapshot, 'clothes' | 'wearRecords'>> {
  return request('/wears', {
    method: 'POST',
    body: JSON.stringify({ clothesIds }),
  });
}

export function undoWear(clothesId: string, date?: string): JsonResponse<Pick<AppSnapshot, 'clothes' | 'wearRecords'>> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request(`/wears/${clothesId}${query}`, {
    method: 'DELETE',
  });
}

export function recordWash(clothesIds: string[]): JsonResponse<Pick<AppSnapshot, 'clothes' | 'washRecords'>> {
  return request('/washes', {
    method: 'POST',
    body: JSON.stringify({ clothesIds }),
  });
}

export function purgeDatabase(): JsonResponse<Pick<AppSnapshot, 'clothes' | 'wearRecords' | 'washRecords'>> {
  return request('/purge', {
    method: 'POST',
  });
}
