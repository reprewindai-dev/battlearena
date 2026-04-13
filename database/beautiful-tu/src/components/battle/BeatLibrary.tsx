'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Search, Play, Pause, Volume2, Music, Clock, TrendingUp, Filter, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { BeatUploadModal } from '@/components/audio/BeatUploadModal';

interface Beat {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  key_signature: string;
  genre: string;
  duration_seconds: number;
  preview_url: string;
  usage_count: number;
  created_at: string;
}

interface BeatLibraryProps {
  onBeatSelect: (beat: Beat) => void;
  selectedBeatId?: string;
  canUpload?: boolean;
}

export function BeatLibrary({ onBeatSelect, selectedBeatId, canUpload = false }: BeatLibraryProps) {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [tempoRange, setTempoRange] = useState([60, 180]);
  const [playingBeatId, setPlayingBeatId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const genres = [
    'all', 'hip-hop', 'trap', 'boom-bap', 'lo-fi', 'drill', 'r&b', 'pop', 'electronic', 'rock', 'afrobeat',
  ];

  useEffect(() => { fetchBeats(); }, [selectedGenre, tempoRange]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const fetchBeats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedGenre !== 'all') params.append('genre', selectedGenre);
      params.append('tempo_min', tempoRange[0].toString());
      params.append('tempo_max', tempoRange[1].toString());
      params.append('limit', '50');
      const response = await fetch(`/api/beats?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch beats');
      const data = await response.json();
      setBeats(data.beats || []);
    } catch (error) {
      console.error('Error fetching beats:', error);
      toast.error('Failed to load beats');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPreview = async (beat: Beat) => {
    try {
      if (playingBeatId === beat.id && audioRef.current) {
        audioRef.current.pause();
        setPlayingBeatId(null);
        return;
      }
      if (audioRef.current) audioRef.current.pause();
      if (!beat.preview_url) { toast.error('No preview available'); return; }
      const audio = new Audio();
      audio.src = beat.preview_url;
      audioRef.current = audio;
      audio.onplay = () => setPlayingBeatId(beat.id);
      audio.onpause = () => setPlayingBeatId(null);
      audio.onended = () => setPlayingBeatId(null);
      audio.onerror = () => { toast.error('Failed to play preview'); setPlayingBeatId(null); };
      await audio.play();
    } catch {
      toast.error('Failed to play preview');
    }
  };

  const handleBeatSelect = (beat: Beat) => {
    onBeatSelect(beat);
    toast.success(`Selected: ${beat.title} by ${beat.artist}`);
  };

  const filteredBeats = beats.filter(beat =>
    beat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    beat.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGenreColor = (genre: string) => {
    const colors: Record<string, string> = {
      'hip-hop': 'bg-purple-500', 'trap': 'bg-red-500', 'boom-bap': 'bg-blue-500',
      'lo-fi': 'bg-green-500', 'drill': 'bg-orange-500', 'r&b': 'bg-pink-500',
      'pop': 'bg-yellow-500', 'electronic': 'bg-cyan-500', 'rock': 'bg-gray-500',
      'afrobeat': 'bg-lime-500',
    };
    return colors[genre] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-border/60 bg-card/30 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search beats..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger><SelectValue placeholder="Genre" /></SelectTrigger>
            <SelectContent>
              {genres.map(genre => (
                <SelectItem key={genre} value={genre}>
                  {genre === 'all' ? 'All Genres' : genre.charAt(0).toUpperCase() + genre.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Tempo: {tempoRange[0]}-{tempoRange[1]} BPM
            </div>
            <Slider value={tempoRange} onValueChange={setTempoRange} min={60} max={200} step={5} />
          </div>
        </div>
      </Card>

      {/* Beat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 9 }).map((_, i) => (
            <div key={`sk-${i}`} className="h-48 animate-pulse rounded-lg bg-muted/30" />
          ))
        ) : filteredBeats.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <Music className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium">No beats found</p>
            <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters</p>
          </div>
        ) : (
          filteredBeats.map(beat => (
            <Card
              key={beat.id}
              className={`cursor-pointer border-border/60 bg-card/30 transition-all hover:bg-card/60 hover:shadow-md ${
                selectedBeatId === beat.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{beat.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{beat.artist}</p>
                  </div>
                  <Badge className={`${getGenreColor(beat.genre)} text-white text-[10px] shrink-0`}>
                    {beat.genre}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatDuration(beat.duration_seconds)}</div>
                  <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />{beat.tempo} BPM</div>
                  <div className="flex items-center gap-1.5"><Music className="h-3.5 w-3.5" />{beat.key_signature}</div>
                  <div className="flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5" />{beat.usage_count} uses</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => handlePlayPreview(beat)}>
                    {playingBeatId === beat.id ? <><Pause className="h-3.5 w-3.5" />Stop</> : <><Play className="h-3.5 w-3.5" />Preview</>}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    variant={selectedBeatId === beat.id ? 'secondary' : 'default'}
                    onClick={() => handleBeatSelect(beat)}
                    disabled={selectedBeatId === beat.id}
                  >
                    {selectedBeatId === beat.id ? 'Selected' : 'Select'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Upload FAB - admins/mods only */}
      {canUpload && (
        <div className="fixed bottom-8 right-8 z-30">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full p-0 shadow-lg"
            onClick={() => setUploadOpen(true)}
            title="Upload beat"
          >
            <Upload className="h-5 w-5" />
          </Button>
        </div>
      )}

      <BeatUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={fetchBeats}
      />
    </div>
  );
}

