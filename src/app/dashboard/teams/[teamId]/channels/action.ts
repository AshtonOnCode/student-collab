"use server";

import { redirect } from "next/navigation";
import { prisma } from "../../../../../lib/prisma";
import { auth } from "../../../../../features/auth/auth";

export async function createChannel(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const teamId = Number(formData.get("teamId"));
  const projectIdValue = formData.get("projectId");
  const name = formData.get("name") as string;
  const type = formData.get("type") as "TEAM" | "PROJECT";

  const projectId = projectIdValue && projectIdValue !== "" ? Number(projectIdValue) : null;

  // Check team membership
  const teamMembership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: session.user.id,
      },
    },
  });

  if (!teamMembership) {
    throw new Error("You are not a member of this team");
  }

  // Only leaders can create channels
  if (teamMembership.role !== "LEADER") {
    throw new Error("Only leaders can create channels");
  }

  if (!name.trim()) {
    throw new Error("Channel name is required");
  }

  // Team channel
  if (type === "TEAM") {
    await prisma.channel.create({
      data: {
        teamId,
        name: name.trim(),
        type: "TEAM",
      },
    });

    redirect(`/dashboard/teams/${teamId}`);
  }

  // Project channel
  if (type === "PROJECT") {
    if (!projectId) {
      throw new Error("Project is required");
    }

    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project || project.teamId !== teamId) {
      throw new Error("Project not found");
    }

    await prisma.channel.create({
      data: {
        teamId,
        projectId,
        name: name.trim(),
        type: "PROJECT",
      },
    });

    redirect(`/dashboard/teams/${teamId}/projects/${projectId}`);
  }

  throw new Error("Invalid channel type");
}
