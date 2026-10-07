"use server";

import { redirect } from "next/navigation";
import { auth } from "../../../../features/auth/auth";
import { prisma } from "../../../../lib/prisma";

export async function joinTeam(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const joinCode = formData.get("joinCode") as string;

  if (!joinCode?.trim()) {
    throw new Error("Join code is required");
  }

  const team = await prisma.team.findUnique({
    where: {
      joinCode: joinCode.trim().toUpperCase(),
    },
  });

  if (!team) {
    throw new Error("Team not found");
  }

  const existingMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: team.id,
        userId: session.user.id,
      },
    },
  });

  if (existingMember) {
    throw new Error("You are already a member of this team");
  }

  await prisma.teamMember.create({
    data: {
      teamId: team.id,
      userId: session.user.id,
      role: "MEMBER",
    },
  });

  redirect(`/dashboard/teams/${team.id}`);
}
