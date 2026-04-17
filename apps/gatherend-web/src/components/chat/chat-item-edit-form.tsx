"use client";

import { memo, useRef, useEffect } from "react";
import * as z from "zod";
import axios from "axios";
import qs from "query-string";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useTranslation } from "@/i18n";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

const formSchema = z.object({
  content: z.string().min(1),
});

interface ChatItemEditFormProps {
  id: string;
  content: string;
  apiUrl: string;
  socketQuery: Record<string, string>;
  currentProfile: ClientProfile;
  onCancel: () => void;
}

export const ChatItemEditForm = memo(function ChatItemEditForm({
  id,
  content,
  apiUrl,
  socketQuery,
  currentProfile,
  onCancel,
}: ChatItemEditFormProps) {
  const { t } = useTranslation();
  const editInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { content },
  });

  const isLoading = form.formState.isSubmitting;

  // Focus input when form mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
        const length = content.length;
        editInputRef.current.setSelectionRange(length, length);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [content]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = qs.stringifyUrl({
        url: `${apiUrl}/${id}`,
        query: socketQuery,
      });

      await axios.patch(url, values, getExpressAxiosConfig(currentProfile.id));

      onCancel();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Form {...form}>
      <form
        className="flex flex-col w-full gap-y-2 pt-2"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <div className="relative w-full">
                  <Input
                    disabled={isLoading}
                    className="pt-1 bg-theme-bg-edit-form border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-theme-text-light"
                    placeholder={t.chat.editedMessagePlaceholder}
                    {...field}
                    ref={(e) => {
                      field.ref(e);
                      if (e) {
                        editInputRef.current = e;
                      }
                    }}
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex items-center gap-x-2">
          <Button
            type="button"
            disabled={isLoading}
            size="sm"
            onClick={onCancel}
            className="h-7 px-3 text-[14px] bg-theme-bg-cancel-button hover:bg-theme-bg-cancel-button-hover cursor-pointer text-theme-text-subtle hover:text-theme-text-light"
          >
            {t.chat.cancel}
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            size="sm"
            className="bg-theme-tab-button-bg cursor-pointer hover:bg-theme-tab-button-hover text-theme-text-light h-7 px-3 text-[14px]"
          >
            {t.chat.save}
          </Button>
          <span className="text-[12px] text-theme-text-muted ml-1">
            {t.chat.escToCancelEnterToSave}
          </span>
        </div>
      </form>
    </Form>
  );
});

