import { redirect } from "next/navigation";
import { auth } from "../../../../../../features/auth/auth";
import { prisma } from "../../../../../../lib/prisma";
import { createProject } from "./action";

export default async function CreateProjectPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { teamId } = await params;
  const id = Number(teamId);

  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: id,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  if (membership.role !== "LEADER") {
    redirect(`/dashboard/teams/${id}`);
  }
  const team = await prisma.team.findUnique({
    where: {
      id,
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!team) {
    return <div>Team not found</div>;
  }
  return (
    <form action={createProject}>
      <input type="hidden" name="teamId" value={id} />

      <div>
        <label>Project name</label>
        <input name="name" required />
      </div>

      <div>
        <label>Description</label>
        <textarea name="description" />
      </div>

      <div>
        <label>Deadline</label>
        <input type="datetime-local" name="deadline" />
      </div>

      {team.members.map((member) => (
        <label key={member.id}>
          <input type="checkbox" name="memberIds" value={member.userId} />

          {member.user.name || member.user.email}
        </label>
      ))}

      <button type="submit">Create Project</button>
    </form>
  );
}
