"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch, workspaceApiPath } from "@/lib/api-client";
import { imageIdFromPath } from "../images/image-refs";

// Choosing a picture uploads it straight away. The server turns it into a small WebP, so what is stored is never
// the original file. Used by the Picture block and by a Section's background picture.
export function usePictureUpload(path: string, onUploaded: (path: string) => void) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const imageId = imageIdFromPath(path);

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch<{ path: string }>("/api/site/images", { method: "POST", body: form });
    },
    onSuccess: ({ path: stored }) => { setPreview(null); onUploaded(stored); },
  });

  function choose(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    upload.mutate(file, { onSettled: () => { if (input.current) input.current.value = ""; } });
  }

  return {
    input,
    upload,
    hasPicture: Boolean(imageId),
    // A local preview while it uploads, then the church's own picture through the editor's picture address.
    shown: preview ?? (imageId ? workspaceApiPath(`/api/site/images/${imageId}`) : null),
    choose,
    open: () => input.current?.click(),
  };
}
