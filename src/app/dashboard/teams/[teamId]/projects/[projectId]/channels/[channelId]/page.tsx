import { redirect } from "next/navigation";
import { auth } from "../../../../../../../../features/auth/auth";
import { prisma } from "../../../../../../../../lib/prisma";
import MessageList from "../../../../channels/[channelId]/components/message-list";

export default async function ProjectChannelPage({
  params,
}: {
  params: Promise<{
    teamId: string;
    projectId: string;
    channelId: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { teamId, projectId, channelId } = await params;

  const teamIdNumber = Number(teamId);
  const projectIdNumber = Number(projectId);
  const channelIdNumber = Number(channelId);

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

  const channel = await prisma.channel.findUnique({
    where: {
      id: channelIdNumber,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        take: 31,
        include: {
          sender: true,
        },
      },
    },
  });

  if (
    !channel ||
    channel.teamId !== teamIdNumber ||
    channel.projectId !== projectIdNumber ||
    channel.type !== "PROJECT"
  ) {
    return <div>Channel not found</div>;
  }

  const messages = [...channel.messages].reverse();

  return (
    <div>
      <h1>#{channel.name}</h1>

      <MessageList initialMessages={messages} teamId={teamIdNumber} channelId={channelIdNumber} />
    </div>
  );
}
