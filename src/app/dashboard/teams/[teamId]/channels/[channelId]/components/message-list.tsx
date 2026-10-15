"use client";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import { getMessagesAfter, getOlderMessages, sendMessage } from "../action";

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

type PendingMessage = {
  clientMessageId: string;
  content: string;
  createdAt: string;
  status: "pending" | "failed";
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
  const [clientMessageId, setClientMessageId] = useState("");
  const [pendingQueue, setPendingQueue] = useState<{
    key: string;
    messages: PendingMessage[];
  }>({
    key: "",
    messages: [],
  });

  const storageKey = `pending-messages:${currentUserId}:${teamId}:${channelId}`;
  const pendingMessages = pendingQueue.key === storageKey ? pendingQueue.messages : [];

  // ---- Refs ----
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef(true);
  const previousScrollHeightRef = useRef<number | null>(null);
  const isLoadingRef = useRef(false);
  const messagesRef = useRef(messages);
  const retryingIdsRef = useRef(new Set<string>());
  // ---- Actions ----
  async function loadOlderMessages() {
    if (!hasMore || isLoadingRef.current || messages.length === 0) return;

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const oldestMessage = messages[0];
      const container = scrollContainerRef.current;

      // Remember height so scroll position can be restored after prepending.

      const result = await getOlderMessages(teamId, channelId, oldestMessage.id);
      if (container) {
        previousScrollHeightRef.current = container.scrollHeight;
      }
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
    const formData = new FormData(form);
    const content = String(formData.get("content") ?? "").trim();

    if (!content || isSending || !clientMessageId) return;

    setIsSending(true);

    try {
      await queueAndSendMessage(content);

      // Prepare an ID for the next message.
      setClientMessageId(crypto.randomUUID());
      form.reset();
    } finally {
      setIsSending(false);
    }
  }

  // Restore messages for the current channel
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);

    let messages: PendingMessage[] = [];

    if (saved) {
      try {
        messages = JSON.parse(saved);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    setPendingQueue({ key: storageKey, messages });
  }, [storageKey]);

  // Save only the queue belonging to the current channel
  useEffect(() => {
    if (pendingQueue.key !== storageKey) return;

    localStorage.setItem(storageKey, JSON.stringify(pendingQueue.messages));
  }, [storageKey, pendingQueue]);

  async function sendPendingMessage(pending: PendingMessage) {
    const formData = new FormData();

    formData.set("content", pending.content);
    formData.set("teamId", String(teamId));
    formData.set("channelId", String(channelId));
    formData.set("clientMessageId", pending.clientMessageId);

    const savedMessage = await sendMessage(formData);

    // Add the server-confirmed message without duplicating it.
    if (!savedMessage) {
      return;
    }

    setMessages((current) => {
      if (current.some((message) => message.id === savedMessage.id)) {
        return current;
      }

      return [...current, savedMessage];
    });

    // Remove this message from the persistent pending queue.
    setPendingQueue((previous) => ({
      ...previous,
      messages: previous.messages.filter(
        (message) => message.clientMessageId !== pending.clientMessageId
      ),
    }));
  }

  async function retryPendingMessages() {
    if (!navigator.onLine || pendingQueue.key !== storageKey) {
      return;
    }

    for (const pending of pendingQueue.messages) {
      if (retryingIdsRef.current.has(pending.clientMessageId)) {
        continue;
      }

      retryingIdsRef.current.add(pending.clientMessageId);

      try {
        await sendPendingMessage(pending);
      } catch (error) {
        console.error("Retry failed:", error);

        setPendingQueue((previous) => ({
          ...previous,
          messages: previous.messages.map((message) =>
            message.clientMessageId === pending.clientMessageId
              ? { ...message, status: "failed" }
              : message
          ),
        }));
      } finally {
        retryingIdsRef.current.delete(pending.clientMessageId);
      }
    }
  }

  async function queueAndSendMessage(content: string) {
    const pending: PendingMessage = {
      clientMessageId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    // Add it to the queue first so it can survive a refresh.
    setPendingQueue((previous) => ({
      key: storageKey,
      messages: [...(previous.key === storageKey ? previous.messages : []), pending],
    }));

    retryingIdsRef.current.add(pending.clientMessageId); // NEW

    try {
      await sendPendingMessage(pending);
    } catch (error) {
      console.error("Message sending failed:", error);
      alert(error instanceof Error ? error.message : String(error));

      setPendingQueue((previous) => ({
        ...previous,
        messages: previous.messages.map((message) =>
          message.clientMessageId === pending.clientMessageId
            ? { ...message, status: "failed" }
            : message
        ),
      }));
    } finally {
      retryingIdsRef.current.delete(pending.clientMessageId);
    }
  }

  const retryRef = useRef(retryPendingMessages);

  useEffect(() => {
    retryRef.current = retryPendingMessages;
  });

  const isRetryingRef = useRef(false);

  const runRetry = useCallback(async () => {
    if (isRetryingRef.current || !navigator.onLine) return;
    isRetryingRef.current = true;
    try {
      await retryRef.current();
    } finally {
      isRetryingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (pendingQueue.key !== storageKey) return;

    void runRetry(); // on mount / key change

    window.addEventListener("online", runRetry);
    return () => window.removeEventListener("online", runRetry);
  }, [storageKey, pendingQueue.key, runRetry]);

  useEffect(() => {
    setClientMessageId(crypto.randomUUID());
  }, []);

  // ---- Effect 1: real-time updates ----
  useEffect(() => {
    const socket = io(SOCKET_URL, { withCredentials: true });

    socket.on("connect", () => {
      console.log("Connected to Socket.IO:", socket.id);

      socket.emit("channel:join", channelId, async (response: { ok: boolean; error?: string }) => {
        if (!response.ok) {
          console.error("Could not join channel:", response.error);
          return;
        }

        try {
          // Find the latest message currently known to this client.
          const latestMessageId = messagesRef.current.reduce(
            (latestId, message) => Math.max(latestId, message.id),
            0
          );

          // Recover messages missed while disconnected.
          const missedMessages = await getMessagesAfter(teamId, channelId, latestMessageId);

          if (missedMessages.length === 0) return;

          // Preserve the user's scroll position unless they are near the bottom.
          const container = scrollContainerRef.current;

          if (container) {
            const distanceFromBottom =
              container.scrollHeight - container.scrollTop - container.clientHeight;

            if (distanceFromBottom < 80) {
              shouldScrollToBottomRef.current = true;
            }
          }

          // Merge recovered messages without duplicating live broadcasts.
          setMessages((currentMessages) => {
            const existingIds = new Set(currentMessages.map((message) => message.id));

            const uniqueMissedMessages = missedMessages.filter(
              (message) => !existingIds.has(message.id)
            );

            if (uniqueMissedMessages.length === 0) {
              return currentMessages;
            }

            return [...currentMessages, ...uniqueMissedMessages].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id
            );
          });
        } catch (error) {
          console.error("Failed to recover missed messages:", error);
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
  }, [teamId, channelId]);

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
  }, [messages, pendingMessages]);

  // ---- Effect 3: infinite scroll (load older when top is visible) ----
  useEffect(() => {
    messagesRef.current = messages;
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
      <div ref={scrollContainerRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <div ref={topRef} />

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwnMessage={message.sender.id === currentUserId}
          />
        ))}

        {pendingMessages.map((pending) => (
          <div key={pending.clientMessageId} className="flex justify-end">
            <div className="max-w-[75%] rounded-2xl bg-blue-600 px-4 py-2 text-white opacity-80">
              <p className="whitespace-pre-wrap break-words">{pending.content}</p>

              <p className="mt-1 text-right text-[10px] opacity-80">
                {pending.status === "pending" ? "Sending..." : "Failed to send · Will retry"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isLoading && <p>Loading older messages...</p>}

      <form onSubmit={handleSubmit}>
        <input name="content" placeholder="Type a message..." />
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="channelId" value={channelId} />
        <input type="hidden" name="clientMessageId" value={clientMessageId} />
        <button type="submit" disabled={isSending || !clientMessageId}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
