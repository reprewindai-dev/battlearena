"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GovernanceStats {
  total_plans: number;
  tier_distribution: {
    TIER1: number;
    TIER2: number;
    FALLBACK: number;
    BLOCKED: number;
  };
  persona_distribution: {
    Aggro: number;
    Turtle: number;
    Counter: number;
    Gambler: number;
  };
  drama_distribution: {
    close_win: number;
    close_loss: number;
    comeback: number;
    control_win: number;
    stomp_rare: number;
  };
  average_latency: number;
  average_cost: number;
  circuit_breaker_status: {
    state: string;
    failures: number;
    lastFailureTime: number;
  };
}

interface TelemetryMetrics {
  ttfm_p50: number;
  ttfm_p90: number;
  ttfm_p95: number;
  ttfm_p99: number;
  rematch_rate: number;
  rage_quit_rate: number;
  disconnect_rate: number;
  governance_block_rate: number;
  circuit_breaker_open_rate: number;
  fairness_violation_rate: number;
  total_matches: number;
  total_queue_enters: number;
}

interface RedTeamResult {
  id: string;
  simulation_type: string;
  run_date: string;
  vulnerabilities_found: number;
  policy_updates_required: number;
  results: any;
}

export function GovernanceDashboard() {
  const [stats, setStats] = useState<GovernanceStats | null>(null);
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null);
  const [redTeamResults, setRedTeamResults] = useState<RedTeamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Admin authentication required');
        return;
      }

      const [statsResponse, metricsResponse, redTeamResponse] = await Promise.all([
        fetch('/api/admin/governance?endpoint=stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/governance?endpoint=metrics', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/governance?endpoint=red-team', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!statsResponse.ok || !metricsResponse.ok || !redTeamResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [statsData, metricsData, redTeamData] = await Promise.all([
        statsResponse.json(),
        metricsResponse.json(),
        redTeamResponse.json()
      ]);

      setStats(statsData.data);
      setMetrics(metricsData.data);
      setRedTeamResults(redTeamData.data);

    } catch (error) {
      console.error('Dashboard load error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const runRedTeamSimulation = async (simulationType: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/governance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'run-red-team',
          simulation_type: simulationType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to run simulation');
      }

      await loadDashboardData(); // Refresh data

    } catch (error) {
      console.error('Red team simulation error:', error);
    }
  };

  const resetCircuitBreaker = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/governance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'reset-circuit-breaker' })
      });

      if (!response.ok) {
        throw new Error('Failed to reset circuit breaker');
      }

      await loadDashboardData();

    } catch (error) {
      console.error('Circuit breaker reset error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading governance dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadDashboardData}>Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Governance Dashboard</h1>
          <p className="text-gray-600">
            Monitor the Governed Hybrid Opponent System
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
            <TabsTrigger value="red-team">Red Team</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <h3 className="text-sm font-medium text-gray-600">Total Plans</h3>
                <div className="text-2xl font-bold">{stats?.total_plans || 0}</div>
              </Card>
              <Card className="p-4">
                <h3 className="text-sm font-medium text-gray-600">Avg Latency</h3>
                <div className="text-2xl font-bold">{stats?.average_latency || 0}ms</div>
              </Card>
              <Card className="p-4">
                <h3 className="text-sm font-medium text-gray-600">Avg Cost</h3>
                <div className="text-2xl font-bold">${(stats?.average_cost || 0).toFixed(4)}</div>
              </Card>
              <Card className="p-4">
                <h3 className="text-sm font-medium text-gray-600">Circuit Breaker</h3>
                <div className="text-2xl font-bold">
                  <Badge variant={stats?.circuit_breaker_status?.state === 'CLOSED' ? 'default' : 'destructive'}>
                    {stats?.circuit_breaker_status?.state || 'UNKNOWN'}
                  </Badge>
                </div>
              </Card>
            </div>

            {/* Tier Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Tier Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(stats?.tier_distribution || {}).map(([tier, count]) => (
                    <div key={tier} className="flex justify-between items-center">
                      <span className="font-medium">{tier}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(count / (stats?.total_plans || 1)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Persona Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(stats?.persona_distribution || {}).map(([persona, count]) => (
                    <div key={persona} className="flex justify-between items-center">
                      <span className="font-medium">{persona}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${(count / (stats?.total_plans || 1)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Drama Distribution */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Drama Archetype Distribution</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(stats?.drama_distribution || {}).map(([archetype, count]) => (
                  <div key={archetype} className="text-center">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-gray-600">{archetype.replace('_', ' ')}</div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="telemetry" className="space-y-6">
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">TTFM Metrics</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>P50:</span>
                    <span className="font-mono">{metrics?.ttfm_p50 || 0}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P90:</span>
                    <span className="font-mono">{metrics?.ttfm_p90 || 0}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P95:</span>
                    <span className="font-mono">{metrics?.ttfm_p95 || 0}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P99:</span>
                    <span className="font-mono">{metrics?.ttfm_p99 || 0}ms</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">User Behavior</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Rematch Rate:</span>
                    <span className="font-mono">{((metrics?.rematch_rate || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rage Quit Rate:</span>
                    <span className="font-mono text-red-600">{((metrics?.rage_quit_rate || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Disconnect Rate:</span>
                    <span className="font-mono">{((metrics?.disconnect_rate || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Matches:</span>
                    <span className="font-mono">{metrics?.total_matches || 0}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* System Health */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">System Health</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${(metrics?.governance_block_rate || 0) > 0.05 ? 'text-red-600' : 'text-green-600'}`}>
                    {((metrics?.governance_block_rate || 0) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Governance Block Rate</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${(metrics?.circuit_breaker_open_rate || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {metrics?.circuit_breaker_open_rate || 0}
                  </div>
                  <div className="text-sm text-gray-600">Circuit Breaker Opens/hr</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${(metrics?.fairness_violation_rate || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {metrics?.fairness_violation_rate || 0}
                  </div>
                  <div className="text-sm text-gray-600">Fairness Violations/hr</div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="red-team" className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Red Team Simulations</h3>
                <Button onClick={() => runRedTeamSimulation('WIN_SHAPING_DETECTION')}>
                  Run Win Shaping Test
                </Button>
              </div>
              
              <div className="space-y-4">
                {redTeamResults.map((result) => (
                  <div key={result.id} className="border rounded p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{result.simulation_type.replace('_', ' ')}</h4>
                      <div className="flex gap-2">
                        <Badge variant={result.vulnerabilities_found > 0 ? 'destructive' : 'default'}>
                          {result.vulnerabilities_found} vulnerabilities
                        </Badge>
                        <Badge variant={result.policy_updates_required > 0 ? 'outline' : 'default'}>
                          {result.policy_updates_required} updates needed
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Run: {new Date(result.run_date).toLocaleString()}
                    </div>
                  </div>
                ))}
                
                {redTeamResults.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No red team simulations run yet
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Admin Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={() => resetCircuitBreaker()} variant="outline">
                  Reset Circuit Breaker
                </Button>
                <Button onClick={() => runRedTeamSimulation('ABUSE_SIMULATION')} variant="outline">
                  Run Abuse Simulation
                </Button>
                <Button onClick={() => runRedTeamSimulation('DRAMA_PATTERN_EXPLOIT')} variant="outline">
                  Test Drama Pattern Exploit
                </Button>
                <Button onClick={() => runRedTeamSimulation('COST_SPIKE_DETECTION')} variant="outline">
                  Test Cost Spike Detection
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">System Status</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Plan Generation Latency Target:</span>
                  <span className={stats?.average_latency && stats.average_latency < 300 ? 'text-green-600' : 'text-red-600'}>
                    {stats?.average_latency || 0}ms / 300ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>TTFM P90 Target:</span>
                  <span className={metrics?.ttfm_p90 && metrics.ttfm_p90 < 15000 ? 'text-green-600' : 'text-red-600'}>
                    {metrics?.ttfm_p90 || 0}ms / 15000ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rage Quit Threshold:</span>
                  <span className={metrics?.rage_quit_rate && metrics.rage_quit_rate < 0.05 ? 'text-green-600' : 'text-red-600'}>
                    {((metrics?.rage_quit_rate || 0) * 100).toFixed(1)}% / 5%
                  </span>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
