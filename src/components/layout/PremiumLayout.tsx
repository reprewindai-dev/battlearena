import React from 'react';
import { BattleArenaLogo, BattleArenaWordmark } from '@/components/brand/Logo';
import { HeroBanner } from '@/components/brand/Banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Menu, X, Home, Swords, Trophy, User, Settings, Mic, Video, Users, Clock, TrendingUp, Zap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const PremiumLayout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BattleArenaLogo size="small" />
            <BattleArenaWordmark size="small" />
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden lg:block fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BattleArenaLogo size="medium" />
              <BattleArenaWordmark size="medium" />
            </div>
            
            <nav className="hidden lg:flex items-center gap-6">
              <Button variant="ghost" className="text-white hover:bg-white/10 flex items-center gap-2">
                <Home className="w-4 h-4" />
                Home
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/10 flex items-center gap-2">
                <Swords className="w-4 h-4" />
                Battles
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/10 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Beats
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/10 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Tournaments
              </Button>
            </nav>

            <div className="flex items-center gap-4">
              <Button className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                Start Battle
              </Button>
              <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full" />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/95 backdrop-blur-lg">
          <div className="flex flex-col h-full pt-20 px-6 pb-6">
            <nav className="flex flex-col gap-4">
              <Button variant="ghost" className="text-white hover:bg-white/10 justify-start">
                <Home className="w-4 h-4 mr-3" />
                Home
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/10 justify-start">
                <Swords className="w-4 h-4 mr-3" />
                Battles
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/10 justify-start">
                <Mic className="w-4 h-4 mr-3" />
                Beats
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/10 justify-start">
                <Trophy className="w-4 h-4 mr-3" />
                Tournaments
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/10 justify-start">
                <User className="w-4 h-4 mr-3" />
                Profile
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/10 justify-start">
                <Settings className="w-4 h-4 mr-3" />
                Settings
              </Button>
            </nav>
            
            <div className="mt-auto">
              <Button className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                Start Battle
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:pt-20">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 z-40">
        <div className="flex items-center justify-around py-2">
          <Button variant="ghost" className="text-white hover:bg-white/10 flex flex-col gap-1 p-2">
            <Home className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10 flex flex-col gap-1 p-2">
            <Swords className="w-5 h-5" />
            <span className="text-xs">Battles</span>
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10 flex flex-col gap-1 p-2">
            <Mic className="w-5 h-5" />
            <span className="text-xs">Beats</span>
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10 flex flex-col gap-1 p-2">
            <Trophy className="w-5 h-5" />
            <span className="text-xs">Tournaments</span>
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10 flex flex-col gap-1 p-2">
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export const PremiumHomePage: React.FC = () => {
  return (
    <PremiumLayout>
      {/* Hero Section */}
      <section className="relative">
        <HeroBanner />
      </section>

      {/* Quick Stats */}
      <section className="container mx-auto px-4 lg:px-6 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-orange-900/20 to-orange-800/20 border-orange-500/20">
            <CardContent className="p-4 lg:p-6 text-center">
              <div className="flex items-center justify-center mb-2">
                <Zap className="w-6 h-6 text-orange-400" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-orange-400">50K+</div>
              <div className="text-white/60 text-sm">Active Battles</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/20">
            <CardContent className="p-4 lg:p-6 text-center">
              <div className="flex items-center justify-center mb-2">
                <Mic className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-purple-400">100K+</div>
              <div className="text-white/60 text-sm">Beats</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-pink-900/20 to-pink-800/20 border-pink-500/20">
            <CardContent className="p-4 lg:p-6 text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="w-6 h-6 text-pink-400" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-pink-400">25K+</div>
              <div className="text-white/60 text-sm">Battlers</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 border-yellow-500/20">
            <CardContent className="p-4 lg:p-6 text-center">
              <div className="flex items-center justify-center mb-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-yellow-400">$1M+</div>
              <div className="text-white/60 text-sm">Prizes</div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Featured Battles */}
      <section className="container mx-auto px-4 lg:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-white">
            🔥 <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">Featured Battles</span>
          </h2>
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
            View All
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-gradient-to-br from-purple-900/20 to-orange-900/20 border-white/10 hover:border-white/20 transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-orange-500 text-white">LIVE</Badge>
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-sm font-bold">LIVE</span>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">Trap God Challenge #{i}</h3>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full" />
                    <span className="text-white/80 text-sm">vs</span>
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full" />
                  </div>
                  <span className="text-white/60 text-sm">60s</span>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-white/60" />
                    <span className="text-white/60 text-sm">1.2K watching</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400 text-sm font-bold">100</span>
                    <span className="text-white/60 text-sm">tokens</span>
                  </div>
                </div>
                
                <Button className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                  Join Battle
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trending Beats */}
      <section className="container mx-auto px-4 lg:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-white">
            🎵 <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Trending Beats</span>
          </h2>
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
            Browse All
          </Button>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-white/10 hover:border-white/20 transition-all cursor-pointer">
              <CardContent className="p-4">
                <div className="w-full h-24 bg-gradient-to-br from-orange-400 to-pink-400 rounded-lg mb-3 flex items-center justify-center">
                  <Mic className="w-8 h-8 text-white/80" />
                </div>
                <h4 className="text-white font-bold text-sm mb-1">Neon Dreams #{i}</h4>
                <p className="text-white/60 text-xs mb-2">Arena Producer</p>
                <div className="flex items-center justify-between">
                  <span className="text-orange-400 text-xs font-bold">92 BPM</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 text-xs">+{i * 12}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 lg:px-6 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-900/40 via-purple-900/40 to-pink-900/40 p-8 lg:p-12">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='white' stroke-width='0.5' opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)' /%3E%3C/svg%3E\")",
            }}
          />
          
          <div className="relative z-10 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">DOMINATE</span> the Arena?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of battlers, producers, and fans in the ultimate hip-hop battle platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 px-8 py-3 text-lg">
                Start Your First Battle
              </Button>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8 py-3 text-lg">
                Watch Live Battles
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PremiumLayout>
  );
};
