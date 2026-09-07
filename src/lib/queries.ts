import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const QUERY_KEYS = {
  dashboard: ["dashboard"] as const,
  authStatus: ["auth-status"] as const,
  settings: ["settings"] as const,
  gear: ["gear"] as const,
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

/**
 * Hook to fetch gear & shoes tracking data
 */
export function useGearData() {
  return useQuery({
    queryKey: QUERY_KEYS.gear,
    queryFn: async () => {
      const res = await fetch("/api/gear");
      if (!res.ok) {
        throw new Error(`Failed to fetch gear data: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation to add a new shoe
 */
export function useAddShoeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to add shoe");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.gear });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
    },
  });
}

/**
 * Mutation to update or retire a shoe
 */
export function useUpdateShoeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/gear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update shoe");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.gear });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
    },
  });
}

/**
 * Mutation to delete a shoe
 */
export function useDeleteShoeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/gear?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete shoe");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.gear });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
    },
  });
}

/**
 * Mutation to assign a shoe to an activity
 */
export function useAssignShoeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { activityId: string; shoeId: string | null }) => {
      const res = await fetch("/api/gear/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to assign shoe");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.gear });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
    },
  });
}

