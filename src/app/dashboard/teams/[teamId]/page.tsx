import { redirect } from "next/navigation";
import { auth } from "../../../../features/auth/auth";
import { prisma } from "../../../../lib/prisma";
import MemberActions from "./membership/member-actions";

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { teamId } = await params;
  const teamIdNumber = Number(teamId);

  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: Number(teamId),
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  const isLeader = membership.role === "LEADER";

  const team = await prisma.team.findUnique({
    where: {
      id: teamIdNumber,
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
      projects: true,
      channels: {
        where: {
          type: "TEAM",
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!team) {
    return <div>Team not found</div>;
  }

  return (
    <div>
      <h1>{team.name}</h1>
      <p>{team.description}</p>
      <p>Join Code: {team.joinCode}</p>

      <h2>Members</h2>

      {team.members.map((member) => (
        <div key={member.id}>
          <p>
            {member.user.name} — {member.role}
          </p>

          {isLeader && member.userId !== session.user.id && (
            <MemberActions teamId={team.id} memberId={member.id} />
          )}
        </div>
      ))}

      <div>
        <h2>Projects</h2>

        {membership.role === "LEADER" && (
          <a href={`/dashboard/teams/${team.id}/projects/create`}>Create Project</a>
        )}
      </div>

      {team.projects.map((project) => (
        <div key={project.id}>
          <a href={`/dashboard/teams/${team.id}/projects/${project.id}`}>{project.name}</a>

          {project.description && <p>{project.description}</p>}
        </div>
      ))}

      <h2>Channels</h2>

      {team.channels.map((channel) => (
        <div key={channel.id}>
          <a href={`/dashboard/teams/${teamIdNumber}/channels/${channel.id}`}>#{channel.name}</a>
        </div>
      ))}

      {membership.role === "LEADER" && (
        <a href={`/dashboard/teams/${teamIdNumber}/channels/`}>Create Channel</a>
      )}
    </div>
  );
}
