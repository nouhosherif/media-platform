import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import API from "../../../api";
import CreatePostModal from "../../../components/CreatePostModal";
import Icon from "../../../components/Icon";
import BottomNav from "../../../components/ui/BottomNav";

const VIDEO_TABS = [
  { endpoint: "media/personalized/", id: "for-you", label: "For You" },
  { endpoint: "media/following/", id: "following", label: "Following" },
  { endpoint: "media/explore/", id: "popular", label: "Popular" },
];

const onlyVideos = (items = []) => items.filter((item) => item.media_type === "video");

const formatPlayerTime = (value) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const formatUploadDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
};

const Videos = () => {
  const [activeTab, setActiveTab] = useState("for-you");
  const [videos, setVideos] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  const fetchVideos = useCallback(async () => {
    const endpoint = VIDEO_TABS.find((tab) => tab.id === activeTab)?.endpoint || VIDEO_TABS[0].endpoint;
    try {
      setLoading(true);
      setError("");
      const res = await API.get(endpoint);
      setVideos(onlyVideos(res.data.results || res.data));
      setNextUrl(res.data.next || null);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.assign("/");
        return;
      }
      setError("Could not load videos.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => fetchVideos(), 0);
    return () => clearTimeout(timer);
  }, [fetchVideos]);

  const loadMore = async () => {
    if (!nextUrl) return;

    const res = await API.get(nextUrl);
    setVideos((currentVideos) => [
      ...currentVideos,
      ...onlyVideos(res.data.results || res.data),
    ]);
    setNextUrl(res.data.next || null);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative mx-auto min-h-screen w-full max-w-app overflow-hidden bg-black">
        <header className="fixed left-1/2 top-0 z-30 w-full max-w-app -translate-x-1/2 bg-gradient-to-b from-black/90 via-black/55 to-transparent px-4 pb-8 pt-3 sm:px-6">
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
            <Link
              aria-label="Back to feed"
              className="grid h-11 w-11 place-items-center rounded-control bg-black/30 text-white ring-1 ring-white/15 backdrop-blur-xl transition hover:bg-white/15"
              to="/feed"
            >
              <Icon name="home" />
            </Link>

            <h1 className="text-center text-xl font-extrabold tracking-tight">Videos</h1>

            <button
              aria-label="Upload video"
              className="grid h-11 w-11 place-items-center rounded-control bg-white text-ink shadow-lg transition hover:bg-slate-100"
              onClick={() => setComposerOpen(true)}
              type="button"
            >
              <Icon name="plus" />
            </button>
          </div>

          <div aria-label="Video feeds" className="mt-3 flex items-center justify-center gap-7" role="tablist">
            {VIDEO_TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.id}
                className={`relative pb-2 text-sm font-semibold transition ${activeTab === tab.id ? "text-white" : "text-white/55 hover:text-white/80"}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-white" />
                )}
              </button>
            ))}
          </div>
        </header>

        {loading && (
          <div className="grid h-[100dvh] place-items-center px-6 text-sm text-white/70">
            Loading videos...
          </div>
        )}

        {error && (
          <div className="grid h-[100dvh] place-items-center px-6 text-center text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="grid h-[100dvh] place-items-center px-6 text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-card bg-white/10 text-white ring-1 ring-white/10">
                <Icon className="h-7 w-7" name="video" />
              </div>
              <p className="mt-4 text-lg font-bold">No videos in this feed</p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-white/60">
                Choose another feed or upload a video.
              </p>
              {nextUrl && (
                <button
                  className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink"
                  onClick={loadMore}
                  type="button"
                >
                  Load more
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && videos.length > 0 && (
          <main className="h-[100dvh] snap-y snap-mandatory overflow-y-auto">
            {videos.map((video) => (
              <ReelCard key={`${activeTab}-${video.id}`} video={video} />
            ))}

            {nextUrl && (
              <section className="grid h-[100dvh] snap-start place-items-center px-4">
                <button
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink shadow-xl"
                  onClick={loadMore}
                  type="button"
                >
                  Load more videos
                </button>
              </section>
            )}
          </main>
        )}

        <CreatePostModal
          mode="video"
          onClose={() => setComposerOpen(false)}
          onCreated={(items) => setVideos((currentVideos) => [
            ...onlyVideos(items),
            ...currentVideos,
          ])}
          open={composerOpen}
        />

        <BottomNav active="video" dark />
      </div>
    </div>
  );
};

const CreatorAvatar = ({ video, className }) => {
  const label = String(video.user_full_name || video.user || "").trim();
  const initial = label.charAt(0).toUpperCase();

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-white text-sm font-bold text-ink ring-2 ring-white/90 ${className}`}>
      {video.user_profile_picture ? (
        <img alt="" className="h-full w-full object-cover" src={video.user_profile_picture} />
      ) : initial ? (
        initial
      ) : (
        <Icon className="h-5 w-5 text-muted" name="user" />
      )}
    </span>
  );
};

const ReelCard = ({ video }) => {
  const playerRef = useRef(null);
  const [likes, setLikes] = useState(video.likes_count || 0);
  const [liked, setLiked] = useState(false);
  const [commentsCount, setCommentsCount] = useState(video.comments?.length || 0);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const username = String(video.user || "").trim();
  const fullName = String(video.user_full_name || "").trim();
  const displayName = fullName || username;
  const profilePath = video.user_id ? `/profile/${video.user_id}` : null;
  const uploadDate = formatUploadDate(video.uploaded_at);

  const togglePlayback = async () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused) {
      try {
        await player.play();
      } catch (err) {
        console.error(err);
      }
    } else {
      player.pause();
    }
  };

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    player.muted = !player.muted;
    setMuted(player.muted);
  };

  const seek = (event) => {
    const player = playerRef.current;
    if (!player) return;
    const nextTime = Number(event.target.value);
    player.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const enterFullscreen = () => {
    const player = playerRef.current;
    if (!player?.requestFullscreen) return;
    player.requestFullscreen().catch((err) => console.error(err));
  };

  const handleLike = async () => {
    try {
      const res = await API.post(`media/like/${video.id}/`);
      const isLiked = res.data.message === "Liked";
      setLikes((currentLikes) => (isLiked ? currentLikes + 1 : Math.max(currentLikes - 1, 0)));
      setLiked(isLiked);
    } catch (err) {
      console.error(err);
    }
  };

  const handleComment = async (event) => {
    event.preventDefault();
    if (!comment.trim()) return;

    try {
      await API.post(`media/comment/${video.id}/`, { text: comment.trim() });
      setComment("");
      setCommentsCount((currentCount) => currentCount + 1);
      setShowComment(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard?.writeText(`${window.location.origin}/videos#video-${video.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const creatorAvatar = <CreatorAvatar className="h-11 w-11" video={video} />;

  return (
    <section className="relative h-[100dvh] snap-start overflow-hidden bg-black" id={`video-${video.id}`}>
      <video
        aria-label={displayName ? `Video by ${displayName}` : "Video"}
        className="h-full w-full bg-black object-cover"
        loop
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        playsInline
        preload="metadata"
        ref={playerRef}
      >
        <source src={video.file} />
      </video>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />

      {!playing && (
        <button
          aria-label="Play video"
          className="absolute left-1/2 top-1/2 z-10 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/50"
          onClick={togglePlayback}
          type="button"
        >
          <Icon className="ml-1 h-7 w-7" name="play" />
        </button>
      )}

      <div className="absolute bottom-44 right-3 z-20 grid justify-items-center gap-4 sm:right-5">
        {profilePath ? (
          <Link aria-label={displayName ? `View ${displayName}'s profile` : "View creator profile"} to={profilePath}>
            <CreatorAvatar className="h-12 w-12" video={video} />
          </Link>
        ) : (
          <CreatorAvatar className="h-12 w-12" video={video} />
        )}

        <RailAction
          active={liked}
          count={likes}
          icon="heart"
          label={liked ? "Unlike video" : "Like video"}
          onClick={handleLike}
        />
        <RailAction
          count={commentsCount}
          icon="message"
          label="Comment on video"
          onClick={() => setShowComment(true)}
        />
        <RailAction icon="share" label="Share video" onClick={handleShare} text="Share" />
      </div>

      <div className="absolute bottom-36 left-4 right-20 z-20 sm:left-6 sm:right-24">
        <div className="flex min-w-0 items-center gap-3">
          {profilePath ? (
            <Link aria-label={displayName ? `View ${displayName}'s profile` : "View creator profile"} to={profilePath}>{creatorAvatar}</Link>
          ) : creatorAvatar}
          <div className="min-w-0">
            {displayName && <p className="truncate text-sm font-bold text-white">{displayName}</p>}
            {(username || uploadDate) && (
              <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-white/70">
                {fullName && username && <span className="truncate">@{username}</span>}
                {fullName && username && uploadDate && <span aria-hidden="true">·</span>}
                {uploadDate && <time dateTime={video.uploaded_at}>{uploadDate}</time>}
              </p>
            )}
          </div>
        </div>
        {video.caption && (
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-white">
            {video.caption}
          </p>
        )}
      </div>

      <div className="absolute bottom-[4.75rem] left-4 right-4 z-20 sm:left-6 sm:right-6">
        <input
          aria-label="Video progress"
          className="h-1 w-full cursor-pointer accent-white"
          max={duration || 0}
          min="0"
          onChange={seek}
          step="0.1"
          type="range"
          value={Math.min(currentTime, duration || 0)}
        />
        <div className="mt-1.5 flex items-center gap-3 text-white">
          <button aria-label={playing ? "Pause video" : "Play video"} onClick={togglePlayback} type="button">
            <Icon className="h-5 w-5" name={playing ? "pause" : "play"} />
          </button>
          <span className="text-[11px] font-medium tabular-nums text-white/80">
            {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
          </span>
          <div className="flex-1" />
          <button aria-label={muted ? "Unmute video" : "Mute video"} onClick={toggleMute} type="button">
            <Icon className="h-5 w-5" name={muted ? "volumeOff" : "volume"} />
          </button>
          {typeof document !== "undefined" && document.fullscreenEnabled && (
            <button aria-label="Enter fullscreen" onClick={enterFullscreen} type="button">
              <Icon className="h-5 w-5" name="maximize" />
            </button>
          )}
        </div>
      </div>

      {showComment && (
        <form
          className="absolute bottom-[4.5rem] left-3 right-3 z-40 rounded-card border border-white/10 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-xl sm:left-5 sm:right-5"
          onSubmit={handleComment}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Add a comment</p>
            <button
              aria-label="Close comment composer"
              className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setShowComment(false)}
              type="button"
            >
              <Icon className="h-4 w-4" name="x" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              aria-label="Comment"
              className="h-11 min-w-0 flex-1 rounded-control border border-white/10 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/30 focus:ring-2 focus:ring-white/10"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Write a comment"
              value={comment}
            />
            <button className="h-11 rounded-control bg-white px-4 text-sm font-semibold text-ink" type="submit">
              Post
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

const RailAction = ({ active = false, count, icon, label, onClick, text }) => (
  <div className="grid justify-items-center gap-1">
    <button
      aria-label={label}
      aria-pressed={icon === "heart" ? active : undefined}
      className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-xl transition ${active ? "border-rose-400/50 bg-rose-500 text-white" : "border-white/15 bg-black/30 text-white hover:bg-white/15"}`}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-6 w-6" name={icon} />
    </button>
    {(count !== undefined || text) && (
      <span className="text-[11px] font-semibold text-white">{count ?? text}</span>
    )}
  </div>
);

export default Videos;
