import type { UploadRepository } from "../domain/upload-repository";
import { createUploadsHttpDataSource } from "./uploads-http-datasource";

const uploadsHttpDataSource = createUploadsHttpDataSource();

export const uploadsRepository: UploadRepository = {
  uploadFile(input) {
    return uploadsHttpDataSource.uploadFile(input);
  },
};

