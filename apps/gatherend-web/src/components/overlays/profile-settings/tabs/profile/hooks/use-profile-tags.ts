"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 10;

export interface ProfileTagsState {
 tags: string[];
 input: string;
}

interface UseProfileTagsOptions {
 initialTags?: string[];
}

/**
 * Hook para manejar los profile tags con validación incluida.
 */
export function useProfileTags({
 initialTags = [],
}: UseProfileTagsOptions = {}) {
 const [tags, setTags] = useState<string[]>(initialTags);
 const [input, setInput] = useState("");

 const canAddMore = tags.length < MAX_TAGS;

 const addTag = useCallback(
 (tag: string) => {
 const trimmed = tag.trim();

 if (!trimmed) return false;

 if (trimmed.length > MAX_TAG_LENGTH) {
 toast.error(`Tag must be ${MAX_TAG_LENGTH} characters or less`);
 return false;
 }

 if (tags.length >= MAX_TAGS) {
 toast.error(`Maximum ${MAX_TAGS} tags allowed`);
 return false;
 }

 if (tags.includes(trimmed)) {
 toast.error("Tag already exists");
 return false;
 }

 setTags((prev) => [...prev, trimmed]);
 setInput("");
 return true;
 },
 [tags],
 );

 const removeTag = useCallback((index: number) => {
 setTags((prev) => prev.filter((_, i) => i !== index));
 }, []);

 const handleInputKeyDown = useCallback(
 (e: React.KeyboardEvent) => {
 if (e.key === "Enter") {
 e.preventDefault();
 addTag(input);
 }
 },
 [addTag, input],
 );

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
 handleInputKeyDown,
 setTags,
 }),
 [addTag, removeTag, handleInputKeyDown],
 );

 return { state, actions };
}
