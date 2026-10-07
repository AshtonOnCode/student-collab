"use server";

import { auth } from "../../../../features/auth/auth";
import { prisma } from "../../../../lib/prisma";

export async function promoteMember(teamId: number, memberId: number) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Check whether the current user is a leader
  const currentMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: session.user.id,
      },
    },
  });

  if (!currentMember) {
    throw new Error("You are not a member of this team");
  }

  if (currentMember.role !== "LEADER") {
    throw new Error("Only leaders can promote members");
  }

  // Find the member we want to promote
  const member = await prisma.teamMember.findUnique({
    where: {
      id: memberId,
    },
  });

  if (!member || member.teamId !== teamId) {
    throw new Error("Member not found");
  }

  // Promote them
  await prisma.teamMember.update({
    where: {
      id: memberId,
    },
    data: {
      role: "LEADER",
    },
  });
}

export async function removeMember(teamId: number, memberId: number) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Check current user's membership
  const currentMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: session.user.id,
      },
    },
  });

  if (!currentMember) {
    throw new Error("You are not a member of this team");
  }

  // Only leaders can remove members
  if (currentMember.role !== "LEADER") {
    throw new Error("Only leaders can remove members");
  }

  // Find the member being removed
  const member = await prisma.teamMember.findUnique({
    where: {
      id: memberId,
    },
  });

  if (!member || member.teamId !== teamId) {
    throw new Error("Member not found");
  }

  if (member.role === "LEADER") {
    const leaderCount = await prisma.teamMember.count({
      where: {
        teamId,
        role: "LEADER",
      },
    });

    if (leaderCount === 1) {
      throw new Error("A team must have at least one leader");
    }
  }

  await prisma.teamMember.delete({
    where: {
      id: memberId,
    },
  });
}
