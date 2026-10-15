import { redirect } from "next/navigation";
import { auth } from "../../../../../../features/auth/auth";
import { prisma } from "../../../../../../lib/prisma";
import MessageList from "./components/message-list";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{
    teamId: string;
    channelId: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { teamId, channelId } = await params;

  const teamIdNumber = Number(teamId);
  const channelIdNumber = Number(channelId);

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

  const channel = await prisma.channel.findUnique({
    where: {
      id: channelIdNumber,
    },
    include: {
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 31,
        include: {
          sender: true,
        },
      },
    },
  });

  if (!channel || channel.teamId !== teamIdNumber || channel.type !== "TEAM") {
    return <div>Channel not found</div>;
  }

  const messages = [...channel.messages].reverse();

  return (
    <div>
      <h1>#{channel.name}</h1>

      <div>
        <MessageList
          key={channelId}
          initialMessages={messages}
          teamId={teamIdNumber}
          channelId={channelIdNumber}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
