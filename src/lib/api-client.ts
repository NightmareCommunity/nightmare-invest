export const API_BASE = "";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  totpEnabled?: boolean;
  kycStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  kycTier?: "STANDARD" | "ACCREDITED";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  // Multipart form upload (for KYC documents etc.)
  upload: async <T>(path: string, form: FormData): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `Upload failed (${res.status})`;
      throw new Error(msg);
    }
    return data as T;
  },
};
