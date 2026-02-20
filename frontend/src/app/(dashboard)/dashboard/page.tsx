import { createServerSupabaseClient } from "@/utils/supabase/server";
import { signout } from "@/lib/auth/auth-actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user || error) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Name:</span>{" "}
              {user.user_metadata?.full_name ?? "N/A"}
            </p>
            <p>
              <span className="font-medium">Email:</span> {user.email}
            </p>
          </div>
          <form action={signout}>
            <Button type="submit" variant="destructive" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
