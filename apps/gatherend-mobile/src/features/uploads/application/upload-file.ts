import { uploadsRepository } from "../data/uploads-repository";
import type { UploadFileInput } from "../domain/upload-repository";

export function uploadFile(input: UploadFileInput) {
  return uploadsRepository.uploadFile(input);
}

