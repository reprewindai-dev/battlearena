"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BeatPlayer } from './BeatPlayer';

interface Beat {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  key_signature: string;
  genre: string;
  duration_seconds: number;
  preview_url: string;
  file_url: string;
  is_active: boolean;
  is_verified: boolean;
  usage_count: number;
  created_at: string;
}

interface BeatLibraryProps {
  onBeatSelect?: (beat: Beat) => void;
  selectedBeatId?: string;
}

export function BeatLibrary({ onBeatSelect, selectedBeatId }: BeatLibraryProps) {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedBeat, setSelectedBeat] = useState<Beat | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const genres = ['all', 'hip-hop', 'r&b', 'trap', 'drill', 'afrobeat', 'pop', 'electronic'];

  useEffect(() => {
    fetchBeats();
  }, [currentPage, selectedGenre, searchTerm]);

  const fetchBeats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(selectedGenre !== 'all' && { genre: selectedGenre }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/beats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch beats');
      }

      const data = await response.json();
      setBeats(data.beats || []);
      setTotalPages(data.totalPages || 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load beats');
      setBeats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBeatSelect = (beat: Beat) => {
    setSelectedBeat(beat);
    setIsPlaying(false);
    onBeatSelect?.(beat);
  };

  const handlePlayPause = () => {
    if (selectedBeat) {
      setIsPlaying(!isPlaying);
    }
  };

  const filteredBeats = beats.filter(beat =>
    beat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    beat.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && beats.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading beats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Beat Library</h2>
        <p className="text-gray-600">Choose the perfect beat for your battle</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search beats or artists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-2 flex-wrap">
            {genres.map(genre => (
              <Button
                key={genre}
                variant={selectedGenre === genre ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedGenre(genre)}
              >
                {genre.charAt(0).toUpperCase() + genre.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Beat Player */}
      {selectedBeat && (
        <BeatPlayer
          beat={selectedBeat}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
        />
      )}

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-red-300 bg-red-50">
          <p className="text-red-700">{error}</p>
          <Button onClick={fetchBeats} variant="outline" size="sm" className="mt-2">
            Retry
          </Button>
        </Card>
      )}

      {/* Beats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBeats.map(beat => (
          <Card 
            key={beat.id} 
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedBeatId === beat.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleBeatSelect(beat)}
          >
            <div className="space-y-3">
              {/* Beat Info */}
              <div>
                <h3 className="font-semibold truncate">{beat.title}</h3>
                <p className="text-sm text-gray-600 truncate">{beat.artist}</p>
              </div>

              {/* Metadata */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{beat.genre}</Badge>
                <Badge variant="outline">{beat.tempo} BPM</Badge>
                <Badge variant="outline">{beat.key_signature}</Badge>
                {beat.is_verified && (
                  <Badge variant="default" className="bg-green-500">Verified</Badge>
                )}
              </div>

              {/* Stats */}
              <div className="flex justify-between text-sm text-gray-500">
                <span>{Math.floor(beat.duration_seconds / 60)}:{(beat.duration_seconds % 60).toString().padStart(2, '0')}</span>
                <span>{beat.usage_count} uses</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={selectedBeatId === beat.id ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBeatSelect(beat);
                  }}
                >
                  {selectedBeatId === beat.id ? 'Selected' : 'Select'}
                </Button>
                
                {/* Preview Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle preview
                    if (selectedBeat?.id === beat.id) {
                      handlePlayPause();
                    } else {
                      handleBeatSelect(beat);
                      setTimeout(() => setIsPlaying(true), 100);
                    }
                  }}
                >
                  {selectedBeat?.id === beat.id && isPlaying ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="py-2 px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBeats.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <p className="text-gray-600">No beats found</p>
          <p className="text-sm text-gray-500">Try adjusting your filters or search terms</p>
        </div>
      )}
    </div>
  );
}
