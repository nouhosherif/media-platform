import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../../../api";
import Icon from "../../../components/Icon";
import BottomNav from "../../../components/ui/BottomNav";

const tabs = [
  { id: "discover", label: "Discover" },
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
];

const Follows = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "discover";
  const [activeTab, setActiveTab] = useState(tabs.some((tab) => tab.id === initialTab) ? initialTab : "discover");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  const activeTitle = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTab)?.label || "People";
  }, [activeTab]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("users/follows/", {
        params: {
          tab: activeTab,
          ...(query.trim() ? { q: query.trim() } : {}),
        },
      });

      setUsers(res.data.results);
      setFollowersCount(res.data.followers_count);
      setFollowingCount(res.data.following_count);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.assign("/");
        return;
      }
      setError("Could not load people.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 200);

    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const toggleFollow = async (user) => {
    try {
      const res = await API.post(`users/follow/${user.id}/`);
      const isFollowing = res.data.is_following;

      setUsers((currentUsers) => {
        const updatedUsers = currentUsers.map((item) =>
          item.id === user.id
            ? {
                ...item,
                is_following: isFollowing,
                followers_count: res.data.followers_count,
              }
            : item
        );

        if (activeTab === "following" && !isFollowing) {
          return updatedUsers.filter((item) => item.id !== user.id);
        }

        return updatedUsers;
      });

      setFollowingCount(res.data.following_count);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.assign("/");
        return;
      }
      setError("Could not update follow status.");
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto min-h-screen w-full max-w-app border-x border-line bg-panel pb-24 shadow-sm">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between">
            <Link
              aria-label="Back to profile"
              className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-ink transition hover:bg-slate-200"
              to="/profile"
            >
              <Icon name="user" />
            </Link>

            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight">{activeTitle}</h1>
              <p className="text-xs font-medium text-muted">Find and connect with people</p>
            </div>

            <Link
              aria-label="Messages"
              className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-ink transition hover:bg-slate-200"
              to="/messages"
            >
              <Icon name="message" />
            </Link>
          </div>

          <label className="relative mt-4 block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              aria-label="Search people"
              className="h-12 w-full rounded-control border border-transparent bg-slate-100 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-subtle focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
              value={query}
            />
          </label>
        </header>

        <main>
          {error && (
            <div className="mx-4 mt-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
              {error}
            </div>
          )}

          <section className="grid grid-cols-2 border-b border-line px-4 py-4 sm:px-6">
            <FollowCount label="Followers" value={followersCount} />
            <FollowCount divided label="Following" value={followingCount} />
          </section>

          <section className="mx-4 mt-4 grid grid-cols-3 rounded-full bg-slate-100 p-1.5 text-sm font-semibold sm:mx-6">
            {tabs.map((tab) => (
              <button
                className={`h-11 rounded-full transition ${
                  activeTab === tab.id
                    ? "bg-ink text-white shadow-sm"
                    : "text-slate-600 hover:bg-white/70"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </section>

          <section className="mt-3 divide-y divide-slate-100">
            {loading ? (
              <p className="px-4 py-12 text-center text-sm font-medium text-muted">Loading people...</p>
            ) : users.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-muted">
                  <Icon name="user" />
                </div>
                <p className="mt-4 font-bold">No users found</p>
                <p className="mt-1 text-sm text-muted">
                  Try a different search or check back when more users join.
                </p>
              </div>
            ) : (
              users.map((user) => (
                <UserRow key={user.id} onToggleFollow={toggleFollow} user={user} />
              ))
            )}
          </section>
        </main>

        <BottomNav active="profile" />
      </div>
    </div>
  );
};

const FollowCount = ({ divided = false, label, value }) => (
  <div className={`px-3 py-2 text-center ${divided ? "border-l border-line" : ""}`}>
    <p className="text-xl font-extrabold text-ink">{value}</p>
    <p className="mt-0.5 text-xs font-medium text-muted">{label}</p>
  </div>
);

const UserRow = ({ onToggleFollow, user }) => (
  <article className="flex min-h-[76px] items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:px-6">
    <Link className="contents" to={`/profile/${user.id}`}>
      <Avatar user={user} />
    </Link>
    <Link className="min-w-0 flex-1" to={`/profile/${user.id}`}>
      <p className="truncate text-sm font-bold text-ink">{user.full_name || user.username}</p>
      <p className="truncate text-xs text-muted">@{user.username}</p>
      <p className="mt-1 text-xs text-subtle">{user.followers_count} followers</p>
    </Link>
    <button
      className={`h-10 rounded-full px-5 text-sm font-bold transition ${
        user.is_following
          ? "border border-line bg-white text-ink hover:bg-slate-50"
          : "bg-ink text-white hover:bg-charcoal"
      }`}
      onClick={() => onToggleFollow(user)}
      type="button"
    >
      {user.is_following ? "Following" : "Follow"}
    </button>
  </article>
);

const Avatar = ({ user }) => (
  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 text-lg font-bold text-slate-700">
    {user.profile_picture ? (
      <img alt="" className="h-full w-full object-cover" src={user.profile_picture} />
    ) : (
      (user.full_name || user.username || "U").charAt(0).toUpperCase()
    )}
  </div>
);

export default Follows;
