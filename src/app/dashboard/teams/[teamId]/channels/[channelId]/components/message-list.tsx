"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getOlderMessages, sendMessage } from "../action";

/* -------------------------------------------------------------------------- */
/* Types & constants                                                          */
/* -------------------------------------------------------------------------- */

type Message = {
  id: number;
  content: string;
  createdAt: Date | string;
  sender: {
    id: number;
    name: string | null;
    email: string;
  };
};

type MessageListProps = {
  initialMessages: Message[];
  teamId: number;
  channelId: number;
  currentUserId: number;
};

const SOCKET_URL = "http://localhost:3001";
const NEAR_BOTTOM_PX = 80;

/* -------------------------------------------------------------------------- */
/* Single message bubble                                                      */
/* -------------------------------------------------------------------------- */

function MessageBubble({ message, isOwnMessage }: { message: Message; isOwnMessage: boolean }) {
  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOwnMessage
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        {!isOwnMessage && (
          <p className="mb-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            {message.sender.name || message.sender.email}
          </p>
        )}

        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        <p className="mt-1 text-right text-[10px] opacity-70">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Message list                                                               */
/* -------------------------------------------------------------------------- */

export default function MessageList({
  initialMessages,
  teamId,
  channelId,
  currentUserId,
}: MessageListProps) {
  // ---- State ----
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // ---- Refs ----
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef(true);
  const previousScrollHeightRef = useRef<number | null>(null);
  const isLoadingRef = useRef(false);

  // ---- Actions ----
  async function loadOlderMessages() {
    if (!hasMore || isLoadingRef.current || messages.length === 0) return;

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const oldestMessage = messages[0];
      const container = scrollContainerRef.current;

      // Remember height so scroll position can be restored after prepending.
      if (container) {
        previousScrollHeightRef.current = container.scrollHeight;
      }

      const result = await getOlderMessages(teamId, channelId, oldestMessage.id);

      setMessages((current) => [...result.messages, ...current]);
      setHasMore(result.hasMore);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // currentTarget is null after an await, so grab the form now.
    const form = event.currentTarget;

    setIsSending(true);

    try {
      const newMessage = await sendMessage(new FormData(form));

      shouldScrollToBottomRef.current = true;
      setMessages((current) => [...current, newMessage]);

      form.reset();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  }

  // ---- Effect 1: real-time updates ----
  useEffect(() => {
    const socket = io(SOCKET_URL, { withCredentials: true });

    socket.on("connect", () => {
      console.log("Connected to Socket.IO:", socket.id);

      socket.emit("channel:join", channelId, (response: { ok: boolean; error?: string }) => {
        if (!response.ok) {
          console.error("Could not join channel:", response.error);
        }
      });
    });

    socket.on("message:new", (newMessage: Message) => {
      setMessages((currentMessages) => {
        // Avoid duplicates if this message was already added.
        if (currentMessages.some((message) => message.id === newMessage.id)) {
          return currentMessages;
        }

        // Scroll only if the user was already near the bottom.
        const container = scrollContainerRef.current;

        if (container) {
          const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;

          if (distanceFromBottom < NEAR_BOTTOM_PX) {
            shouldScrollToBottomRef.current = true;
          }
        }

        return [...currentMessages, newMessage];
      });
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO connection failed:", error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [channelId]);

  // ---- Effect 2: scroll position after messages change ----
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const previousScrollHeight = previousScrollHeightRef.current;

    // Case 1: Older messages were prepended.
    if (previousScrollHeight !== null) {
      container.scrollTop += container.scrollHeight - previousScrollHeight;
      previousScrollHeightRef.current = null;
      return;
    }

    // Case 2: Initial load or a new message.
    if (shouldScrollToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
      shouldScrollToBottomRef.current = false;
    }
  }, [messages]);

  // ---- Effect 3: infinite scroll (load older when top is visible) ----
  useEffect(() => {
    if (!hasMore) return;

    const container = scrollContainerRef.current;
    const top = topRef.current;
    if (!container || !top) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadOlderMessages();
        }
      },
      { root: container, threshold: 1 }
    );

    observer.observe(top);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, messages]);

  // ---- Render ----
  return (
    <div className="flex h-[500px] flex-col">
      <div ref={scrollContainerRef} className="flex flex-col gap-3 overflow-y-auto">
        <div ref={topRef} />

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwnMessage={message.sender.id === currentUserId}
          />
        ))}
      </div>

      {isLoading && <p>Loading older messages...</p>}

      <form onSubmit={handleSubmit}>
        <input name="content" placeholder="Type a message..." />
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="channelId" value={channelId} />

        <button type="submit" disabled={isSending}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
