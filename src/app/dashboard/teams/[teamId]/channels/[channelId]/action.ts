"use server";

import { redirect } from "next/navigation";
import { auth } from "../../../../../../features/auth/auth";
import { prisma } from "../../../../../../lib/prisma";

export async function sendMessage(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const teamId = Number(formData.get("teamId"));
  const channelId = Number(formData.get("channelId"));
  const content = formData.get("content") as string;

  if (!content?.trim()) {
    throw new Error("Message cannot be empty");
  }

  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    throw new Error("You are not a member of this team");
  }

  const channel = await prisma.channel.findUnique({
    where: {
      id: channelId,
    },
  });

  if (!channel || channel.teamId !== teamId || channel.type !== "TEAM") {
    throw new Error("Channel not found");
  }

  const message = await prisma.message.create({
    data: {
      channelId,
      senderId: session.user.id,
      content: content.trim(),
    },
    include: {
      sender: true,
    },
  });

  // Broadcast the saved message through Socket.IO.
  // A broadcast failure must not undo the database write.

  const socketSecret = process.env.SOCKET_INTERNAL_SECRET;

  if (!socketSecret) {
    console.error("SOCKET_INTERNAL_SECRET is not configured");
  } else {
    try {
      const response = await fetch("http://localhost:3001/internal/broadcast-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": socketSecret,
        },
        body: JSON.stringify({
          channelId,
          message,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        console.error("Message saved, but Socket.IO broadcast failed:", response.status);
      }
    } catch (error) {
      console.error("Message saved, but Socket.IO broadcast was unavailable:", error);
    }
  }

  return message;
}

export async function getOlderMessages(teamId: number, channelId: number, cursor: number) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    throw new Error("You are not a member of this team");
  }

  const channel = await prisma.channel.findUnique({
    where: {
      id: channelId,
    },
  });

  if (!channel || channel.teamId !== teamId || channel.type !== "TEAM") {
    throw new Error("Channel not found");
  }

  const messages = await prisma.message.findMany({
    where: {
      channelId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    cursor: {
      id: cursor,
    },
    skip: 1,
    take: 31,
    include: {
      sender: true,
    },
  });

  const hasMore = messages.length > 30;

  const limitedMessages = messages.slice(0, 30);

  return {
    messages: limitedMessages.reverse(),
    hasMore,
  };
}
