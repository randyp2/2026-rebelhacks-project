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
    <div className="dark flex min-h-screen items-center justify-center bg-[#07090f] p-4">
      <Card className="w-full max-w-md border-white/10 bg-[#0f1623] text-slate-100 shadow-xl shadow-black/30">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-100">Create Account</CardTitle>
          <CardDescription className="text-slate-400">Sign up to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name" className="text-slate-300">First name</Label>
                <Input
                  id="first-name"
                  name="first-name"
                  placeholder="John"
                  className="border-white/10 bg-[#0a101b] text-slate-200 placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name" className="text-slate-300">Last name</Label>
                <Input
                  id="last-name"
                  name="last-name"
                  placeholder="Doe"
                  className="border-white/10 bg-[#0a101b] text-slate-200 placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="border-white/10 bg-[#0a101b] text-slate-200 placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                className="border-white/10 bg-[#0a101b] text-slate-200 placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-500">
              Sign up
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <Separator className="flex-1 bg-white/10" />
            <span className="text-sm text-slate-500">or</span>
            <Separator className="flex-1 bg-white/10" />
          </div>

          <form action={signInWithGoogle}>
            <Button
              type="submit"
              variant="outline"
              className="w-full border-white/15 bg-[#0a101b] text-slate-200 hover:bg-[#111a29] hover:text-slate-100"
            >
              Sign up with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/" className="text-blue-400 underline hover:text-blue-300">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
