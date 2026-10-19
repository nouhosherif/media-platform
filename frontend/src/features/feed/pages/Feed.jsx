import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import API from "../../../api";
import CreatePostModal from "../../../components/CreatePostModal";
import Icon from "../../../components/Icon";
import PostCard from "../../../components/PostCard";
import FeedIcon from "../FeedIcon";
import FeedBottomNav from "../FeedBottomNav";
import "../feed.css";

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return posts;

    return posts.filter((post) => {
      const username = String(post.user || "").toLowerCase();
      const fullName = String(post.user_full_name || "").toLowerCase();
      const mediaType = String(post.media_type || "").toLowerCase();
      const caption = String(post.caption || "").toLowerCase();
      const title = String(post.title || "").toLowerCase();
      return username.includes(normalizedQuery)
        || fullName.includes(normalizedQuery)
        || mediaType.includes(normalizedQuery)
        || caption.includes(normalizedQuery)
        || title.includes(normalizedQuery);
    });
  }, [posts, query]);

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("media/feed/");
      setPosts(res.data.results || res.data);
      setNextUrl(res.data.next || null);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.assign("/");
        return;
      }
      setError("Could not load feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchFeed(), 0);
    return () => clearTimeout(timer);
  }, [fetchFeed]);

  const loadMore = async () => {
    if (!nextUrl) return;

    const res = await API.get(nextUrl);
    setPosts((currentPosts) => [...currentPosts, ...res.data.results]);
    setNextUrl(res.data.next);
  };

  return (
    <div className="reference-feed">
      <div className="reference-feed-shell">
        <header className="feed-header">
          <div className="feed-toolbar">
            <Link
              aria-label="Open menu"
              className="feed-header-action"
              to="/menu"
            >
              <FeedIcon name="menu" />
            </Link>

            <h1 className="feed-title">Media</h1>

            <button
              aria-label="Create a post"
              className="feed-header-action feed-create"
              onClick={() => setComposerOpen(true)}
              type="button"
            >
              <FeedIcon name="plus" />
            </button>
          </div>

          <label className="feed-search">
            <FeedIcon name="search" />
            <input
              aria-label="Search feed"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              value={query}
            />
          </label>
        </header>

        <main className="feed-posts">
          {loading && (
            <div className="rounded-card border border-line bg-white p-5 text-sm text-muted shadow-card">
              Loading feed...
            </div>
          )}

          {error && (
            <div className="rounded-control border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className="rounded-card border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-card">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-control bg-slate-100 text-ink">
                <Icon className="h-6 w-6" name="image" />
              </div>
              <p className="mt-4 font-bold text-ink">No posts yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted">
                Use the create button to share text, photos, or video.
              </p>
            </div>
          )}

          {!loading && !error && posts.length > 0 && visiblePosts.length === 0 && (
            <div className="rounded-card border border-line bg-white p-5 text-center text-sm text-muted shadow-card">
              No matching posts.
            </div>
          )}

          {visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}

          {nextUrl && (
            <button
              className="h-12 w-full rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:bg-slate-50"
              onClick={loadMore}
              type="button"
            >
              Load more
            </button>
          )}
        </main>

      </div>
        <CreatePostModal
          onClose={() => setComposerOpen(false)}
          onCreated={(items) => setPosts((currentPosts) => [...items, ...currentPosts])}
          open={composerOpen}
        />

        <FeedBottomNav />
    </div>
  );
};

export default Feed;
