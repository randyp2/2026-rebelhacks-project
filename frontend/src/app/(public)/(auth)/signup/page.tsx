import Link from "next/link";
import { signup, signInWithGoogle } from "@/lib/auth/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card text-foreground shadow-xl shadow-foreground/20">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Create Account</CardTitle>
          <CardDescription className="text-muted-foreground">Sign up to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name" className="text-foreground/90">First name</Label>
                <Input
                  id="first-name"
                  name="first-name"
                  placeholder="John"
                  className="border-border bg-background/60 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name" className="text-foreground/90">Last name</Label>
                <Input
                  id="last-name"
                  name="last-name"
                  placeholder="Doe"
                  className="border-border bg-background/60 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/90">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="border-border bg-background/60 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground/90">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                className="border-border bg-background/60 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Sign up
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <Separator className="flex-1 bg-accent/40" />
            <span className="text-sm text-muted-foreground">or</span>
            <Separator className="flex-1 bg-accent/40" />
          </div>

          <form action={signInWithGoogle}>
            <Button
              type="submit"
              variant="outline"
              className="w-full border-border bg-background/60 text-foreground hover:bg-accent hover:text-foreground"
            >
              Sign up with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/" className="text-primary underline hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
