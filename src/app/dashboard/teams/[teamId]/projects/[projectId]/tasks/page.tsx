import { redirect } from "next/navigation";
import { auth } from "../../../../../../../features/auth/auth";
import { prisma } from "../../../../../../../lib/prisma";
import { createTask } from "./actions";

export default async function CreateTaskPage({
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

  // Check that the user belongs to the team
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

  // Only leaders can create tasks
  if (teamMembership.role !== "LEADER") {
    redirect(`/dashboard/teams/${teamIdNumber}/projects/${projectIdNumber}`);
  }

  // Get the project and its members
  const project = await prisma.project.findUnique({
    where: {
      id: projectIdNumber,
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!project || project.teamId !== teamIdNumber) {
    return <div>Project not found</div>;
  }

  return (
    <form action={createTask}>
      <input type="hidden" name="teamId" value={teamIdNumber} />
      <input type="hidden" name="projectId" value={projectIdNumber} />

      <div>
        <label>Task title</label>
        <input name="title" required />
      </div>

      <div>
        <label>Description</label>
        <textarea name="description" />
      </div>

      <div>
        <label>Assign to</label>

        <select name="assignedTo" required>
          <option value="">Select member</option>

          {project.members.map((member) => (
            <option key={member.id} value={member.userId}>
              {member.user.name || member.user.email}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Priority</label>

        <select name="priority" defaultValue="MEDIUM">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>

      <div>
        <label>Deadline</label>
        <input type="datetime-local" name="deadline" />
      </div>

      <button type="submit">Create Task</button>
    </form>
  );
}
