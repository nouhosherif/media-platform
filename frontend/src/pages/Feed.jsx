import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import Icon from "../components/Icon";
import PostCard from "../components/PostCard";

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFeed();
  }, []);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return posts;
    }

    return posts.filter((post) => {
      const username = String(post.user || "").toLowerCase();
      const mediaType = String(post.media_type || "").toLowerCase();
      return username.includes(normalizedQuery) || mediaType.includes(normalizedQuery);
    });
  }, [posts, query]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("media/feed/");
      setPosts(res.data.results || res.data);
      setNextUrl(res.data.next);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/";
        return;
      }
      setError("Could not load feed.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextUrl) return;

    const res = await API.get(nextUrl);
    setPosts([...posts, ...res.data.results]);
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

      setPosts((currentPosts) => [res.data, ...currentPosts]);
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
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto min-h-screen max-w-md border-x border-slate-200 bg-[#f7f8fb] pb-24 shadow-sm">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <button
              aria-label="Open menu"
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-800"
              type="button"
            >
              <Icon name="menu" />
            </button>

            <h1 className="text-2xl font-bold tracking-normal">Media</h1>

            <button
              aria-label="Add media"
              className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Icon name="plus" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <label className="relative block flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <input
                aria-label="Search feed"
                className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                value={query}
              />
            </label>
          </div>

          <input
            accept="image/jpeg,image/png,video/mp4"
            className="hidden"
            onChange={handleUpload}
            ref={fileInputRef}
            type="file"
          />
        </header>

        <main className="space-y-4 px-4 py-4">
          {uploadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {uploadError}
            </div>
          )}

          {loading && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Loading feed...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-amber-100 text-amber-700">
                <Icon name="image" />
              </div>
              <p className="mt-3 font-semibold text-slate-900">No posts yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Use the add button to upload your first photo or video.
              </p>
            </div>
          )}

          {!loading && !error && posts.length > 0 && visiblePosts.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
              No matching posts.
            </div>
          )}

          {visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}

          {nextUrl && (
            <button
              className="w-full rounded-lg border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700"
              onClick={loadMore}
              type="button"
            >
              Load more
            </button>
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-slate-200 bg-white px-3 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
          <Link className="grid place-items-center gap-1 text-slate-950" to="/feed">
            <Icon name="home" />
            <span className="text-[11px] font-semibold">Home</span>
          </Link>
          <Link className="grid place-items-center gap-1 text-slate-500" to="/videos">
            <Icon name="video" />
            <span className="text-[11px] font-semibold">Video</span>
          </Link>
          <button className="grid place-items-center gap-1 text-slate-500" type="button">
            <Icon name="message" />
            <span className="text-[11px] font-semibold">Message</span>
          </button>
          <button className="grid place-items-center gap-1 text-slate-500" type="button">
            <Icon name="notification" />
            <span className="text-[11px] font-semibold">Notification</span>
          </button>
          <Link className="grid place-items-center gap-1 text-slate-500" to="/profile">
            <Icon name="user" />
            <span className="text-[11px] font-semibold">Profile</span>
          </Link>
        </nav>
      </div>
    </div>
  );
};

export default Feed;
