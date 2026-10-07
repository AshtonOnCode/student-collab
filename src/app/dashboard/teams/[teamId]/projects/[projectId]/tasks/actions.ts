"use server";

import { redirect } from "next/navigation";
import { auth } from "../../../../../../../features/auth/auth";
import { prisma } from "../../../../../../../lib/prisma";

export async function createTask(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const teamId = Number(formData.get("teamId"));
  const projectId = Number(formData.get("projectId"));

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const assignedTo = Number(formData.get("assignedTo"));
  const priority = formData.get("priority") as "LOW" | "MEDIUM" | "HIGH";
  const deadline = formData.get("deadline") as string;

  // 1. Check that the current user is a team member
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

  // 2. Only leaders can create tasks
  if (teamMembership.role !== "LEADER") {
    throw new Error("Only leaders can create tasks");
  }

  // 3. Make sure the project actually belongs to this team
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });

  if (!project || project.teamId !== teamId) {
    throw new Error("Project not found");
  }

  // 4. Make sure the assignee belongs to this project
  const projectMembership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: assignedTo,
      },
    },
  });

  if (!projectMembership) {
    throw new Error("User is not a member of this project");
  }

  // 5. Create the task
  await prisma.task.create({
    data: {
      projectId,
      title,
      description: description || null,
      assignedTo,
      createdBy: session.user.id,
      priority,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  redirect(`/dashboard/teams/${teamId}/projects/${projectId}`);
}

async function getTaskContext(teamId: number, projectId: number, taskId: number) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

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

  const projectMembership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: session.user.id,
      },
    },
  });

  if (!projectMembership) {
    throw new Error("You are not a member of this project");
  }

  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
  });

  if (!task || task.projectId !== projectId) {
    throw new Error("Task not found");
  }

  return {
    session,
    teamMembership,
    projectMembership,
    task,
  };
}

export async function startTask(teamId: number, projectId: number, taskId: number) {
  const { session, task } = await getTaskContext(teamId, projectId, taskId);

  if (task.assignedTo !== session.user.id) {
    throw new Error("You are not assigned to this task");
  }

  if (task.status !== "TODO") {
    throw new Error("Task cannot be started");
  }

  await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      status: "IN_PROGRESS",
    },
  });
}

export async function submitTaskForReview(teamId: number, projectId: number, taskId: number) {
  const { session, task } = await getTaskContext(teamId, projectId, taskId);

  if (task.assignedTo !== session.user.id) {
    throw new Error("You are not assigned to this task");
  }

  if (task.status !== "IN_PROGRESS") {
    throw new Error("Task is not in progress");
  }

  await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      status: "READY_FOR_REVIEW",
    },
  });
}

export async function completeTask(teamId: number, projectId: number, taskId: number) {
  const { teamMembership, task } = await getTaskContext(teamId, projectId, taskId);

  // Only team leaders can confirm completion
  if (teamMembership.role !== "LEADER") {
    throw new Error("Only leaders can complete tasks");
  }

  // Task must be submitted for review
  if (task.status !== "READY_FOR_REVIEW") {
    throw new Error("Task is not ready for review");
  }

  await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      status: "COMPLETED",
    },
  });
}

export async function updateTask(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const teamId = Number(formData.get("teamId"));
  const projectId = Number(formData.get("projectId"));
  const taskId = Number(formData.get("taskId"));

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const assignedTo = Number(formData.get("assignedTo"));
  const priority = formData.get("priority") as "LOW" | "MEDIUM" | "HIGH";
  const deadline = formData.get("deadline") as string;

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

  // Only leaders can edit tasks
  if (teamMembership.role !== "LEADER") {
    throw new Error("Only leaders can edit tasks");
  }

  // Get the task
  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
  });

  if (!task || task.projectId !== projectId) {
    throw new Error("Task not found");
  }

  // Make sure the project belongs to this team
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });

  if (!project || project.teamId !== teamId) {
    throw new Error("Project not found");
  }

  // Make sure the new assignee belongs to the project
  const projectMembership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: assignedTo,
      },
    },
  });

  if (!projectMembership) {
    throw new Error("The selected user is not a member of this project");
  }

  await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      title,
      description: description || null,
      assignedTo,
      priority,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  redirect(`/dashboard/teams/${teamId}/projects/${projectId}`);
}

export async function deleteTask(teamId: number, projectId: number, taskId: number) {
  const { teamMembership, task } = await getTaskContext(teamId, projectId, taskId);

  if (teamMembership.role !== "LEADER") {
    throw new Error("Only leaders can delete tasks");
  }

  await prisma.task.delete({
    where: {
      id: task.id,
    },
  });
}
