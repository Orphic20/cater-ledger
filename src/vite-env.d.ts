/// <reference types="vite/client" />

declare module "word-extractor" {
  export default class WordExtractor {
    extract(source: string | import("buffer").Buffer): Promise<{
      getBody(): string;
      getFootnotes(): string;
      getEndnotes(): string;
      getHeaders(): string;
      getFooters(): string;
    }>;
  }
}

declare module "mammoth" {
  export const images: {
    imgElement: (callback: (image: unknown) => Promise<{ src: string }>) => unknown;
  };
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: { convertImage?: unknown },
  ): Promise<{ value: string; messages: unknown[] }>;
}
