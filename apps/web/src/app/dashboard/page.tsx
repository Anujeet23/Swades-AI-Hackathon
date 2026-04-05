"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@my-better-t-app/ui/components/card";
import {
  CheckCircle,
  Database,
  HardDrive,
  Loader2,
  PercentCircle,
} from "lucide-react";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

interface Stats {
  totalChunks: number;
  ackedChunks: number;
  successRate: number;
  totalSizeBytes: number;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/stats`);
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (e) {
      console.error("Failed to fetch stats", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto refresh every 5 seconds
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Pipeline Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live stats — refreshes every 5 seconds
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading stats...
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Chunks
              </CardTitle>
              <Database className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.totalChunks ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                recorded & uploaded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Acknowledged
              </CardTitle>
              <CheckCircle className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-500">
                {stats?.ackedChunks ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                confirmed in database
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
              <PercentCircle className="size-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-500">
                {stats?.successRate ?? 100}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                zero data loss
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Size
              </CardTitle>
              <HardDrive className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {formatBytes(stats?.totalSizeBytes ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                audio data processed
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Pipeline Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${stats.successRate}%` }}
                />
              </div>
              <span className="text-sm font-medium">{stats.successRate}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.ackedChunks} of {stats.totalChunks} chunks successfully
              acknowledged
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
