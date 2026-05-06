import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import Icon from "../components/Icon";

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [media, setMedia] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [activeTab, setActiveTab] = useState("posts");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const visibleMedia = useMemo(() => {
    if (activeTab === "videos") {
      return media.filter((item) => item.media_type === "video");
    }

    return media;
  }, [activeTab, media]);

  const displayName = profile?.full_name || profile?.username || "Media user";
  const username = profile?.username || "profile";
  const initial = username.charAt(0).toUpperCase() || "M";

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const [profileRes, mediaRes] = await Promise.all([
        API.get("users/profile/"),
        API.get("media/my-media/"),
      ]);

      setProfile(profileRes.data);
      setMedia(mediaRes.data.results || mediaRes.data);
      setNextUrl(mediaRes.data.next);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/";
        return;
      }
      setError("Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextUrl) {
      return;
    }

    const res = await API.get(nextUrl);
    setMedia((currentMedia) => [...currentMedia, ...res.data.results]);
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

      setMedia((currentMedia) => [res.data, ...currentMedia]);
      setProfile((currentProfile) => ({
        ...currentProfile,
        posts_count: (currentProfile?.posts_count || 0) + 1,
      }));
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
      <div className="mx-auto min-h-screen max-w-md border-x border-slate-200 bg-white pb-24 shadow-sm">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <button
              aria-label="Profile settings"
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-800"
              type="button"
            >
              <Icon name="settings" />
            </button>

            <h1 className="max-w-[190px] truncate text-lg font-bold">{username}</h1>

            <button
              aria-label="Add profile content"
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Icon name="plus" />
            </button>

            <input
              accept="image/jpeg,image/png,video/mp4"
              className="hidden"
              onChange={handleUpload}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </header>

        {loading && (
          <main className="p-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Loading profile...
            </div>
          </main>
        )}

        {error && (
          <main className="p-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          </main>
        )}

        {!loading && !error && profile && (
          <main>
            {uploadError && (
              <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {uploadError}
              </div>
            )}

            <section className="px-4 py-5">
              <div className="flex items-center gap-5">
                <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[3px]">
                  <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border-4 border-white bg-sky-100 text-3xl font-bold text-sky-700">
                    {profile.profile_picture ? (
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={profile.profile_picture}
                      />
                    ) : (
                      initial
                    )}
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-3 text-center">
                  <ProfileStat label="Posts" value={profile.posts_count ?? media.length} />
                  <ProfileStat label="Followers" value={profile.followers_count ?? 0} />
                  <ProfileStat label="Following" value={profile.following_count ?? 0} />
                </div>
              </div>

              <div className="mt-4">
                <p className="font-semibold">{displayName}</p>
                <p className="text-sm text-slate-500">{profile.email}</p>
                {profile.bio && <p className="mt-2 text-sm text-slate-800">{profile.bio}</p>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  className="h-9 rounded-lg border border-slate-300 bg-slate-50 text-sm font-semibold"
                  type="button"
                >
                  Edit profile
                </button>
                <button
                  className="h-9 rounded-lg border border-slate-300 bg-slate-50 text-sm font-semibold"
                  type="button"
                >
                  Share profile
                </button>
              </div>

              <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
                <StoryBubble
                  disabled={uploading}
                  icon="plus"
                  label={uploading ? "Uploading" : "New"}
                  onClick={() => fileInputRef.current?.click()}
                />
                <StoryBubble label="Photos" icon="image" />
                <StoryBubble label="Videos" icon="video" />
              </div>
            </section>

            <div className="grid grid-cols-2 border-y border-slate-200">
              <button
                className={`grid h-12 place-items-center border-b-2 ${
                  activeTab === "posts"
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-400"
                }`}
                onClick={() => setActiveTab("posts")}
                type="button"
              >
                <Icon name="grid" />
              </button>
              <button
                className={`grid h-12 place-items-center border-b-2 ${
                  activeTab === "videos"
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-400"
                }`}
                onClick={() => setActiveTab("videos")}
                type="button"
              >
                <Icon name="video" />
              </button>
            </div>

            {visibleMedia.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-slate-300 text-slate-500">
                  <Icon name={activeTab === "videos" ? "video" : "image"} />
                </div>
                <p className="mt-3 font-semibold">
                  {activeTab === "videos" ? "No videos yet" : "No posts yet"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Upload from the feed to build your profile grid.
                </p>
              </div>
            ) : (
              <section className="grid grid-cols-3 gap-1 bg-white">
                {visibleMedia.map((item) => (
                  <ProfileTile item={item} key={item.id} />
                ))}
              </section>
            )}

            {nextUrl && activeTab === "posts" && (
              <div className="p-4">
                <button
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 text-sm font-semibold"
                  onClick={loadMore}
                  type="button"
                >
                  Load more
                </button>
              </div>
            )}
          </main>
        )}

        <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-slate-200 bg-white px-3 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
          <Link className="grid place-items-center gap-1 text-slate-500" to="/feed">
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
          <Link className="grid place-items-center gap-1 text-slate-950" to="/profile">
            <Icon name="user" />
            <span className="text-[11px] font-semibold">Profile</span>
          </Link>
        </nav>
      </div>
    </div>
  );
};

const ProfileStat = ({ label, value }) => (
  <div>
    <p className="text-lg font-bold">{value}</p>
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);

const StoryBubble = ({ disabled = false, icon, label, onClick }) => (
  <button
    className="grid w-16 shrink-0 justify-items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    <span className="grid h-14 w-14 place-items-center rounded-full border border-slate-300 bg-slate-50 text-slate-700">
      <Icon name={icon} />
    </span>
    <span className="max-w-full truncate text-xs font-medium">{label}</span>
  </button>
);

const ProfileTile = ({ item }) => (
  <div className="relative aspect-square overflow-hidden bg-slate-100">
    {item.media_type === "video" ? (
      <>
        <video className="h-full w-full object-cover" muted preload="metadata">
          <source src={item.file} />
        </video>
        <span className="absolute right-2 top-2 text-white drop-shadow">
          <Icon name="video" className="h-4 w-4" />
        </span>
      </>
    ) : (
      <img alt="" className="h-full w-full object-cover" src={item.file} />
    )}
  </div>
);

export default Profile;
