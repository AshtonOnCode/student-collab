"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startTask, submitTaskForReview, completeTask, deleteTask } from "../tasks/actions";
import Link from "next/link";

export default function TaskActions({
  teamId,
  projectId,
  taskId,
  status,
  isAssignedUser,
  isLeader,
}: {
  teamId: number;
  projectId: number;
  taskId: number;
  status: string;
  isAssignedUser: boolean;
  isLeader: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function runAction(action: () => Promise<void>) {
    setError("");

    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Something went wrong");
      }
    });
  }

  return (
    <div>
      {isAssignedUser && status === "TODO" && (
        <button
          disabled={isPending}
          onClick={() => runAction(() => startTask(teamId, projectId, taskId))}
        >
          {isPending ? "Starting..." : "Start Task"}
        </button>
      )}

      {isAssignedUser && status === "IN_PROGRESS" && (
        <button
          disabled={isPending}
          onClick={() => runAction(() => submitTaskForReview(teamId, projectId, taskId))}
        >
          {isPending ? "Submitting..." : "Submit for Review"}
        </button>
      )}

      {isLeader && status === "READY_FOR_REVIEW" && (
        <button
          disabled={isPending}
          onClick={() => runAction(() => completeTask(teamId, projectId, taskId))}
        >
          {isPending ? "Completing..." : "Complete Task"}
        </button>
      )}

      {isLeader && (
        <Link href={`/dashboard/teams/${teamId}/projects/${projectId}/tasks/${taskId}/edit`}>
          Edit Task
        </Link>
      )}

      {isLeader && (
        <button
          disabled={isPending}
          onClick={() => {
            if (!confirm("Are you sure you want to delete this task?")) {
              return;
            }

            runAction(() => deleteTask(teamId, projectId, taskId));
          }}
        >
          {isPending ? "Deleting..." : "Delete Task"}
        </button>
      )}

      {error && <p>{error}</p>}
    </div>
  );
}
