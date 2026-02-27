import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useHighscores() {
  return useQuery({
    queryKey: [api.highscores.list.path],
    queryFn: async () => {
      const res = await fetch(api.highscores.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch highscores");
      return api.highscores.list.responses[200].parse(await res.json());
    },
    // Refresh often for an arcade feel
    refetchInterval: 10000, 
  });
}

export function useCreateHighscore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { playerName: string; score: number }) => {
      const validated = api.highscores.create.input.parse(data);
      const res = await fetch(api.highscores.create.path, {
        method: api.highscores.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Failed to submit highscore");
      }
      return api.highscores.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.highscores.list.path] });
    },
  });
}
