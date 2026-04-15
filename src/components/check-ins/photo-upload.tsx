"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type PoseType = "front" | "side" | "back";

interface PhotoUploadProps {
  onUpload: (url: string) => void;
  poseType: PoseType;
  userId: string;
}

export function PhotoUpload({ onUpload, poseType, userId }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const poseLabels: Record<PoseType, string> = {
    front: "Front",
    side: "Side",
    back: "Back",
  };

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploaded(false);

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      const supabase = createClient();
      const timestamp = Date.now();
      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `${userId}/${timestamp}-${poseType}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("progress-photos")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("progress-photos").getPublicUrl(filePath);

      onUpload(publicUrl);
      setUploaded(true);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Upload failed. Please try again.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Label className="text-sm font-medium text-foreground">
        {poseLabels[poseType]} Pose
      </Label>

      <div
        className="relative flex h-40 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-background transition-colors hover:border-muted-foreground"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt={`${poseType} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span className="text-xs text-muted-foreground">Upload</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {uploaded && (
        <span className="text-xs font-medium text-green-600">Uploaded</span>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}

      {preview && !uploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            setPreview(null);
            setUploaded(false);
            setError(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          Remove
        </Button>
      )}
    </div>
  );
}
