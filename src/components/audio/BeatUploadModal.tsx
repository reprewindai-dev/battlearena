"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Music, X } from "lucide-react";

const GENRES = ["hip-hop", "trap", "boom-bap", "lo-fi", "drill", "r&b", "pop", "electronic", "rock", "afrobeat"];
const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
               "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"];
const MAX_SIZE_MB = 30;

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded?: () => void;
}

export function BeatUploadModal({ open, onClose, onUploaded }: Props) {
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [artist, setArtist] = React.useState("");
  const [genre, setGenre] = React.useState("");
  const [tempo, setTempo] = React.useState("");
  const [keySignature, setKeySignature] = React.useState("C");
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setArtist("");
    setGenre("");
    setTempo("");
    setKeySignature("C");
    setProgress(0);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Max ${MAX_SIZE_MB} MB.`);
      return;
    }
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav", "audio/aac", "audio/ogg"];
    if (!allowed.includes(f.type)) {
      toast.error("Invalid file type. Use MP3, WAV, AAC, or OGG.");
      return;
    }
    setFile(f);
    // Auto-fill title from filename if empty
    if (!title) {
      const name = f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      const synth = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(synth);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Select an audio file first"); return; }
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!artist.trim()) { toast.error("Artist is required"); return; }
    if (!genre) { toast.error("Select a genre"); return; }
    const bpm = parseInt(tempo, 10);
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 300) {
      toast.error("Tempo must be between 40 and 300 BPM");
      return;
    }

    setUploading(true);
    setProgress(10);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("artist", artist.trim());
    formData.append("genre", genre);
    formData.append("tempo", String(bpm));
    formData.append("key_signature", keySignature);

    try {
      setProgress(40);
      const res = await fetch("/api/beats/upload", {
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
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            Upload Beat
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors
              ${file ? "border-green-500/50 bg-green-500/5" : "border-border/60 hover:border-border hover:bg-muted/20"}`}
          >
            {file ? (
              <div className="flex items-center gap-2 text-sm">
                <Music className="h-4 w-4 text-green-400" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground/50" />
                <div className="text-center">
                  <p className="text-sm font-medium">Drop audio file or click to browse</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">MP3, WAV, AAC, OGG · Max {MAX_SIZE_MB} MB</p>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/aac,audio/ogg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Title *</label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Beat title"
                className="h-8 text-sm"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Artist / Producer *</label>
              <Input
                value={artist}
                onChange={e => setArtist(e.target.value)}
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
                  {GENRES.map(g => (
                    <SelectItem key={g} value={g}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tempo (BPM) *</label>
              <Input
                value={tempo}
                onChange={e => setTempo(e.target.value)}
                placeholder="e.g. 90"
                type="number"
                min={40}
                max={300}
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
                  {KEYS.map(k => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Progress bar */}
          {uploading && progress > 0 && (
            <div className="overflow-hidden rounded-full bg-muted/30 h-1.5">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <Button type="submit" disabled={uploading || !file} className="w-full">
            {uploading ? "Uploading…" : "Upload Beat"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
