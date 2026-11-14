export class ApiError extends Error {
  public status: number;
  public code?: string;
  public payload?: unknown;

  constructor(message: string, status: number, code?: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' };

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data.error || `Request failed (${res.status})`,
      res.status,
      data.code,
      data
    );
  }
  return data as T;
}
