import { redirect } from "next/navigation";
import { auth } from "../../../../../../../../../features/auth/auth";
import { prisma } from "../../../../../../../../../lib/prisma";
import { updateTask } from "../../actions";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{
    teamId: string;
    projectId: string;
    taskId: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { teamId, projectId, taskId } = await params;

  const teamIdNumber = Number(teamId);
  const projectIdNumber = Number(projectId);
  const taskIdNumber = Number(taskId);

  // Check that the current user belongs to the team
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

  // Only leaders can edit tasks
  if (teamMembership.role !== "LEADER") {
    redirect(`/dashboard/teams/${teamIdNumber}/projects/${projectIdNumber}`);
  }

  // Get the task
  const task = await prisma.task.findUnique({
    where: {
      id: taskIdNumber,
    },
  });

  if (!task || task.projectId !== projectIdNumber) {
    return <div>Task not found</div>;
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
    <div>
      <h1>Edit Task</h1>

      <form action={updateTask}>
        <input type="hidden" name="teamId" value={teamIdNumber} />

        <input type="hidden" name="projectId" value={projectIdNumber} />

        <input type="hidden" name="taskId" value={taskIdNumber} />

        <div>
          <label>Task title</label>
          <input name="title" defaultValue={task.title} required />
        </div>

        <div>
          <label>Description</label>
          <textarea name="description" defaultValue={task.description ?? ""} />
        </div>

        <div>
          <label>Assign to</label>

          <select name="assignedTo" defaultValue={task.assignedTo ?? ""} required>
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

          <select name="priority" defaultValue={task.priority}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>

        <div>
          <label>Deadline</label>

          <input
            type="datetime-local"
            name="deadline"
            defaultValue={task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : ""}
          />
        </div>

        <button type="submit">Save Changes</button>
      </form>
    </div>
  );
}
