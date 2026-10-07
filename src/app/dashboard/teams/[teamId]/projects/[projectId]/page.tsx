import { redirect } from "next/navigation";
import { auth } from "../../../../../../features/auth/auth";
import { prisma } from "../../../../../../lib/prisma";
import TaskActions from "./components/task-actions";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{
    teamId: string;
    projectId: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { teamId, projectId } = await params;

  const teamIdNumber = Number(teamId);
  const projectIdNumber = Number(projectId);

  const teamMembership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: teamIdNumber,
        userId: session.user.id,
      },
    },
  });

  if (!teamMembership) {
    redirect("/dashboard");
  }

  const projectMembership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: projectIdNumber,
        userId: session.user.id,
      },
    },
  });

  if (!projectMembership) {
    redirect(`/dashboard/teams/${teamIdNumber}`);
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectIdNumber,
    },
    include: {
      creator: true,
      members: {
        include: {
          user: true,
        },
      },
      tasks: {
        include: {
          assignee: true,
        },
      },
      channels: true,
    },
  });

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <div>
      <h1>{project.name}</h1>

      <p>{project.description}</p>

      <p>Created by: {project.creator.name || project.creator.email}</p>

      <h2>Members</h2>

      {project.members.map((member) => (
        <div key={member.id}>{member.user.name || member.user.email}</div>
      ))}

      <h2>Tasks</h2>
      <p>{project.tasks.length} tasks</p>

      <h2>Channels</h2>
      <p>{project.channels.length} channels</p>

      <h2>Tasks</h2>

      {teamMembership.role === "LEADER" && (
        <a href={`/dashboard/teams/${teamIdNumber}/projects/${projectIdNumber}/tasks/create`}>
          Create Task
        </a>
      )}

      {project.tasks.length === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        project.tasks.map((task) => (
          <div key={task.id}>
            <h3>{task.title}</h3>

            {task.description && <p>{task.description}</p>}

            <p>Status: {task.status}</p>
            <p>Priority: {task.priority}</p>

            <TaskActions
              teamId={teamIdNumber}
              projectId={projectIdNumber}
              taskId={task.id}
              status={task.status}
              isAssignedUser={task.assignedTo === session.user.id}
              isLeader={teamMembership.role === "LEADER"}
            />
          </div>
        ))
      )}
    </div>
  );
}
