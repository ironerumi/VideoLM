import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { sessionManager } from "./session";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...sessionManager.getSessionHeaders(),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Update session ID from response if provided
  sessionManager.updateFromResponse(res);
  
  await throwIfResNotOk(res);
  return res;
}

// Helper function for file uploads with session management
export async function uploadFile(url: string, formData: FormData) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...sessionManager.getSessionHeaders(),
    },
    body: formData,
    credentials: "include",
  });

  // Update session ID from response if provided
  sessionManager.updateFromResponse(res);
  
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: {
        ...sessionManager.getSessionHeaders(),
      },
      credentials: "include",
    });

    // Update session ID from response if provided
    sessionManager.updateFromResponse(res);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
