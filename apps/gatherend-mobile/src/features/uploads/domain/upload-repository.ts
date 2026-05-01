import type { MobileUploadFile } from "../data/mobile-upload-file";
import type { UploadContext } from "./upload-context";
import type { UploadedFile } from "./uploaded-file";

export type UploadFileInput = {
  file: MobileUploadFile;
  context: UploadContext;
  profileId: string;
  boardId?: string;
};

export type UploadRepository = {
  uploadFile: (input: UploadFileInput) => Promise<UploadedFile>;
};

