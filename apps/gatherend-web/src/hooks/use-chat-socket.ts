// Global map to track pending optimistic message timeouts.
// Socket/global listeners clear these when a confirmed message arrives.
const optimisticTimeouts = new Map<string, NodeJS.Timeout>();

export const clearOptimisticTimeout = (tempId: string) => {
  const timeout = optimisticTimeouts.get(tempId);
  if (timeout) {
    clearTimeout(timeout);
    optimisticTimeouts.delete(tempId);
  }
};

export const setOptimisticTimeout = (
  tempId: string,
  timeout: NodeJS.Timeout,
) => {
  optimisticTimeouts.set(tempId, timeout);
};
