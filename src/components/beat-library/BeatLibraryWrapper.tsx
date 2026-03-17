'use client';

import { BeatLibrary } from '@/components/battle/BeatLibrary';

interface BeatLibraryWrapperProps {
  canUpload: boolean;
}

export function BeatLibraryWrapper({ canUpload }: BeatLibraryWrapperProps) {
  return (
    <BeatLibrary
      onBeatSelect={() => {}} // no-op on the library page; selection handled in battle room
      canUpload={canUpload}
    />
  );
}
