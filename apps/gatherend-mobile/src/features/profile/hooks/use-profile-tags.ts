import { useState, useCallback, useMemo } from "react";

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 10;

export interface ProfileTagsState {
  tags: string[];
  input: string;
  canAddMore: boolean;
  count: number;
  maxTags: number;
  maxTagLength: number;
}

interface UseProfileTagsOptions {
  initialTags?: string[];
  onError?: (message: string) => void;
}

export function useProfileTags({
  initialTags = [],
  onError,
}: UseProfileTagsOptions = {}) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");

  const canAddMore = tags.length < MAX_TAGS;

  const addTag = useCallback(
    (tag: string): boolean => {
      const trimmed = tag.trim();

      if (!trimmed) return false;

      if (trimmed.length > MAX_TAG_LENGTH) {
        onError?.(`Tag must be ${MAX_TAG_LENGTH} characters or less`);
        return false;
      }

      if (tags.length >= MAX_TAGS) {
        onError?.(`Maximum ${MAX_TAGS} tags allowed`);
        return false;
      }

      if (tags.includes(trimmed)) {
        onError?.("Tag already exists");
        return false;
      }

      setTags((prev) => [...prev, trimmed]);
      setInput("");
      return true;
    },
    [tags, onError],
  );

  const removeTag = useCallback((index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const state = useMemo(
    () => ({
      tags,
      input,
      canAddMore,
      count: tags.length,
      maxTags: MAX_TAGS,
      maxTagLength: MAX_TAG_LENGTH,
    }),
    [tags, input, canAddMore],
  );

  const actions = useMemo(
    () => ({
      setInput,
      addTag,
      removeTag,
      setTags,
    }),
    [addTag, removeTag],
  );

  return { state, actions };
}
