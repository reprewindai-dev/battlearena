'use client';

import { PremiumHomePage } from '@/components/layout/PremiumLayout';
import PremiumMobileHomePage from '@/components/mobile/PremiumMobileHome';
import { useEffect, useState } from 'react';

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile ? <PremiumMobileHomePage /> : <PremiumHomePage />;
}
