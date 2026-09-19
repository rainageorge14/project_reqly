import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  Terminal,
  Bug,
  Lock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-white">
      <Navbar user={session} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-zinc-800/80 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          {/* Subtle grid background pattern */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#27272a15_1px,transparent_1px),linear-gradient(to_bottom,#27272a15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

          <div className="relative mx-auto max-w-4xl text-center">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Foundation Phase Available</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">Prisma & PostgreSQL Engine</span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              Test your APIs before your users do.
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              AI-powered API testing, security analysis, and failure intelligence
              — in one workspace.
            </p>

            {/* Call to Actions */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href={session ? "/dashboard" : "/signup"}>
                <Button
                  size="lg"
                  className="h-10 bg-zinc-100 px-5 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
                >
                  {session ? "Go to Dashboard" : "Get Started"}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href={session ? "/dashboard" : "/login"}>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-10 border-zinc-800 bg-zinc-900/60 px-5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white"
                >
                  View Demo
                </Button>
              </Link>
            </div>

            {/* Terminal Preview Card */}
            <div className="mt-14 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-left shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                  <span className="ml-2 font-mono text-[11px] text-zinc-500">
                    testpilot-cli — api-runner
                  </span>
                </div>
                <span className="font-mono text-[11px] text-zinc-600">
                  HTTP/1.1
                </span>
              </div>
              <div className="p-4 font-mono text-xs leading-loose text-zinc-300">
                <div className="flex items-center gap-2 text-zinc-500">
                  <span>$</span>
                  <span className="text-zinc-300">
                    testpilot test --target https://api.payments.internal
                  </span>
                </div>
                <div className="mt-2 text-zinc-400">
                  [1/4] <span className="text-emerald-400">GET</span> /v1/checkout/sessions{" "}
                  <span className="text-zinc-500">→</span> 200 OK{" "}
                  <span className="text-zinc-500">(42ms)</span>
                </div>
                <div className="text-zinc-400">
                  [2/4] <span className="text-emerald-400">POST</span> /v1/payment_intents{" "}
                  <span className="text-zinc-500">→</span> 201 CREATED{" "}
                  <span className="text-zinc-500">(88ms)</span>
                </div>
                <div className="text-zinc-400">
                  [3/4] <span className="text-amber-400">POST</span> /v1/refunds (unauthenticated){" "}
                  <span className="text-zinc-500">→</span> 401 UNAUTHORIZED{" "}
                  <span className="text-zinc-500">(31ms)</span>
                </div>
                <div className="text-zinc-400">
                  [4/4] <span className="text-emerald-400">GET</span> /v1/customers/:id/tokens{" "}
                  <span className="text-zinc-500">→</span> 200 OK{" "}
                  <span className="text-zinc-500">(54ms)</span>
                </div>
                <div className="mt-2 text-emerald-400">
                  ✔ 4 assertions evaluated • 0 regressions detected
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Pillars / Architecture Sections */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Platform Pillars
            </h2>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Engineered for robust API verification
            </p>
            <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-zinc-400">
              Designed around OpenAPI contracts, continuous test generation, and
              proactive security telemetry.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1 */}
            <div className="flex flex-col justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-5 transition-colors hover:border-zinc-700">
              <div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-indigo-400">
                  <Zap className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-100">
                  AI Test Generation
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Parses OpenAPI specifications to synthesize comprehensive
                  functional, boundary, and edge-case suites automatically.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
                <CheckCircle2 className="h-3 w-3 text-zinc-600" />
                Spec parsing & synthesis
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-5 transition-colors hover:border-zinc-700">
              <div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-emerald-400">
                  <Terminal className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-100">
                  Automated API Testing
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Executes scheduled or on-demand test runs against target
                  endpoints, validating response payloads, headers, and status
                  codes.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
                <CheckCircle2 className="h-3 w-3 text-zinc-600" />
                Deterministic test runners
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-5 transition-colors hover:border-zinc-700">
              <div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-amber-400">
                  <Lock className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-100">
                  Security Analysis
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Proactively tests for missing authentication, authorization
                  loopholes, sensitive data leaks, and OWASP API Top 10 flaws.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
                <CheckCircle2 className="h-3 w-3 text-zinc-600" />
                OWASP API security audits
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex flex-col justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-5 transition-colors hover:border-zinc-700">
              <div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-rose-400">
                  <Bug className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-100">
                  Failure Intelligence
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Pinpoints root causes of API anomalies, tracks latency
                  degradations, and aggregates audit trails for regression
                  analysis.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
                <CheckCircle2 className="h-3 w-3 text-zinc-600" />
                Root-cause triage telemetry
              </div>
            </div>
          </div>
        </section>

        {/* Developer CTA */}
        <section className="border-t border-zinc-800/80 bg-zinc-900/20 px-4 py-16 text-center sm:px-6">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Ready to verify your APIs?
            </h2>
            <p className="mt-2 text-xs text-zinc-400">
              Deploy TestPilot locally, connect your OpenAPI specs, and manage
              your services from a unified workspace.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/signup">
                <Button
                  size="sm"
                  className="bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
                >
                  Create Account
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 text-center text-xs text-zinc-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zinc-400" />
            <span className="font-medium text-zinc-300">TestPilot</span>
            <span className="text-zinc-600">—</span>
            <span>API Testing & Security Intelligence</span>
          </div>
          <p className="text-[11px] text-zinc-600">
            Phase 1: Foundation • PostgreSQL & Prisma Engine
          </p>
        </div>
      </footer>
    </div>
  );
}
