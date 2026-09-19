import { notFound } from "next/navigation";
import { ShieldAlert, Info } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";

interface SecurityPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectSecurityPage({ params }: SecurityPageProps) {
  const user = await requireAuth();
  const { projectId } = await params;

  const project = await getProjectById(projectId, user.id);
  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Information Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-4 text-xs text-zinc-400">
        <Info className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
        <div>
          <span className="font-medium text-zinc-200">
            Security Intelligence Engine
          </span>
          <p className="mt-0.5 leading-relaxed">
            Automated checks for broken object-level authorization (BOLA),
            missing authentication headers, sensitive data exposure, and CORS
            misconfigurations will report findings into this ledger.
          </p>
        </div>
      </div>

      {/* Proper Empty State */}
      <EmptyState
        icon={ShieldAlert}
        title="No security vulnerabilities detected"
        description="Automated security inspections have not been executed on this service target yet."
        secondaryAction={
          <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] text-zinc-500">
            OWASP Scan Engine • Ready for Security Phase
          </div>
        }
      />
    </div>
  );
}
