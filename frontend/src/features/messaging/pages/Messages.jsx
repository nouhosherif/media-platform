import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../../../api";
import Icon from "../../../components/Icon";
import BottomNav from "../../../components/ui/BottomNav";

const terminalCallStatuses = ["ended", "declined", "missed", "canceled"];

const getTimestamp = () => Date.now();

const handleAuthError = (err) => {
  if (err.response?.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    window.location.assign("/");
  }
};

const getErrorMessage = (details, fallback) => {
  if (!details) {
    return fallback;
  }

  if (typeof details === "string") {
    return details;
  }

  return details.error || details.detail || fallback;
};

const Messages = () => {
  const [searchParams] = useSearchParams();
  const requestedUserId = searchParams.get("user");
  const [threads, setThreads] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threadQuery, setThreadQuery] = useState("");
  const [threadFilter, setThreadFilter] = useState("all");
  const [userQuery, setUserQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState("");
  const [callError, setCallError] = useState("");
  const [callStarting, setCallStarting] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const shouldSendRecordingRef = useRef(true);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const activeCallRef = useRef(null);
  const pendingIceRef = useRef([]);
  const addedIceRef = useRef(new Set());

  const filteredThreads = useMemo(() => {
    const availableThreads = threadFilter === "unread"
      ? threads.filter((thread) => thread.unread_count > 0)
      : threads;
    const normalizedQuery = threadQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return availableThreads;
    }

    return availableThreads.filter((thread) => {
      const user = thread.user || {};
      const lastMessage = getMessagePreview(thread.last_message);
      return `${user.username || ""} ${user.full_name || ""} ${lastMessage}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [threads, threadFilter, threadQuery]);

  const unreadCount = useMemo(() => {
    return threads.reduce((total, thread) => total + (thread.unread_count || 0), 0);
  }, [threads]);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("users/messages/");
      setThreads(res.data);
    } catch (err) {
      handleAuthError(err);
      setError("Could not load messages.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (query) => {
    try {
      const res = await API.get("users/search/", {
        params: query.trim() ? { q: query.trim() } : {},
      });
      setUsers(res.data);
    } catch (err) {
      handleAuthError(err);
    }
  };

  const fetchConversation = async (user, { silent = false } = {}) => {
    try {
      if (!silent) {
        setConversationLoading(true);
      }
      const res = await API.get(`users/messages/${user.id}/`);
      setActiveUser(res.data.user || user);
      setMessages(res.data.messages);
      fetchThreads();
    } catch (err) {
      handleAuthError(err);
      if (!silent) {
        setError("Could not load conversation.");
      }
    } finally {
      if (!silent) {
        setConversationLoading(false);
      }
    }
  };

  const openConversation = async (user) => {
    setError("");
    setActiveUser(user);
    await fetchConversation(user);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!activeUser || !text) {
      return;
    }

    try {
      setSending(true);
      const res = await API.post("users/messages/", {
        recipient_id: activeUser.id,
        text,
      });
      setMessages((currentMessages) => [...currentMessages, res.data]);
      setDraft("");
      fetchThreads();
    } catch (err) {
      handleAuthError(err);
      setError(getErrorMessage(err.response?.data, "Could not send message."));
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    if (!activeUser || recording) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      shouldSendRecordingRef.current = true;
      recordingStartedAtRef.current = getTimestamp();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const duration = (getTimestamp() - recordingStartedAtRef.current) / 1000;
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        cleanupRecordingControls();

        if (shouldSendRecordingRef.current && blob.size > 0) {
          sendVoiceMessage(blob, duration);
        }
      };

      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((getTimestamp() - recordingStartedAtRef.current) / 1000));
      }, 500);
    } catch (err) {
      console.error(err);
      setError("Could not start voice recording. Please allow microphone access.");
    }
  };

  const stopRecording = (shouldSend = true) => {
    shouldSendRecordingRef.current = shouldSend;
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    cleanupRecordingControls();
  };

  const cleanupRecording = (shouldSend) => {
    shouldSendRecordingRef.current = shouldSend;
    stopRecording(shouldSend);
  };

  const cleanupRecordingControls = () => {
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    mediaRecorderRef.current = null;
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    setRecording(false);
    setRecordingSeconds(0);
  };

  const sendVoiceMessage = async (blob, duration) => {
    if (!activeUser) {
      return;
    }

    const data = new FormData();
    data.append("recipient_id", activeUser.id);
    data.append("voice_file", blob, `voice-${getTimestamp()}.webm`);
    data.append("voice_duration", duration.toFixed(1));

    try {
      setSending(true);
      const res = await API.post("users/messages/", data);
      setMessages((currentMessages) => [...currentMessages, res.data]);
      fetchThreads();
    } catch (err) {
      handleAuthError(err);
      setError(getErrorMessage(err.response?.data, "Could not send voice message."));
    } finally {
      setSending(false);
    }
  };

  const startCall = async (callType) => {
    if (!activeUser || activeCall || callStarting) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setCallError("Calls are not supported in this browser.");
      return;
    }

    try {
      setCallStarting(true);
      setCallError("");
      setCallStatus(callType === "video" ? "Starting video call..." : "Starting audio call...");
      const { stream, resolvedCallType, fallbackMessage } = await getCallMediaStream(callType);
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (fallbackMessage) {
        setCallError(fallbackMessage);
      }

      const peer = createPeerConnection(() => activeCallRef.current?.id);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const res = await API.post("users/calls/", {
        recipient_id: activeUser.id,
        call_type: resolvedCallType,
        offer: serializeDescription(peer.localDescription),
      });

      activeCallRef.current = res.data;
      setActiveCall(res.data);
      setCallStatus("Ringing...");
      flushPendingIce(res.data.id);
    } catch (err) {
      console.error(err);
      cleanupCall();
      setCallError(getMediaAccessError(err, callType));
    } finally {
      setCallStarting(false);
    }
  };

  const acceptCall = async (call) => {
    if (!call || activeCall) {
      return;
    }

    try {
      setCallStarting(true);
      setCallError("");
      setCallStatus("Connecting...");
      const { stream, fallbackMessage } = await getCallMediaStream(call.call_type);
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (fallbackMessage) {
        setCallError(fallbackMessage);
      }

      const peer = createPeerConnection(() => call.id);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(new RTCSessionDescription(call.offer));
      await addRemoteIce(call.caller_ice || []);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      const res = await API.post(`users/calls/${call.id}/`, {
        action: "accept",
        answer: serializeDescription(peer.localDescription),
      });

      activeCallRef.current = res.data;
      setActiveCall(res.data);
      setIncomingCall(null);
      setCallStatus("Connected");
      flushPendingIce(call.id);
    } catch (err) {
      console.error(err);
      cleanupCall();
      setCallError(getMediaAccessError(err, call.call_type));
    } finally {
      setCallStarting(false);
    }
  };

  const declineCall = async (call) => {
    try {
      await API.post(`users/calls/${call.id}/`, { action: "decline" });
    } catch (err) {
      handleAuthError(err);
    } finally {
      setIncomingCall(null);
    }
  };

  const endCall = async () => {
    const call = activeCallRef.current;
    if (call?.id) {
      try {
        await API.post(`users/calls/${call.id}/`, {
          action: call.role === "caller" && call.status === "ringing" ? "cancel" : "end",
        });
      } catch (err) {
        handleAuthError(err);
      }
    }

    cleanupCall();
    setCallStatus("Call ended");
  };

  const syncCall = async (callId) => {
    try {
      const res = await API.get(`users/calls/${callId}/`);
      const call = res.data;

      if (terminalCallStatuses.includes(call.status)) {
        cleanupCall();
        setCallStatus("Call ended");
        return;
      }

      activeCallRef.current = call;
      setActiveCall(call);
      setCallStatus(call.status === "accepted" ? "Connected" : "Ringing...");

      const peer = peerRef.current;
      if (!peer) {
        return;
      }

      if (call.role === "caller" && call.answer && !peer.currentRemoteDescription) {
        await peer.setRemoteDescription(new RTCSessionDescription(call.answer));
      }

      const remoteCandidates = call.role === "caller" ? call.recipient_ice : call.caller_ice;
      await addRemoteIce(remoteCandidates || []);
    } catch (err) {
      handleAuthError(err);
    }
  };

  const createPeerConnection = (getCallId) => {
    const peer = new RTCPeerConnection();
    peerRef.current = peer;
    addedIceRef.current = new Set();

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStream(stream);
      }
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      const candidate = event.candidate.toJSON();
      const callId = getCallId();
      if (!callId) {
        pendingIceRef.current.push(candidate);
        return;
      }

      postIceCandidate(callId, candidate);
    };

    return peer;
  };

  const postIceCandidate = async (callId, candidate) => {
    try {
      await API.post(`users/calls/${callId}/`, {
        action: "signal",
        ice_candidate: candidate,
      });
    } catch (err) {
      handleAuthError(err);
    }
  };

  const flushPendingIce = (callId) => {
    pendingIceRef.current.forEach((candidate) => postIceCandidate(callId, candidate));
    pendingIceRef.current = [];
  };

  const addRemoteIce = async (candidates) => {
    const peer = peerRef.current;
    if (!peer || !peer.remoteDescription) {
      return;
    }

    for (const candidate of candidates) {
      const key = JSON.stringify(candidate);
      if (addedIceRef.current.has(key)) {
        continue;
      }

      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
        addedIceRef.current.add(key);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const cleanupCall = (resetState = true) => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    activeCallRef.current = null;
    pendingIceRef.current = [];
    addedIceRef.current = new Set();
    if (resetState) {
      setActiveCall(null);
      setIncomingCall(null);
      setLocalStream(null);
      setRemoteStream(null);
    }
  };

  const getCallMediaStream = async (callType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      return { stream, resolvedCallType: callType, fallbackMessage: "" };
    } catch (err) {
      if (callType === "video" && isCameraOnlyFailure(err)) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        return {
          stream,
          resolvedCallType: "audio",
          fallbackMessage: "Camera is not available, so I started an audio call instead.",
        };
      }

      throw err;
    }
  };

  const isCameraOnlyFailure = (err) => {
    return ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(err?.name);
  };

  const getMediaAccessError = (err, callType) => {
    const name = err?.name || "";

    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      return "The browser blocked microphone or camera access. Click the lock icon beside the address, allow microphone/camera, then try again.";
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return callType === "video"
        ? "No camera or microphone was found. Connect a device, or try an audio call if you only have a microphone."
        : "No microphone was found. Connect a microphone and try the call again.";
    }

    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Your camera or microphone is already being used by another app. Close the other app and try again.";
    }

    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "The selected camera or microphone is not available. Try a different device or use audio only.";
    }

    if (!window.isSecureContext) {
      return "Calls need a secure browser context. Use localhost or HTTPS, then try again.";
    }

    return "Could not start the call. Please allow microphone/camera access and make sure a device is connected.";
  };

  const loadInitialData = useEffectEvent(() => {
    fetchThreads();
    fetchUsers("");
  });

  const cleanupOnUnmount = useEffectEvent(() => {
    cleanupRecording(false);
    cleanupCall(false);
  });

  const openRequestedConversation = useEffectEvent(async (userId) => {
    try {
      const res = await API.get(`users/profile/${userId}/`);
      openConversation(res.data);
    } catch (err) {
      handleAuthError(err);
      setError("Could not open this conversation.");
    }
  });

  const searchUsers = useEffectEvent(() => {
    fetchUsers(userQuery);
  });

  const refreshActiveConversation = useEffectEvent(() => {
    if (activeUser) {
      fetchConversation(activeUser, { silent: true });
    }
  });

  const pollIncomingCalls = useEffectEvent(async () => {
    try {
      const res = await API.get("users/calls/", { params: { active: 1 } });
      const call = res.data.find((item) => item.role === "recipient" && item.status === "ringing");
      setIncomingCall(call || null);
    } catch (err) {
      handleAuthError(err);
    }
  });

  const refreshActiveCall = useEffectEvent(() => {
    if (activeCall?.id) {
      syncCall(activeCall.id);
    }
  });

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInitialData();
    }, 0);

    return () => {
      clearTimeout(timer);
      cleanupOnUnmount();
    };
  }, []);

  useEffect(() => {
    if (!requestedUserId || activeUser?.id === Number(requestedUserId)) {
      return;
    }

    const timer = setTimeout(() => {
      openRequestedConversation(requestedUserId);
    }, 0);

    return () => clearTimeout(timer);
  }, [requestedUserId, activeUser?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers();
    }, 250);

    return () => clearTimeout(timer);
  }, [userQuery]);

  useEffect(() => {
    if (!activeUser?.id) {
      return undefined;
    }

    const timer = setInterval(() => {
      refreshActiveConversation();
    }, 3500);

    return () => clearInterval(timer);
  }, [activeUser?.id]);

  useEffect(() => {
    if (activeCall?.id) {
      return undefined;
    }

    const initialTimer = setTimeout(() => {
      pollIncomingCalls();
    }, 0);
    const timer = setInterval(() => {
      pollIncomingCalls();
    }, 2500);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [activeCall?.id]);

  useEffect(() => {
    if (!activeCall?.id) {
      return undefined;
    }

    const timer = setInterval(() => {
      refreshActiveCall();
    }, 1200);

    return () => clearInterval(timer);
  }, [activeCall?.id]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto min-h-screen w-full max-w-app overflow-hidden border-x border-white/10 bg-[#0c0d0f] pb-24 shadow-2xl">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c0d0f]/90 px-4 pb-4 pt-5 backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-3xl font-extrabold tracking-tight sm:text-4xl">Messages</h1>
              <p className="mt-1 text-xs font-medium text-white/45">
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>

            <Link
              aria-label="Notifications"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
              to="/notifications"
            >
              <Icon name="notification" />
            </Link>
            <button
              aria-label="New message"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black transition hover:bg-white/90"
              onClick={() => setActiveUser(null)}
              type="button"
            >
              <Icon name="plus" />
            </button>
          </div>

          <label className="relative mt-4 block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              aria-label="Search message threads"
              className="h-12 w-full rounded-full border border-white/5 bg-white/10 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:bg-white/15 focus:ring-2 focus:ring-white/10"
              onChange={(event) => setThreadQuery(event.target.value)}
              placeholder="Search messages..."
              value={threadQuery}
            />
          </label>
        </header>

        <main className="space-y-5 px-4 py-5 sm:px-6">
          {error && (
            <div className="rounded-control border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {callError && (
            <div className="rounded-control border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {callError}
            </div>
          )}

          {incomingCall && !activeCall && (
            <IncomingCall call={incomingCall} onAccept={acceptCall} onDecline={declineCall} />
          )}

          {activeCall && (
            <CallDock
              call={activeCall}
              callStatus={callStatus}
              localStream={localStream}
              onEnd={endCall}
              remoteStream={remoteStream}
            />
          )}

          {activeUser ? (
            <ConversationPanel
              activeUser={activeUser}
              conversationLoading={conversationLoading}
              draft={draft}
              messages={messages}
              onAudioCall={() => startCall("audio")}
              onBack={() => setActiveUser(null)}
              onDraftChange={setDraft}
              onSend={sendMessage}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onVideoCall={() => startCall("video")}
              callBusy={callStarting || Boolean(activeCall)}
              recording={recording}
              recordingSeconds={recordingSeconds}
              sending={sending}
            />
          ) : (
            <>
              <RecentContacts onSelectUser={openConversation} threads={threads} />
              <PeoplePanel
                onSelectUser={openConversation}
                query={userQuery}
                setQuery={setUserQuery}
                users={users}
              />
              <div className="flex gap-2" role="group" aria-label="Conversation filters">
                {[
                  ["all", "All"],
                  ["unread", "Unread"],
                ].map(([value, label]) => (
                  <button
                    aria-pressed={threadFilter === value}
                    className={`rounded-full px-5 py-2 text-sm font-bold transition ${threadFilter === value ? "bg-white text-black" : "bg-white/10 text-white/65 hover:bg-white/15"}`}
                    key={value}
                    onClick={() => setThreadFilter(value)}
                    type="button"
                  >
                    {label}{value === "unread" && unreadCount > 0 ? ` ${unreadCount}` : ""}
                  </button>
                ))}
              </div>

              <section aria-label="Conversations" className="overflow-hidden rounded-card border border-white/10 bg-white/[0.035]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="font-bold">Chats</p>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/65">
                    {filteredThreads.length}
                  </span>
                </div>

                {loading ? (
                  <p className="px-4 py-10 text-center text-sm text-white/45">Loading chats...</p>
                ) : filteredThreads.length === 0 ? (
                  <EmptyState filtered={threadFilter === "unread" || Boolean(threadQuery.trim())} />
                ) : (
                  <div className="divide-y divide-white/10">
                    {filteredThreads.map((thread) => (
                      <ThreadButton
                        activeUser={activeUser}
                        key={thread.user.id}
                        onOpen={openConversation}
                        thread={thread}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>

        <BottomNav active="messages" dark />
      </div>
    </div>
  );
};

const RecentContacts = ({ onSelectUser, threads }) => {
  const recent = threads.slice(0, 8);
  if (recent.length === 0) return null;

  return (
    <section aria-label="Recent contacts">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-white/40">Recent</p>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {recent.map(({ user }) => (
          <button
            className="grid w-[68px] shrink-0 justify-items-center gap-2 text-center"
            key={user.id}
            onClick={() => onSelectUser(user)}
            type="button"
          >
            <Avatar user={user} className="h-14 w-14 bg-white/10 text-white" />
            <span className="max-w-full truncate text-xs font-semibold text-white/70">
              {user.full_name || user.username}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

const PeoplePanel = ({ onSelectUser, query, setQuery, users }) => (
  <section className="rounded-card border border-white/10 bg-white/[0.035] p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="font-bold text-white">New conversation</p>
        <p className="mt-0.5 text-xs text-white/40">Find someone to message</p>
      </div>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
        <Icon name="message" />
      </span>
    </div>

    <label className="relative mt-3 block">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35">
        <Icon name="search" className="h-4 w-4" />
      </span>
      <input
        aria-label="Search users"
        className="h-11 w-full rounded-full border border-white/5 bg-white/10 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-2 focus:ring-white/10"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find people"
        value={query}
      />
    </label>

    <div className="mt-4 flex gap-4 overflow-x-auto pb-1">
      {users.length === 0 ? (
        <p className="py-4 text-sm text-white/40">No users found.</p>
      ) : (
        users.map((user) => (
          <button
            className="grid w-20 shrink-0 justify-items-center gap-2 text-center"
            key={user.id}
            onClick={() => onSelectUser(user)}
            type="button"
          >
            <Avatar user={user} className="h-14 w-14 bg-white/10 text-white" />
            <span className="max-w-full truncate text-xs font-semibold text-white/70">
              {user.full_name || user.username}
            </span>
          </button>
        ))
      )}
    </div>
  </section>
);

const ConversationPanel = ({
  activeUser,
  callBusy,
  conversationLoading,
  draft,
  messages,
  onAudioCall,
  onBack,
  onDraftChange,
  onSend,
  onStartRecording,
  onStopRecording,
  onVideoCall,
  recording,
  recordingSeconds,
  sending,
}) => (
  <section className="overflow-hidden rounded-card border border-white/10 bg-[#121417] shadow-2xl">
    <header className="flex items-center gap-3 border-b border-white/10 bg-[#121417] px-3 py-3 sm:px-4">
      <button
        aria-label="Close conversation"
        className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/15"
        onClick={onBack}
        type="button"
      >
        <Icon name="x" className="h-4 w-4" />
      </button>
      <Link to={`/profile/${activeUser.id}`}>
        <Avatar user={activeUser} className="h-10 w-10 bg-white/10 text-white" />
      </Link>
      <Link className="min-w-0 flex-1" to={`/profile/${activeUser.id}`}>
        <p className="truncate text-sm font-bold text-white">{activeUser.full_name || activeUser.username}</p>
        <p className="truncate text-xs text-white/40">@{activeUser.username}</p>
      </Link>
      <button
        aria-label="Start audio call"
        className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/20"
        disabled={callBusy}
        onClick={onAudioCall}
        type="button"
      >
        <Icon name="phone" className="h-4 w-4" />
      </button>
      <button
        aria-label="Start video call"
        className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/20"
        disabled={callBusy}
        onClick={onVideoCall}
        type="button"
      >
        <Icon name="video" className="h-4 w-4" />
      </button>
    </header>

    <div className="min-h-[360px] max-h-[52vh] space-y-2 overflow-y-auto bg-[#090a0c] px-3 py-4 sm:px-4">
      {conversationLoading ? (
        <p className="py-8 text-center text-sm text-white/40">Loading conversation...</p>
      ) : messages.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/40">No messages yet.</p>
      ) : (
        messages.map((message) => (
          <MessageBubble activeUser={activeUser} key={message.id} message={message} />
        ))
      )}
    </div>

    <form className="border-t border-white/10 bg-[#121417] p-3" onSubmit={onSend}>
      {recording ? (
        <div className="flex items-center gap-2">
          <span className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-red-500/10 px-4 text-sm font-semibold text-red-300">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            Recording {formatDuration(recordingSeconds)}
          </span>
          <button
            aria-label="Cancel voice message"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white/70"
            onClick={() => onStopRecording(false)}
            type="button"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
          <button
            aria-label="Send voice message"
            className="grid h-11 w-11 place-items-center rounded-full bg-white text-black"
            onClick={() => onStopRecording(true)}
            type="button"
          >
            <Icon name="send" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            aria-label="Record voice message"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15"
            disabled={sending}
            onClick={onStartRecording}
            type="button"
          >
            <Icon name="mic" className="h-4 w-4" />
          </button>
          <input
            className="h-11 min-w-0 flex-1 rounded-full border border-white/5 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-2 focus:ring-white/10"
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Message"
            value={draft}
          />
          <button
            className="grid h-11 w-11 place-items-center rounded-full bg-white text-black transition disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/25"
            disabled={sending || !draft.trim()}
            type="submit"
          >
            <Icon name="send" className="h-4 w-4" />
          </button>
        </div>
      )}
    </form>
  </section>
);

const IncomingCall = ({ call, onAccept, onDecline }) => (
  <section className="rounded-card border border-white/10 bg-white/[0.06] p-3 shadow-sm">
    <div className="flex items-center gap-3">
      <Avatar user={call.caller} className="h-12 w-12 bg-white/10 text-white" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{call.caller.full_name || call.caller.username}</p>
        <p className="text-xs font-semibold text-white/50">
          Incoming {call.call_type} call
        </p>
      </div>
      <button
        aria-label="Decline call"
        className="grid h-10 w-10 place-items-center rounded-full bg-red-500 text-white"
        onClick={() => onDecline(call)}
        type="button"
      >
        <Icon name="phoneOff" className="h-4 w-4" />
      </button>
      <button
        aria-label="Accept call"
        className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-white"
        onClick={() => onAccept(call)}
        type="button"
      >
        <Icon name="phone" className="h-4 w-4" />
      </button>
    </div>
  </section>
);

const CallDock = ({ call, callStatus, localStream, onEnd, remoteStream }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <section className="overflow-hidden rounded-lg bg-slate-950 text-white shadow-sm">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">
            {call.other_user?.full_name || call.other_user?.username || "Call"}
          </p>
          <p className="text-xs text-white/60">{callStatus || call.status}</p>
        </div>
        <button
          aria-label="End call"
          className="grid h-10 w-10 place-items-center rounded-full bg-red-500 text-white"
          onClick={onEnd}
          type="button"
        >
          <Icon name="phoneOff" className="h-4 w-4" />
        </button>
      </div>

      {call.call_type === "video" ? (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <video
            autoPlay
            className="aspect-[3/4] rounded-lg bg-black object-cover"
            muted
            playsInline
            ref={localVideoRef}
          />
          <video
            autoPlay
            className="aspect-[3/4] rounded-lg bg-black object-cover"
            playsInline
            ref={remoteVideoRef}
          />
        </div>
      ) : (
        <div className="px-3 pb-3">
          <audio autoPlay ref={remoteVideoRef} />
          <div className="grid h-24 place-items-center rounded-lg bg-white/10">
            <Icon name="phone" className="h-8 w-8" />
          </div>
        </div>
      )}
    </section>
  );
};

const ThreadButton = ({ activeUser, onOpen, thread }) => {
  const user = thread.user;
  const lastMessage = thread.last_message;
  const isActive = activeUser?.id === user.id;

  return (
    <button
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
        isActive ? "bg-white/10" : "bg-transparent hover:bg-white/[0.045]"
      }`}
      onClick={() => onOpen(user)}
      type="button"
    >
      <Avatar user={user} className="h-14 w-14 bg-white/10 text-white" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-white">{user.full_name || user.username}</p>
          <span className="shrink-0 text-xs text-white/35">{formatTime(lastMessage?.created_at)}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-white/45">{getMessagePreview(lastMessage)}</p>
      </div>
      {thread.unread_count > 0 && (
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white px-2 text-xs font-bold text-black">
          {thread.unread_count}
        </span>
      )}
    </button>
  );
};

const MessageBubble = ({ activeUser, message }) => {
  const isMine = message.sender.id !== activeUser.id;

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-3xl px-3 py-2 text-sm shadow-sm ${
          isMine
            ? "rounded-br-lg bg-white text-black"
            : "rounded-bl-lg bg-white/10 text-white"
        }`}
      >
        {message.message_type === "voice" ? (
          <div className="min-w-[190px]">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
              <Icon name="mic" className="h-4 w-4" />
              <span>Voice message</span>
              {message.voice_duration && <span>{formatDuration(message.voice_duration)}</span>}
            </div>
            {message.voice_file ? (
              <audio className="h-8 w-full" controls src={message.voice_file} />
            ) : (
              <p>Audio unavailable</p>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.text}</p>
        )}
        <p className={`mt-1 text-right text-[10px] ${isMine ? "text-black/50" : "text-white/35"}`}>
          {formatTime(message.created_at)}
          {isMine && ` · ${message.is_read ? "Seen" : "Sent"}`}
        </p>
      </div>
    </div>
  );
};

const EmptyState = ({ filtered = false }) => (
  <div className="px-4 py-14 text-center">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white/50">
      <Icon name="message" />
    </div>
    <p className="mt-3 font-semibold text-white">{filtered ? "No matching conversations" : "No chats yet"}</p>
    <p className="mt-1 text-sm text-white/40">
      {filtered ? "Try another filter or search." : "Your conversations will appear here."}
    </p>
  </div>
);

const Avatar = ({ className, user }) => (
  <div className={`grid shrink-0 place-items-center overflow-hidden rounded-full text-lg font-bold ${className}`}>
    {user?.profile_picture ? (
      <img alt="" className="h-full w-full object-cover" src={user.profile_picture} />
    ) : (
      (user?.full_name || user?.username || "U").charAt(0).toUpperCase()
    )}
  </div>
);

const serializeDescription = (description) => ({
  type: description.type,
  sdp: description.sdp,
});

const getMessagePreview = (message) => {
  if (!message) {
    return "";
  }

  return message.message_type === "voice" ? "Voice message" : message.text;
};

const formatTime = (value) => {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (value) => {
  const totalSeconds = Math.max(Math.floor(Number(value) || 0), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export default Messages;
