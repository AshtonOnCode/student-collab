import { redirect } from "next/navigation";
import { auth } from "../../../../../features/auth/auth";
import { prisma } from "../../../../../lib/prisma";
import { createChannel } from "./action";

export default async function CreateChannelPage({
  params,
}: {
  params: Promise<{
    teamId: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { teamId } = await params;
  const teamIdNumber = Number(teamId);

  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: teamIdNumber,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  if (membership.role !== "LEADER") {
    redirect(`/dashboard/teams/${teamIdNumber}`);
  }

  const projects = await prisma.project.findMany({
    where: {
      teamId: teamIdNumber,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div>
      <h1>Create Channel</h1>

      <form action={createChannel}>
        <input type="hidden" name="teamId" value={teamIdNumber} />

        <div>
          <label>Channel name</label>
          <input name="name" placeholder="e.g. general" required />
        </div>

        <div>
          <label>Channel type</label>

          <select name="type" defaultValue="TEAM">
            <option value="TEAM">Team</option>
            <option value="PROJECT">Project</option>
          </select>
        </div>

        <div>
          <label>Project</label>

          <select name="projectId" defaultValue="">
            <option value="">Select project</option>

            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Create Channel</button>
      </form>
    </div>
  );
}
