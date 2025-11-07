import type { AppSnapshot, AddClothesPayload, ClothesItem, ClothingType } from '../types';

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

export function fetchClothingTypes(): JsonResponse<{ types: ClothingType[] }> {
  return request<{ types: ClothingType[] }>('/types');
}

export function createClothingType(name: string, icon?: string | null): JsonResponse<{ types: ClothingType[] }> {
  return request<{ types: ClothingType[] }>('/types', {
    method: 'POST',
    body: JSON.stringify({ name, icon }),
  });
}

export function updateClothingType(oldName: string, newName: string, icon?: string | null): JsonResponse<{ types: ClothingType[] }> {
  return request<{ types: ClothingType[] }>(`/types/${encodeURIComponent(oldName)}`, {
    method: 'PUT',
    body: JSON.stringify({ name: newName, icon }),
  });
}

export function deleteClothingType(name: string): JsonResponse<{ types: ClothingType[] }> {
  return request<{ types: ClothingType[] }>(`/types/${encodeURIComponent(name)}`, {
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

export function recordWear(clothesIds: string[], date?: string, oldWearThreshold?: number): JsonResponse<Pick<AppSnapshot, 'clothes' | 'wearRecords'>> {
  const params = new URLSearchParams();
  if (oldWearThreshold !== undefined) {
    params.append('oldWearThreshold', oldWearThreshold.toString());
  }
  const queryString = params.toString();
  const url = `/wears${queryString ? `?${queryString}` : ''}`;
  
  return request(url, {
    method: 'POST',
    body: JSON.stringify({ clothesIds, date }),
  });
}

export function undoWear(clothesId: string, date?: string): JsonResponse<Pick<AppSnapshot, 'clothes' | 'wearRecords'>> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request(`/wears/${clothesId}${query}`, {
    method: 'DELETE',
  });
}

export function recordWash(clothesIds: string[], date?: string): JsonResponse<Pick<AppSnapshot, 'clothes' | 'washRecords'>> {
  const payload: { clothesIds: string[]; date?: string } = { clothesIds };
  if (date) {
    payload.date = date;
  }

  return request('/washes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function undoWash(clothesId: string, date?: string): JsonResponse<Pick<AppSnapshot, 'clothes' | 'washRecords'>> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request(`/washes/${clothesId}${query}`, {
    method: 'DELETE',
  });
}

export function purgeDatabase(): JsonResponse<Pick<AppSnapshot, 'clothes' | 'wearRecords' | 'washRecords'>> {
  return request('/purge', {
    method: 'POST',
  });
}

export function toggleLaundryBag(clothesId: string, inLaundryBag: boolean): JsonResponse<{ item: ClothesItem }> {
  return request(`/clothes/${clothesId}/laundry-bag`, {
    method: 'PUT',
    body: JSON.stringify({ inLaundryBag }),
  });
}

export function washLaundryBag(date?: string): JsonResponse<Pick<AppSnapshot, 'clothes' | 'washRecords'>> {
  const payload: { date?: string } = {};
  if (date) {
    payload.date = date;
  }

  return request('/laundry-bag/wash', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
