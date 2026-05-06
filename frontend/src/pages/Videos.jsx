import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import Icon from "../components/Icon";

const Videos = () => {
  const [videos, setVideos] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const onlyVideos = (items) => items.filter((item) => item.media_type === "video");

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("media/feed/");
      setVideos(onlyVideos(res.data.results || res.data));
      setNextUrl(res.data.next);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/";
        return;
      }
      setError("Could not load videos.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextUrl) {
      return;
    }

    const res = await API.get(nextUrl);
    setVideos((currentVideos) => [...currentVideos, ...onlyVideos(res.data.results)]);
    setNextUrl(res.data.next);
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const data = new FormData();
    data.append("file", file);

    try {
      setUploading(true);
      setUploadError("");
      const res = await API.post("media/upload/", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.media_type === "video") {
        setVideos((currentVideos) => [res.data, ...currentVideos]);
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/";
        return;
      }
      setUploadError(getErrorMessage(err.response?.data, "Upload failed."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const getErrorMessage = (details, fallback) => {
    if (!details) {
      return fallback;
    }

    if (typeof details === "string") {
      return details;
    }

    if (details.error || details.detail) {
      return details.error || details.detail;
    }

    const messages = Object.entries(details)
      .map(([field, value]) => {
        const message = Array.isArray(value) ? value.join(", ") : value;
        return `${field}: ${message}`;
      })
      .join("\n");

    return messages || fallback;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto min-h-screen max-w-md bg-black">
        <header className="fixed left-1/2 top-0 z-30 flex w-full max-w-md -translate-x-1/2 items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-4">
          <Link
            aria-label="Back to feed"
            className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white backdrop-blur"
            to="/feed"
          >
            <Icon name="home" />
          </Link>

          <h1 className="text-xl font-bold">Videos</h1>

          <button
            aria-label="Upload video"
            className="grid h-10 w-10 place-items-center rounded-lg bg-white text-slate-950 disabled:cursor-not-allowed disabled:bg-white/40"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Icon name="plus" />
          </button>

          <input
            accept="video/mp4"
            className="hidden"
            onChange={handleUpload}
            ref={fileInputRef}
            type="file"
          />
        </header>

        {uploadError && (
          <div className="fixed left-1/2 top-20 z-40 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-lg border border-red-400/50 bg-red-950/90 px-3 py-2 text-sm text-red-100">
            {uploadError}
          </div>
        )}

        {loading && (
          <div className="grid h-screen place-items-center px-6 text-sm text-white/70">
            Loading videos...
          </div>
        )}

        {error && (
          <div className="grid h-screen place-items-center px-6 text-center text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="grid h-screen place-items-center px-6 text-center">
            <div>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-white/10 text-white">
                <Icon name="video" />
              </div>
              <p className="mt-4 text-lg font-semibold">No videos yet</p>
              <p className="mt-1 text-sm text-white/60">
                Upload an MP4 video and it will appear here and in the main feed.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && videos.length > 0 && (
          <main className="h-screen snap-y snap-mandatory overflow-y-auto">
            {videos.map((video) => (
              <ReelCard key={video.id} video={video} />
            ))}

            {nextUrl && (
              <section className="grid h-screen snap-start place-items-center px-4">
                <button
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950"
                  onClick={loadMore}
                  type="button"
                >
                  Load more videos
                </button>
              </section>
            )}
          </main>
        )}

        <nav className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-white/10 bg-black/80 px-3 py-3 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
          <Link className="grid place-items-center gap-1 text-white/60" to="/feed">
            <Icon name="home" />
            <span className="text-[11px] font-semibold">Home</span>
          </Link>
          <Link className="grid place-items-center gap-1 text-white" to="/videos">
            <Icon name="video" />
            <span className="text-[11px] font-semibold">Video</span>
          </Link>
          <button className="grid place-items-center gap-1 text-white/60" type="button">
            <Icon name="message" />
            <span className="text-[11px] font-semibold">Message</span>
          </button>
          <button className="grid place-items-center gap-1 text-white/60" type="button">
            <Icon name="notification" />
            <span className="text-[11px] font-semibold">Notification</span>
          </button>
          <Link className="grid place-items-center gap-1 text-white/60" to="/profile">
            <Icon name="user" />
            <span className="text-[11px] font-semibold">Profile</span>
          </Link>
        </nav>
      </div>
    </div>
  );
};

const ReelCard = ({ video }) => {
  const [likes, setLikes] = useState(video.likes_count || 0);
  const [liked, setLiked] = useState(false);
  const username = video.user || "media user";
  const initial = username.charAt(0).toUpperCase() || "M";

  const handleLike = async () => {
    try {
      await API.post(`media/like/${video.id}/`);
      setLikes((currentLikes) => (liked ? Math.max(currentLikes - 1, 0) : currentLikes + 1));
      setLiked((currentLiked) => !currentLiked);
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

  return (
    <section className="relative h-screen snap-start overflow-hidden bg-black" id={`video-${video.id}`}>
      <video
        className="h-full w-full object-contain"
        controls
        loop
        playsInline
        preload="metadata"
      >
        <source src={video.file} />
      </video>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      <div className="absolute bottom-24 left-4 right-20">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-slate-950">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{username}</p>
            <p className="text-xs text-white/70">Uploaded video</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-28 right-4 grid gap-4">
        <button
          aria-label="Like video"
          className={`grid h-12 w-12 place-items-center rounded-full border border-white/15 backdrop-blur ${
            liked ? "bg-rose-500 text-white" : "bg-white/15 text-white"
          }`}
          onClick={handleLike}
          type="button"
        >
          <Icon name="heart" />
        </button>
        <span className="-mt-3 text-center text-xs font-semibold">{likes}</span>

        <button
          aria-label="Comments"
          className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/15 text-white backdrop-blur"
          type="button"
        >
          <Icon name="message" />
        </button>

        <button
          aria-label="Share video"
          className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/15 text-white backdrop-blur"
          onClick={handleShare}
          type="button"
        >
          <Icon name="share" />
        </button>
      </div>
    </section>
  );
};

export default Videos;
