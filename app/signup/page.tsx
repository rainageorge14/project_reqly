"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected network error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100 selection:bg-zinc-800 selection:text-white sm:px-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-sm">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              TestPilot
            </span>
          </Link>
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-white">
            Create your account
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Start testing endpoints and discovering security regressions
          </p>
        </div>

        {/* Form Card */}
        <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="name"
                className="text-xs font-medium text-zinc-300"
              >
                Full Name
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-500">
                  <User className="h-3.5 w-3.5" />
                </div>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="h-9 border-zinc-800 bg-zinc-900/80 pl-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-700"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-medium text-zinc-300"
              >
                Email address
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-500">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="ada@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-9 border-zinc-800 bg-zinc-900/80 pl-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-700"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-medium text-zinc-300"
              >
                Password
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-500">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters with letters & numbers"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-9 border-zinc-800 bg-zinc-900/80 pl-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-700"
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                Must be at least 8 characters and include letters & numbers.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-9 w-full bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
            >
              {loading ? "Creating account..." : "Create account"}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </form>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-xs text-zinc-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-zinc-300 underline underline-offset-4 hover:text-white"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
