import axios, { AxiosError } from "axios";
import { toast } from "sonner";

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000/api";

const TOKEN_KEY = "ims_token";
const REFRESH_KEY = "ims_refresh";
const USER_KEY = "ims_user";

export const auth = {
  getToken: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  getRefresh: () => (typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY)),
  getUser: () => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setSession: (access: string, refresh: string, user: unknown) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((cfg) => {
  const t = auth.getToken();
  if (t && cfg.headers) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      auth.clear();
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth/login";
      }
    } else if (error.response) {
      const msg = error.response.data?.message || error.response.data?.error || error.message;
      toast.error(String(msg));
    } else {
      toast.error(
        "Cannot reach the API. Make sure the Flask server is running at " + API_URL,
      );
    }
    return Promise.reject(error);
  },
);
