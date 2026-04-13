"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pruneOrphanBoardMembersQueries } from "@/hooks/board-cache";

export function useBoardMembersCacheSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    pruneOrphanBoardMembersQueries(queryClient);

    return queryClient.getQueryCache().subscribe(() => {
      pruneOrphanBoardMembersQueries(queryClient);
    });
  }, [queryClient]);
}
