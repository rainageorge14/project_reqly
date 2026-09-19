"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileCode2,
  FlaskConical,
  PlayCircle,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface ProjectWorkspaceTabsProps {
  projectId: string;
}

export function ProjectWorkspaceTabs({ projectId }: ProjectWorkspaceTabsProps) {
  const pathname = usePathname();

  const tabs = [
    {
      label: "Overview",
      href: `/projects/${projectId}`,
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: "API Explorer",
      href: `/projects/${projectId}/import`,
      icon: FileCode2,
    },
    {
      label: "Test Cases",
      href: `/projects/${projectId}/tests`,
      icon: FlaskConical,
    },
    {
      label: "Runs",
      href: `/projects/${projectId}/runs`,
      icon: PlayCircle,
    },
    {
      label: "Security",
      href: `/projects/${projectId}/security`,
      icon: ShieldAlert,
    },
    {
      label: "AI Analysis",
      href: `/projects/${projectId}/ai-analysis`,
      icon: Sparkles,
    },
  ];

  return (
    <div className="flex border-b border-zinc-800/80">
      <nav className="-mb-px flex space-x-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-zinc-100 text-white"
                  : "border-transparent text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
