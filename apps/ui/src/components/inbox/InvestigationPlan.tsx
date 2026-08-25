"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Circle, CircleAlert, CircleDotDashed, CircleX } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { EngineEvent } from "@/lib/types";

/**
 * The reference agent-plan component, kept to its exact visual and motion
 * language (status icon morphs, staggered subtask reveal, dashed connectors,
 * tool chips, springy badges) - but driven by the REAL run stream instead of
 * demo fixtures: tasks are the explorer scan, one investigation per candidate,
 * and the final ranking pass; the tool chips are the actual MCP tools each
 * step calls. Expansion is interactive; statuses are data, not toggles.
 */

type Status = "completed" | "in-progress" | "pending" | "need-help" | "failed";

interface Subtask {
  id: string;
  title: string;
  description: string;
  status: Status;
  tools?: string[];
}

interface Task {
  id: string;
  title: string;
  status: Status;
  badge: string;
  subtasks: Subtask[];
}

/** Fold the event stream into the plan's task model. */
function planFrom(events: EngineEvent[], streaming: boolean): Task[] {
  const tasks: Task[] = [];

  const explorer: Task = {
    id: "explore",
    title: "Scan the warehouse & propose hypotheses",
    status: "pending",
    badge: "queued",
    subtasks: [],
  };
  const candidates = new Map<string, Task>();
  let ranking: Task | null = null;

  for (const e of events) {
    if (e.kind === "run_started") {
      explorer.status = "in-progress";
      explorer.badge = "scanning";
    } else if (e.kind === "explorer_started") {
      explorer.status = "in-progress";
      explorer.badge = `${e.probeCount} probes`;
    } else if (e.kind === "memory_hit") {
      explorer.subtasks.push({
        id: `mem-${explorer.subtasks.length}`,
        title: `Recalled: ${e.subject}`,
        description: e.claim,
        status: "completed",
        tools: ["memory"],
      });
    } else if (e.kind === "planning") {
      explorer.subtasks.push({
        id: `plan-${explorer.subtasks.length}`,
        title: e.text,
        description: "Orchestrator planning step.",
        status: "completed",
      });
    } else if (e.kind === "hypothesis_proposed") {
      explorer.subtasks.push({
        id: `hyp-${explorer.subtasks.length}`,
        title: e.text,
        description: e.matchedProbe ? "Hypothesis matched a seeded probe." : "Novel hypothesis from the explorer.",
        status: "completed",
        tools: ["warehouse-mcp"],
      });
    } else if (e.kind === "candidate_started") {
      explorer.status = "completed";
      explorer.badge = "done";
      candidates.set(e.key, {
        id: e.key,
        title: e.title,
        status: "in-progress",
        badge: "investigating",
        subtasks: [
          {
            id: `${e.key}-query`,
            title: "Query the warehouse",
            description: "Pull segment metrics through the governed semantic layer.",
            status: "in-progress",
            tools: ["run_metric", "run_sql"],
          },
          {
            id: `${e.key}-verify`,
            title: "Verify against a holdout",
            description: "Awaiting the statistical verdict.",
            status: "pending",
            tools: ["verify_lift_claim"],
          },
        ],
      });
    } else if (e.kind === "candidate_verified") {
      const t = candidates.get(e.key);
      if (!t) continue;
      const map: Record<string, { status: Status; badge: string }> = {
        found: { status: "completed", badge: "found" },
        "rejected-trap": { status: "failed", badge: "rejected · trap" },
        "rejected-seasonal": { status: "failed", badge: "rejected · seasonal" },
        "needs-test": { status: "need-help", badge: "needs a test" },
      };
      const m = map[e.category] ?? { status: "completed" as Status, badge: e.category };
      t.status = m.status;
      t.badge = m.badge;
      const query = t.subtasks[0];
      const verify = t.subtasks[1];
      if (query) query.status = "completed";
      if (verify) {
        verify.status = m.status === "need-help" ? "need-help" : m.status === "failed" ? "failed" : "completed";
        verify.description = e.detail;
        verify.tools = e.category === "rejected-seasonal" ? ["assess_seasonality", "verify_lift_claim"] : ["verify_lift_claim"];
      }
      if (e.grounded != null) {
        t.subtasks.push({
          id: `${e.key}-grounded`,
          title: "Groundedness cross-check",
          description: e.grounded
            ? "An independent judge confirmed the claim is supported by the queries."
            : "Demoted: the claim was not supported by its own evidence.",
          status: e.grounded ? "completed" : "failed",
          tools: ["groundedness-judge"],
        });
      }
    } else if (e.kind === "prioritizing") {
      ranking = {
        id: "rank",
        title: "Rank what survived",
        status: "in-progress",
        badge: `${e.acceptedCount} verified`,
        subtasks: [
          {
            id: "rank-formula",
            title: e.formula,
            description: "Deterministic arithmetic - every rank is defensible number by number.",
            status: "in-progress",
          },
        ],
      };
    } else if (e.kind === "run_finished") {
      if (ranking) {
        ranking.status = "completed";
        ranking.badge = "ranked";
        const f = ranking.subtasks[0];
        if (f) f.status = "completed";
      }
      for (const t of candidates.values()) {
        if (t.status === "in-progress") t.status = "completed";
      }
    }
  }

  const out: Task[] = [];
  if (events.length === 0 && streaming) {
    explorer.status = "in-progress";
    explorer.badge = "starting";
  }
  out.push(explorer, ...candidates.values());
  if (ranking) out.push(ranking);
  return out;
}

const STATUS_BADGE: Record<Status, string> = {
  completed: "bg-ht-green-bg text-ht-green",
  "in-progress": "bg-ht-teal-tint text-ht-teal",
  "need-help": "bg-ht-warning-bg text-ht-warning",
  failed: "bg-ht-danger-bg text-ht-danger-text",
  pending: "bg-muted text-muted-foreground",
};

function StatusIcon({ status, size }: { status: Status; size: "task" | "subtask" }) {
  const cls = size === "task" ? "h-[18px] w-[18px]" : "h-3.5 w-3.5";
  if (status === "completed") return <CheckCircle2 className={`${cls} text-ht-green`} />;
  if (status === "in-progress") return <CircleDotDashed className={`${cls} text-ht-teal`} />;
  if (status === "need-help") return <CircleAlert className={`${cls} text-ht-warning`} />;
  if (status === "failed") return <CircleX className={`${cls} text-ht-danger`} />;
  return <Circle className={`${cls} text-muted-foreground`} />;
}

export function InvestigationPlan({ events, streaming }: { events: EngineEvent[]; streaming?: boolean }) {
  const tasks = useMemo(() => planFrom(events, Boolean(streaming)), [events, streaming]);
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  const prefersReducedMotion =
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedOverrides((prev) => {
      const current = prev[taskId] ?? defaultExpanded(taskId);
      return { ...prev, [taskId]: !current };
    });
  };

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // The task currently being worked expands itself; finished ones fold away.
  const defaultExpanded = (taskId: string) => tasks.find((t) => t.id === taskId)?.status === "in-progress";

  // Animation variants - verbatim from the reference.
  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: prefersReducedMotion ? ("tween" as const) : ("spring" as const),
        stiffness: 500,
        damping: 30,
        duration: prefersReducedMotion ? 0.2 : undefined,
      },
    },
  };
  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: {
      height: "auto",
      opacity: 1,
      overflow: "visible",
      transition: {
        duration: 0.25,
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        when: "beforeChildren" as const,
        ease: [0.2, 0.65, 0.3, 0.9] as const,
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      overflow: "hidden",
      transition: { duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] as const },
    },
  };
  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: prefersReducedMotion ? ("tween" as const) : ("spring" as const),
        stiffness: 500,
        damping: 25,
        duration: prefersReducedMotion ? 0.2 : undefined,
      },
    },
    exit: { opacity: 0, x: prefersReducedMotion ? 0 : -10, transition: { duration: 0.15 } },
  };
  const subtaskDetailsVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: {
      opacity: 1,
      height: "auto",
      overflow: "visible",
      transition: { duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] as const },
    },
  };
  const statusBadgeVariants = {
    initial: { scale: 1 },
    animate: {
      scale: prefersReducedMotion ? 1 : [1, 1.08, 1],
      transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] as const },
    },
  };

  return (
    <LayoutGroup>
      <ul className="space-y-1 overflow-hidden" aria-live="polite">
        {tasks.map((task, index) => {
          const isExpanded = expandedOverrides[task.id] ?? task.status === "in-progress";

          return (
            <motion.li
              key={task.id}
              className={index !== 0 ? "mt-1 pt-2" : ""}
              initial="hidden"
              animate="visible"
              variants={taskVariants}
            >
              {/* Task row */}
              <motion.div
                className="group flex items-center rounded-md px-1 py-1.5"
                whileHover={{ backgroundColor: "rgba(0,0,0,0.03)", transition: { duration: 0.2 } }}
              >
                <div className="mr-2 flex-shrink-0">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={task.status}
                      initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                      transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
                    >
                      <StatusIcon status={task.status} size="task" />
                    </motion.div>
                  </AnimatePresence>
                </div>

                <motion.div
                  className="flex min-w-0 flex-grow cursor-pointer items-center justify-between"
                  onClick={() => toggleTaskExpansion(task.id)}
                >
                  <div className="mr-2 flex-1 truncate text-sm">
                    <span className={task.status === "completed" ? "text-muted-foreground" : "text-foreground"}>
                      {task.title}
                    </span>
                  </div>
                  <motion.span
                    className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_BADGE[task.status]}`}
                    variants={statusBadgeVariants}
                    initial="initial"
                    animate="animate"
                    key={task.badge}
                  >
                    {task.badge}
                  </motion.span>
                </motion.div>
              </motion.div>

              {/* Subtasks - staggered */}
              <AnimatePresence mode="wait">
                {isExpanded && task.subtasks.length > 0 && (
                  <motion.div
                    className="relative overflow-hidden"
                    variants={subtaskListVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                  >
                    {/* Vertical connecting line aligned with task icon */}
                    <div className="absolute bottom-0 left-[9px] top-0 border-l-2 border-dashed border-muted-foreground/30" />
                    <ul className="mb-1.5 ml-1 mr-2 mt-1 space-y-0.5">
                      {task.subtasks.map((subtask) => {
                        const subtaskKey = `${task.id}-${subtask.id}`;
                        const isSubtaskExpanded = expandedSubtasks[subtaskKey];

                        return (
                          <motion.li
                            key={subtask.id}
                            className="group flex flex-col py-0.5 pl-5"
                            onClick={() => toggleSubtaskExpansion(task.id, subtask.id)}
                            variants={subtaskVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                          >
                            <motion.div
                              className="flex flex-1 cursor-pointer items-center rounded-md p-1"
                              whileHover={{ backgroundColor: "rgba(0,0,0,0.03)", transition: { duration: 0.2 } }}
                              layout
                            >
                              <div className="mr-2 flex-shrink-0">
                                <AnimatePresence mode="wait">
                                  <motion.div
                                    key={subtask.status}
                                    initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                                    transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
                                  >
                                    <StatusIcon status={subtask.status} size="subtask" />
                                  </motion.div>
                                </AnimatePresence>
                              </div>
                              <span
                                className={`cursor-pointer text-[13px] ${
                                  subtask.status === "completed" ? "text-muted-foreground" : "text-foreground/90"
                                }`}
                              >
                                {subtask.title}
                              </span>
                            </motion.div>

                            <AnimatePresence mode="wait">
                              {isSubtaskExpanded && (
                                <motion.div
                                  className="ml-1.5 mt-1 overflow-hidden border-l border-dashed border-foreground/20 pl-5 text-xs text-muted-foreground"
                                  variants={subtaskDetailsVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="hidden"
                                  layout
                                >
                                  <p className="py-1">{subtask.description}</p>
                                  {subtask.tools && subtask.tools.length > 0 && (
                                    <div className="mb-1 mt-0.5 flex flex-wrap items-center gap-1.5">
                                      <span className="font-medium text-muted-foreground">MCP tools:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {subtask.tools.map((tool, idx) => (
                                          <motion.span
                                            key={idx}
                                            className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-secondary-foreground shadow-sm"
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: idx * 0.05 } }}
                                            whileHover={{
                                              y: -1,
                                              backgroundColor: "rgba(0,0,0,0.1)",
                                              transition: { duration: 0.2 },
                                            }}
                                          >
                                            {tool}
                                          </motion.span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>
    </LayoutGroup>
  );
}
