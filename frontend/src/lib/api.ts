import type {
  AppNotification,
  CompanyProfile,
  Interest,
  Match,
  Message,
  ResearcherProfile,
  User,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, (err as { detail?: string }).detail ?? "API error");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- auth ----
export const authApi = {
  register: (body: { email: string; password: string; role: string }) =>
    request<User>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ access_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ---- users ----
export const userApi = {
  getMe: (token: string) =>
    request<User>("/api/v1/users/me", {}, token),
};

// ---- profiles ----
export const profileApi = {
  getResearcher: (userId: string, token: string) =>
    request<ResearcherProfile>(`/api/v1/profiles/researcher/${userId}`, {}, token),

  getCompany: (userId: string, token: string) =>
    request<CompanyProfile>(`/api/v1/profiles/company/${userId}`, {}, token),

  createResearcher: (body: Record<string, unknown>, token: string) =>
    request<ResearcherProfile>("/api/v1/profiles/researcher", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  updateResearcher: (body: Record<string, unknown>, token: string) =>
    request<ResearcherProfile>("/api/v1/profiles/researcher", {
      method: "PUT",
      body: JSON.stringify(body),
    }, token),

  createCompany: (body: Record<string, unknown>, token: string) =>
    request<CompanyProfile>("/api/v1/profiles/company", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  updateCompany: (body: Record<string, unknown>, token: string) =>
    request<CompanyProfile>("/api/v1/profiles/company", {
      method: "PUT",
      body: JSON.stringify(body),
    }, token),
};

// ---- matching ----
export interface RecommendationItem {
  user_id: string;
  match_score: number;
  profile: ResearcherProfile | CompanyProfile;
}

export const matchingApi = {
  getRecommendations: (token: string) =>
    request<RecommendationItem[]>("/api/v1/matching/recommendations", {}, token),

  listMatches: (token: string) =>
    request<Match[]>("/api/v1/matching/matches", {}, token),
};

// ---- interests ----
export interface InterestListResponse {
  sent: Interest[];
  received: Interest[];
}

export const interestApi = {
  send: (receiverId: string, token: string) =>
    request<Interest>("/api/v1/interests", {
      method: "POST",
      body: JSON.stringify({ receiver_id: receiverId }),
    }, token),

  list: (token: string) =>
    request<InterestListResponse>("/api/v1/interests", {}, token),

  withdraw: (interestId: string, token: string) =>
    request<void>(`/api/v1/interests/${interestId}`, {
      method: "DELETE",
    }, token),
};

// ---- search ----
export interface SearchResult {
  items: RecommendationItem[];
  total: number;
  page: number;
  pages: number;
}

export const searchApi = {
  search: (
    params: { q?: string; fields?: string; types?: string; page?: number },
    token: string,
  ) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.fields) qs.set("fields", params.fields);
    if (params.types) qs.set("types", params.types);
    if (params.page && params.page > 1) qs.set("page", String(params.page));
    const query = qs.toString();
    return request<SearchResult>(`/api/v1/search${query ? `?${query}` : ""}`, {}, token);
  },
};

// ---- notifications ----
export const notificationApi = {
  list: (token: string) =>
    request<AppNotification[]>("/api/v1/notifications", {}, token),

  readAll: (token: string) =>
    request<void>("/api/v1/notifications/read-all", { method: "PUT" }, token),
};

// ---- messages ----
export interface ThreadSummary {
  match_id: string;
  matched_at: string;
  partner_user_id: string;
  last_message: Message | null;
  unread_count: number;
}

export const messageApi = {
  listThreads: (token: string) =>
    request<ThreadSummary[]>("/api/v1/messages", {}, token),

  getThread: (matchId: string, token: string) =>
    request<Message[]>(`/api/v1/messages/${matchId}`, {}, token),

  send: (matchId: string, body: string, token: string) =>
    request<Message>(`/api/v1/messages/${matchId}`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }, token),

  markAsRead: (matchId: string, token: string) =>
    request<{ updated: number }>(`/api/v1/messages/${matchId}/read`, {
      method: "PUT",
    }, token),
};
