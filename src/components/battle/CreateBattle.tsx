'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Music, Clock, Trophy, Users, Zap, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface CreateBattleProps {
  onBack: () => void;
  onBattleCreated: (battle: any) => void;
  selectedBeat?: any;
}

interface BattleConfig {
  battle_type: 'ranked' | 'casual' | 'tournament';
  format: '30s' | '60s' | '90s';
  entry_fee_tokens: number;
  max_participants: number;
  beat_preferences: {
    genre?: string;
    tempo_range: [number, number];
  };
}

export function CreateBattle({ onBack, onBattleCreated, selectedBeat }: CreateBattleProps) {
  const [config, setConfig] = useState<BattleConfig>({
    battle_type: 'casual',
    format: '30s',
    entry_fee_tokens: 0,
    max_participants: 2,
    beat_preferences: {
      genre: 'all',
      tempo_range: [80, 120]
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const genres = [
    'all', 'hip-hop', 'trap', 'boom-bap', 'lo-fi', 'drill', 'r&b', 'pop', 'electronic', 'rock'
  ];

  const handleCreateBattle = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/battles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create battle');
      }

      const battle = await response.json();
      toast.success('Battle created successfully!');
      onBattleCreated(battle);
    } catch (error) {
      console.error('Error creating battle:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create battle');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (key: keyof BattleConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateBeatPreferences = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      beat_preferences: {
        ...prev.beat_preferences,
        [key]: value
      }
    }));
  };

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const getBattleTypeColor = (type: string) => {
    switch (type) {
      case 'ranked': return 'bg-red-500';
      case 'casual': return 'bg-green-500';
      case 'tournament': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getFormatColor = (format: string) => {
    switch (format) {
      case '30s': return 'bg-blue-500';
      case '60s': return 'bg-orange-500';
      case '90s': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={onBack} className="text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Create Battle</h1>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-green-500' : 'bg-gray-600'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-green-500' : 'bg-gray-600'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-green-500' : 'bg-gray-600'}`} />
          </div>
        </div>

        {/* Step 1: Battle Type */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <Card className="bg-black/20 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5" />
                  <span>Battle Type</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { type: 'ranked', title: 'Ranked Battle', description: 'Competitive rating system', icon: '🏆' },
                    { type: 'casual', title: 'Casual Battle', description: 'Fun and practice', icon: '🎮' },
                    { type: 'tournament', title: 'Tournament', description: 'Official competition', icon: '🏅' }
                  ].map((option) => (
                    <div
                      key={option.type}
                      onClick={() => updateConfig('battle_type', option.type)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        config.battle_type === option.type
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      <div className="text-2xl mb-2">{option.icon}</div>
                      <h3 className="font-semibold mb-1">{option.title}</h3>
                      <p className="text-sm text-gray-400">{option.description}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={onBack}>
                    Cancel
                  </Button>
                  <Button onClick={nextStep}>
                    Next Step
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Battle Format */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <Card className="bg-black/20 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Battle Format</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">Round Duration</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { format: '30s', title: '30 Seconds', description: 'Quick rounds', duration: 30 },
                      { format: '60s', title: '60 Seconds', description: 'Standard rounds', duration: 60 },
                      { format: '90s', title: '90 Seconds', description: 'Extended rounds', duration: 90 }
                    ].map((option) => (
                      <div
                        key={option.format}
                        onClick={() => updateConfig('format', option.format)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          config.format === option.format
                            ? 'border-purple-500 bg-purple-500/20'
                            : 'border-white/20 hover:border-white/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{option.title}</h3>
                          <Badge className={getFormatColor(option.format)}>
                            {option.format}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400">{option.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{option.duration} seconds per round</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-lg font-semibold mb-4 block">Participants</Label>
                  <div className="flex items-center space-x-4">
                    <Users className="w-5 h-5" />
                    <span className="text-sm">Max Participants: {config.max_participants}</span>
                  </div>
                  <Slider
                    value={[config.max_participants]}
                    onValueChange={([value]) => updateConfig('max_participants', value)}
                    min={2}
                    max={8}
                    step={1}
                    className="mt-2"
                  />
                </div>

                {config.battle_type !== 'casual' && (
                  <div>
                    <Label className="text-lg font-semibold mb-4 block">Entry Fee</Label>
                    <div className="flex items-center space-x-4">
                      <Zap className="w-5 h-5" />
                      <span className="text-sm">Entry Fee: {config.entry_fee_tokens} tokens</span>
                    </div>
                    <Slider
                      value={[config.entry_fee_tokens]}
                      onValueChange={([value]) => updateConfig('entry_fee_tokens', value)}
                      min={0}
                      max={100}
                      step={5}
                      className="mt-2"
                    />
                    {config.entry_fee_tokens > 0 && (
                      <p className="text-sm text-green-400 mt-2">
                        Prize Pool: {config.entry_fee_tokens * config.max_participants} tokens
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>
                    Previous
                  </Button>
                  <Button onClick={nextStep}>
                    Next Step
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Beat Preferences */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <Card className="bg-black/20 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Music className="w-5 h-5" />
                  <span>Beat Preferences</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedBeat ? (
                  <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/50">
                    <p className="text-green-400 font-semibold mb-2">Beat Selected</p>
                    <p className="font-semibold">{selectedBeat.title}</p>
                    <p className="text-sm text-gray-400">{selectedBeat.artist} • {selectedBeat.tempo} BPM</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="text-lg font-semibold mb-4 block">Genre Preference</Label>
                      <Select value={config.beat_preferences.genre} onValueChange={(value) => updateBeatPreferences('genre', value)}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 border-white/20">
                          {genres.map(genre => (
                            <SelectItem key={genre} value={genre}>
                              {genre === 'all' ? 'All Genres' : genre.charAt(0).toUpperCase() + genre.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-lg font-semibold mb-4 block">
                        Tempo Range: {config.beat_preferences.tempo_range[0]} - {config.beat_preferences.tempo_range[1]} BPM
                      </Label>
                      <Slider
                        value={config.beat_preferences.tempo_range}
                        onValueChange={(value) => updateBeatPreferences('tempo_range', value as [number, number])}
                        min={60}
                        max={200}
                        step={5}
                        className="mt-2"
                      />
                    </div>

                    <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500/50">
                      <p className="text-blue-400 text-sm">
                        <strong>Note:</strong> If no specific beat is selected, the system will choose from available beats matching your preferences.
                      </p>
                    </div>
                  </>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>
                    Previous
                  </Button>
                  <Button onClick={handleCreateBattle} disabled={loading}>
                    {loading ? 'Creating...' : 'Create Battle'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
