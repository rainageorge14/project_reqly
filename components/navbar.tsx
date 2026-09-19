"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck, LogOut, LayoutDashboard, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  user?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            href={user ? "/dashboard" : "/"}
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">
                Reqly
              </span>
              <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                preview
              </span>
            </div>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  pathname === "/dashboard"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
            </nav>
          )}
        </div>

        {/* Right side Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300">
                <User className="h-3.5 w-3.5 text-zinc-500" />
                <span className="max-w-[160px] truncate font-medium">
                  {user.name || user.email}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="h-8 border-zinc-800 bg-zinc-900/80 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                {isLoggingOut ? "Logging out..." : "Log out"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white"
                >
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button
                  size="sm"
                  className="h-8 bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
