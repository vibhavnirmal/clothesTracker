import type { AppSnapshot, AddClothesPayload, ClothesItem } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';

type JsonResponse<T> = Promise<T>;

export class ApiError<TBody = unknown> extends Error {
  status: number;
  details: TBody | null;

  constructor(message: string, status: number, details: TBody | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options?: RequestInit): JsonResponse<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let parsed: unknown = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      parsed = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof (parsed as { message?: string } | null)?.message === 'string'
        ? (parsed as { message: string }).message
        : response.statusText || 'Request failed';

    throw new ApiError(message, response.status, parsed);
  }

  return parsed as T;
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

export function deleteClothingType(name: string): JsonResponse<{ types: string[] }> {
  return request<{ types: string[] }>(`/types/${encodeURIComponent(name)}`, {
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
