"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { promoteMember, removeMember } from "../actions";

export default function MemberActions({ teamId, memberId }: { teamId: number; memberId: number }) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handlePromote() {
    setError("");

    startTransition(async () => {
      try {
        await promoteMember(teamId, memberId);
        router.refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Something went wrong");
      }
    });
  }

  function handleRemove() {
    setError("");

    startTransition(async () => {
      try {
        await removeMember(teamId, memberId);
        router.refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Something went wrong");
      }
    });
  }

  return (
    <div>
      <button onClick={handlePromote} disabled={isPending}>
        {isPending ? "Promoting..." : "Promote"}
      </button>

      <button onClick={handleRemove} disabled={isPending}>
        {isPending ? "Removing..." : "Remove"}
      </button>

      {error && <p>{error}</p>}
    </div>
  );
}
