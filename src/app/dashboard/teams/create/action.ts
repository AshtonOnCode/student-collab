"use server";

import { redirect } from "next/navigation";
import { auth } from "../../../../features/auth/auth";
import { prisma } from "../../../../lib/prisma";

export async function createTeam(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!name.trim()) {
    throw new Error("Team name is required");
  }

  const team = await prisma.team.create({
    data: {
      name,
      description,
      joinCode: crypto.randomUUID().slice(0, 6).toUpperCase(),
      createdBy: session.user.id,
    },
  });

  await prisma.teamMember.create({
    data: {
      teamId: team.id,
      userId: session.user.id,
      role: "LEADER",
    },
  });

  redirect(`/dashboard/teams/${team.id}`);
}
