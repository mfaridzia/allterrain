import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const QUERY_KEYS = {
  dashboard: ["dashboard"] as const,
  authStatus: ["auth-status"] as const,
  settings: ["settings"] as const,
};

/**
 * Hook to fetch athlete dashboard analytics (PMC, activities, summary, radar, readiness)
 */
export function useDashboardData() {
  return useQuery({
    queryKey: QUERY_KEYS.dashboard,
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard");
      if (!res.ok) {
        throw new Error(`Failed to fetch dashboard: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to check COROS connection / authentication status
 */
export function useAuthStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.authStatus,
    queryFn: async () => {
      const res = await fetch("/api/auth/coros/status");
      if (!res.ok) {
        return { connected: false };
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch athlete settings (AI keys, trail targets)
 */
export function useAppSettings() {
  return useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        throw new Error(`Failed to fetch settings: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation to sync COROS workouts and physiological metrics
 */
export function useSyncCorosMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/coros/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sync failed");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.authStatus });
    },
  });
}

/**
 * Mutation to disconnect / logout from COROS
 */
export function useDisconnectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/coros/status", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEYS.authStatus, { connected: false });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
    },
  });
}

/**
 * Mutation to update user settings
 */
export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update settings");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.settings });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
    },
  });
}

/**
 * Mutation for manual developer token insertion
 */
export function useManualTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/auth/coros/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save token");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.authStatus });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
    },
  });
}
