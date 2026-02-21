import { Suspense } from "react";

import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DashboardFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Suspense fallback={<DashboardFallback />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

