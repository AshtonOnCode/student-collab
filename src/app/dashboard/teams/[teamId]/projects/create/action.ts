"use server";

import { redirect } from "next/navigation";
import { prisma } from "../../../../../../lib/prisma";
import { auth } from "../../../../../../features/auth/auth";

export async function createProject(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const teamId = Number(formData.get("teamId"));
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const deadline = formData.get("deadline") as string;

  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    throw new Error("You are not a member of this team");
  }

  if (membership.role !== "LEADER") {
    throw new Error("Only leaders can create projects");
  }

  const memberIds = formData.getAll("memberIds").map(Number);

  const projectMemberIds = Array.from(new Set([...memberIds, session.user.id]));

  const teamMembers = await prisma.teamMember.findMany({
    where: {
      teamId,
    },
    select: {
      userId: true,
    },
  });

  const validUserIds = teamMembers.map((member) => member.userId);

  const allMembersBelongToTeam = memberIds.every((userId) => validUserIds.includes(userId));

  if (!allMembersBelongToTeam) {
    throw new Error("One or more selected users are not members of this team");
  }

  const project = await prisma.project.create({
    data: {
      teamId,
      name,
      description: description || null,
      deadline: deadline ? new Date(deadline) : null,
      createdBy: session.user.id,
    },
  });

  await prisma.projectMember.createMany({
    data: projectMemberIds.map((userId) => ({
      projectId: project.id,
      userId,
    })),
  });

  redirect(`/dashboard/teams/${teamId}/projects/${project.id}`);
}
