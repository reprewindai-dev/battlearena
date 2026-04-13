"use client";

import * as React from "react";
import { Upload, Music, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const GENRES = ["hip-hop", "trap", "boom-bap", "lo-fi", "drill", "r&b", "pop", "electronic", "rock", "afrobeat"];
const KEYS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
  "Cm",
  "C#m",
  "Dm",
  "D#m",
  "Em",
  "Fm",
  "F#m",
  "Gm",
  "G#m",
  "Am",
  "A#m",
  "Bm",
];
const MAX_AUDIO_SIZE_MB = 50;
const MAX_PREVIEW_SIZE_MB = 10;
const ALLOWED_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/aac",
  "audio/ogg",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded?: () => void;
}

function validateAudioFile(file: File, maxMb: number, label: string) {
  if (file.size > maxMb * 1024 * 1024) {
    toast.error(`${label} file too large. Max ${maxMb} MB.`);
    return false;
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    toast.error(`Invalid ${label.toLowerCase()} file type. Use MP3, WAV, AAC, or OGG.`);
    return false;
  }

  return true;
}

export function BeatUploadModal({ open, onClose, onUploaded }: Props) {
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [previewFile, setPreviewFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [artist, setArtist] = React.useState("");
  const [genre, setGenre] = React.useState("");
  const [tempo, setTempo] = React.useState("");
  const [keySignature, setKeySignature] = React.useState("C");
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setAudioFile(null);
    setPreviewFile(null);
    setTitle("");
    setArtist("");
    setGenre("");
    setTempo("");
    setKeySignature("C");
    setProgress(0);
  }

  function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !validateAudioFile(file, MAX_AUDIO_SIZE_MB, "Audio")) {
      return;
    }

    setAudioFile(file);
    if (!title) {
      const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }

  function handlePreviewFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !validateAudioFile(file, MAX_PREVIEW_SIZE_MB, "Preview")) {
      return;
    }

    setPreviewFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) {
      return;
    }

    const synth = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleAudioFileChange(synth);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!audioFile) {
      toast.error("Select a full beat audio file first");
      return;
    }
    if (!previewFile) {
      toast.error("Select a preview clip first");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!artist.trim()) {
      toast.error("Artist is required");
      return;
    }
    if (!genre) {
      toast.error("Select a genre");
      return;
    }

    const bpm = parseInt(tempo, 10);
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 260) {
      toast.error("Tempo must be between 40 and 260 BPM");
      return;
    }

    setUploading(true);
    setProgress(10);

    const formData = new FormData();
    formData.append(
      "beatData",
      JSON.stringify({
        title: title.trim(),
        artist: artist.trim(),
        genre,
        tempo: bpm,
        key_signature: keySignature,
      }),
    );
    formData.append("audioFile", audioFile);
    formData.append("previewFile", previewFile);

    try {
      setProgress(40);
      const res = await fetch("/api/beats", {
        method: "POST",
        body: formData,
      });
      setProgress(90);

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed");
        return;
      }

      setProgress(100);
      toast.success(`"${json.beat.title}" uploaded successfully`);
      reset();
      onUploaded?.();
      onClose();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            Upload Beat
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => audioInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
              audioFile ? "border-green-500/50 bg-green-500/5" : "border-border/60 hover:border-border hover:bg-muted/20"
            }`}
          >
            {audioFile ? (
              <div className="flex items-center gap-2 text-sm">
                <Music className="h-4 w-4 text-green-400" />
                <span className="font-medium">{audioFile.name}</span>
                <span className="text-muted-foreground">({(audioFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAudioFile(null);
                    if (audioInputRef.current) {
                      audioInputRef.current.value = "";
                    }
                  }}
                  className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground/50" />
                <div className="text-center">
                  <p className="text-sm font-medium">Drop full beat audio or click to browse</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">MP3, WAV, AAC, OGG - Max {MAX_AUDIO_SIZE_MB} MB</p>
                </div>
              </>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/aac,audio/ogg"
              onChange={handleAudioFileChange}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-muted-foreground">Preview Clip *</label>
            <Input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/aac,audio/ogg"
              onChange={handlePreviewFileChange}
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Upload the short preview clip used in the beat picker. Max {MAX_PREVIEW_SIZE_MB} MB.
            </p>
            {previewFile ? (
              <p className="text-xs text-foreground">
                Preview selected: {previewFile.name} ({(previewFile.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Beat title" className="h-8 text-sm" required />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Artist / Producer *</label>
              <Input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Producer name"
                className="h-8 text-sm"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Genre *</label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tempo (BPM) *</label>
              <Input
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                placeholder="e.g. 90"
                type="number"
                min={40}
                max={260}
                className="h-8 text-sm"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Key Signature</label>
              <Select value={keySignature} onValueChange={setKeySignature}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KEYS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {uploading && progress > 0 ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          <Button type="submit" disabled={uploading || !audioFile || !previewFile} className="w-full">
            {uploading ? "Uploading..." : "Upload Beat"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
