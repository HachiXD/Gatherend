import { authBaseUrl } from "@/src/lib/env";

export const LEGAL_LINKS = [
  {
    title: "Preguntas y Respuestas",
    url: `${authBaseUrl}/faq`,
  },
  {
    title: "Privacidad",
    url: `${authBaseUrl}/privacy-policy`,
  },
  {
    title: "Términos de Uso",
    url: `${authBaseUrl}/tos`,
  },
] as const;
