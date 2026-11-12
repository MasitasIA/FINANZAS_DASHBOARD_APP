import { useMutation, useQueryClient } from "@tanstack/react-query";
import { shareService } from "@/services/share.service";
import type { SharedResourceType } from "@/types";

export function useCreateShareInvite() {
  return useMutation({
    mutationFn: ({
      resourceType,
      resourceId,
    }: {
      resourceType: SharedResourceType;
      resourceId: string;
    }) => shareService.createInvite(resourceType, resourceId),
  });
}

export function useJoinSharedResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => shareService.join(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useLeaveSharedResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      resourceType,
      resourceId,
      targetUserId,
    }: {
      resourceType: SharedResourceType;
      resourceId: string;
      targetUserId?: string;
    }) => shareService.leave(resourceType, resourceId, targetUserId),
    onSuccess: (_res, { resourceType }) => {
      if (resourceType === "account") {
        qc.invalidateQueries({ queryKey: ["accounts"] });
      } else {
        qc.invalidateQueries({ queryKey: ["goals"] });
      }
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

