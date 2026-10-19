import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import API from "../../../api";
import Icon from "../../../components/Icon";
import BottomNav from "../../../components/ui/BottomNav";
import OwnerProfileIcon from "../components/OwnerProfileIcon";
import "../owner-profile.css";

const emptyForm = {
  first_name: "",
  last_name: "",
  bio: "",
  phone_number: "",
  location: "",
};

const responseMessage = (details, fallback) => {
  if (!details) return fallback;
  if (typeof details === "string") return details;
  if (details.error || details.detail) return details.error || details.detail;
  const message = Object.entries(details)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("\n");
  return message || fallback;
};

const joinedLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

const Profile = () => {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [media, setMedia] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState(emptyForm);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const profilePhotoInputRef = useRef(null);
  const isOwnProfile = !userId || profile?.is_self;

  const visibleMedia = useMemo(() => {
    if (activeTab === "videos") return media.filter((item) => item.media_type === "video");
    if (activeTab === "photos") return media.filter((item) => item.media_type === "image");
    return media;
  }, [activeTab, media]);

  const displayName = profile?.full_name?.trim() || profile?.username || "";
  const initial = profile?.username?.charAt(0).toUpperCase() || "?";
  const joined = profile?.date_joined ? joinedLabel(profile.date_joined) : "";
  const profileStats = profile ? [
    ["Followers", profile.followers_count ?? 0],
    ["Following", profile.following_count ?? 0],
    ...(Number.isFinite(profile.likes_count) ? [["Likes", profile.likes_count]] : []),
  ] : [];
  const profileDetails = profile ? [
    ["phone", profile.phone_number || "Add phone number", !profile.phone_number],
    ["location", profile.location || "Add location", !profile.location],
    ["calendar", joined ? `Joined ${joined}` : "Join date unavailable", false],
  ] : [];

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const profilePath = userId ? `users/profile/${userId}/` : "users/profile/";
      const mediaPath = userId ? `media/user/${userId}/` : "media/my-media/";
      const [profileResponse, mediaResponse] = await Promise.all([
        API.get(profilePath),
        API.get(mediaPath),
      ]);
      setProfile(profileResponse.data);
      setMedia(mediaResponse.data.results || mediaResponse.data);
      setNextUrl(mediaResponse.data.next || null);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.assign("/");
        return;
      }
      setError("Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(fetchProfile, 0);
    return () => clearTimeout(timer);
  }, [fetchProfile]);

  const loadMore = async () => {
    if (!nextUrl) return;
    const response = await API.get(nextUrl);
    setMedia((current) => [...current, ...response.data.results]);
    setNextUrl(response.data.next);
  };

  const uploadProfilePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !isOwnProfile) return;
    const data = new FormData();
    data.append("profile_picture", file);
    try {
      setUploadingPhoto(true);
      setActionError("");
      const response = await API.post("users/profile/photo/", data);
      setProfile((current) => ({ ...current, profile_picture: response.data.profile_picture }));
    } catch (requestError) {
      setActionError(responseMessage(requestError.response?.data, "Profile photo upload failed."));
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const beginEdit = () => {
    if (!profile || !isOwnProfile) return;
    setEditValues({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      bio: profile.bio || "",
      phone_number: profile.phone_number || "",
      location: profile.location || "",
    });
    setActionError("");
    setEditing(true);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setActionError("");
      const response = await API.patch("users/profile/", editValues);
      setProfile(response.data);
      setEditing(false);
    } catch (requestError) {
      setActionError(responseMessage(requestError.response?.data, "Could not update profile."));
    } finally {
      setSaving(false);
    }
  };

  const toggleFollow = async () => {
    if (!profile || isOwnProfile) return;
    try {
      const response = await API.post(`users/follow/${profile.id}/`);
      setProfile((current) => ({
        ...current,
        is_following: response.data.is_following,
        followers_count: response.data.followers_count,
      }));
    } catch (requestError) {
      setActionError(responseMessage(requestError.response?.data, "Could not update follow status."));
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className={`${isOwnProfile ? "owner-profile " : ""}mx-auto min-h-screen w-full max-w-app border-x border-line bg-panel pb-24 shadow-sm`}>
        {loading && <div className="grid min-h-[60vh] place-items-center text-sm font-medium text-muted">Loading profile...</div>}
        {error && <div className="m-4 rounded-control border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && profile && (
          <main>
            <section className="owner-hero min-h-[370px] overflow-hidden bg-gradient-to-br from-[#f4f1ff] via-[#eaf2ff] to-[#e7ecff] px-5 pb-10 pt-5 [border-bottom-left-radius:48%_18%] [border-bottom-right-radius:48%_18%] sm:min-h-[405px] sm:px-8">
              <div className="owner-hero-actions flex items-center justify-between">
                <Link
                  aria-label={isOwnProfile ? "Open menu" : "Back to feed"}
                  className="owner-circle-action grid h-12 w-12 place-items-center rounded-full bg-white/90 text-ink shadow-card transition hover:scale-[1.03]"
                  to={isOwnProfile ? "/menu" : "/feed"}
                >
                  {isOwnProfile ? <OwnerProfileIcon name="menu" /> : <Icon className="h-6 w-6" name="home" />}
                </Link>
                {isOwnProfile ? (
                  <button
                    aria-label="Edit profile"
                    className="owner-circle-action grid h-12 w-12 place-items-center rounded-full bg-white/90 text-ink shadow-card transition hover:scale-[1.03]"
                    onClick={beginEdit}
                    type="button"
                  >
                    <OwnerProfileIcon name="edit" />
                  </button>
                ) : (
                  <Link
                    aria-label="Message user"
                    className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-ink shadow-card transition hover:scale-[1.03]"
                    to={`/messages?user=${profile.id}`}
                  >
                    <Icon className="h-6 w-6" name="message" />
                  </Link>
                )}
              </div>

              <div className="owner-identity -mt-3 grid justify-items-center px-6 text-center sm:-mt-5">
                <button
                  aria-label={isOwnProfile ? "Change profile photo" : "Profile photo"}
                  className="owner-avatar group relative grid h-36 w-36 place-items-center rounded-full border-[5px] border-white bg-slate-100 text-4xl font-extrabold text-slate-700 shadow-xl disabled:cursor-default sm:h-40 sm:w-40"
                  disabled={!isOwnProfile || uploadingPhoto}
                  onClick={() => profilePhotoInputRef.current?.click()}
                  type="button"
                >
                  {profile.profile_picture ? (
                    <img alt="" className="h-full w-full rounded-full object-cover" src={profile.profile_picture} />
                  ) : initial}
                  {uploadingPhoto && <span role="status" className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-sm text-white">Uploading...</span>}
                </button>
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={uploadProfilePhoto}
                  ref={profilePhotoInputRef}
                  type="file"
                />
                <h1 className="owner-name mt-4 max-w-full truncate text-3xl font-extrabold tracking-tight sm:text-4xl">{displayName}</h1>
                <p className="owner-subtitle mt-1 text-sm font-semibold text-slate-600">@{profile.username}</p>
                {profile.bio && <p className="owner-bio mt-2 max-w-md text-sm leading-6 text-muted sm:text-base">{profile.bio}</p>}
              </div>
            </section>

            <section className="owner-body px-4 pt-4 sm:px-6">
              <div className="owner-stats grid auto-cols-fr grid-flow-col items-center py-2 text-center">
                {profileStats.map(([label, value], index) => (
                  <ProfileStat divided={index > 0} key={label} label={label} linkable={isOwnProfile} value={value} />
                ))}
              </div>

              <div className="owner-tabs mt-5 grid grid-cols-3 rounded-full bg-slate-100 p-1.5">
                {[
                  ["all", "All"],
                  ["videos", isOwnProfile ? "Video" : "Videos"],
                  ["photos", "Photos"],
                ].map(([value, label]) => (
                  <button
                    aria-pressed={activeTab === value}
                    className={`h-11 rounded-full text-sm font-bold transition ${activeTab === value ? "bg-ink text-white shadow-sm" : "text-slate-700 hover:bg-white/70"}`}
                    key={value}
                    onClick={() => setActiveTab(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {isOwnProfile && profileDetails.length > 0 && (
                <div className="owner-info-card mt-5 overflow-hidden rounded-card border border-line bg-white shadow-card">
                  {profileDetails.map(([icon, value, missing]) => (
                    <ProfileDetail icon={icon} key={icon} onEdit={missing ? beginEdit : undefined} value={value} />
                  ))}
                </div>
              )}

              {actionError && <div className="mt-4 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}

              {editing && isOwnProfile && (
                <form className="mt-5 grid gap-4 rounded-card border border-line bg-slate-50 p-4 shadow-card sm:p-5" onSubmit={saveProfile}>
                  <div className="grid grid-cols-2 gap-3">
                    <ProfileInput label="First name" name="first_name" onChange={setEditValues} values={editValues} />
                    <ProfileInput label="Last name" name="last_name" onChange={setEditValues} values={editValues} />
                  </div>
                  <ProfileInput label="Bio" name="bio" onChange={setEditValues} values={editValues} />
                  <ProfileInput label="Phone number" name="phone_number" onChange={setEditValues} type="tel" values={editValues} />
                  <ProfileInput label="Location" name="location" onChange={setEditValues} values={editValues} />
                  <div className="grid grid-cols-2 gap-3">
                    <button className="h-12 rounded-control bg-ink text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
                      {saving ? "Saving..." : "Save profile"}
                    </button>
                    <button className="h-12 rounded-control border border-line bg-white text-sm font-bold" disabled={saving} onClick={() => setEditing(false)} type="button">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="owner-actions my-5">
                {isOwnProfile && !editing ? (
                  <button className="owner-edit flex h-14 w-full items-center justify-center gap-2 rounded-control bg-ink font-bold text-white shadow-card transition hover:bg-charcoal" onClick={beginEdit} type="button">
                    <OwnerProfileIcon name="pencil" />
                    Edit profile
                  </button>
                ) : !isOwnProfile ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Link className="grid h-14 place-items-center rounded-control bg-ink font-bold text-white shadow-card transition hover:bg-charcoal" to={`/messages?user=${profile.id}`}>
                      Message
                    </Link>
                    <button className={`h-14 rounded-control border font-bold transition ${profile.is_following ? "border-line bg-slate-100 text-ink" : "border-ink bg-white text-ink"}`} onClick={toggleFollow} type="button">
                      {profile.is_following ? "Following" : "Follow"}
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            {visibleMedia.length === 0 ? (
              <div className="px-4 py-14 text-center text-muted">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100">
                  <Icon className="h-6 w-6" name={activeTab === "videos" ? "video" : "image"} />
                </span>
                <p className="mt-3 font-semibold text-ink">No {activeTab === "all" ? "posts" : activeTab} yet</p>
              </div>
            ) : (
              <section aria-label="Profile media" className="owner-grid grid grid-cols-3 gap-2 px-4 sm:px-6">
                {visibleMedia.map((item) => <ProfileTile item={item} owner={isOwnProfile} key={item.id} />)}
              </section>
            )}

            {nextUrl && (
              <div className="p-4 sm:px-6">
                <button className="w-full rounded-control border border-line bg-white py-3 text-sm font-bold transition hover:bg-slate-50" onClick={loadMore} type="button">Load more</button>
              </div>
            )}
          </main>
        )}

      </div>
      <BottomNav active="profile" />
    </div>
  );
};

const ProfileInput = ({ label, name, onChange, type = "text", values }) => (
  <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
    {label}
    <input
      className="h-12 rounded-control border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      maxLength={name === "location" ? 120 : name === "phone_number" ? 32 : undefined}
      onChange={(event) => onChange((current) => ({ ...current, [name]: event.target.value }))}
      type={type}
      value={values[name]}
    />
  </label>
);

const ProfileDetail = ({ icon, onEdit, value }) => {
  const Row = onEdit ? "button" : "div";
  return (
    <Row className={`owner-detail flex min-h-[68px] w-full items-center gap-3 border-b border-slate-100 px-4 text-left last:border-b-0 ${onEdit ? "owner-detail-empty" : ""}`} onClick={onEdit} type={onEdit ? "button" : undefined}>
      <span className="owner-detail-icon grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-ink"><OwnerProfileIcon name={icon} /></span>
      <span className="owner-detail-text truncate text-sm font-semibold text-ink">{value}</span>
    </Row>
  );
};

const ProfileStat = ({ divided, label, linkable, value }) => {
  const content = (
    <>
      <p className="text-xl font-extrabold text-ink">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-muted">{label}</p>
    </>
  );
  const classes = `block w-full py-2 text-center ${divided ? "border-l border-line" : ""}`;
  if (linkable && (label === "Followers" || label === "Following")) {
    return <Link className={classes} to={`/follows?tab=${label.toLowerCase()}`}>{content}</Link>;
  }
  return <div className={classes}>{content}</div>;
};

const ProfileTile = ({ item, owner }) => (
  <div className="owner-tile relative aspect-square overflow-hidden rounded-media bg-slate-100">
    {item.media_type === "video" ? (
      <>
        <video className="h-full w-full object-cover" muted preload="metadata"><source src={item.file} /></video>
        <span className="owner-play absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white backdrop-blur">{owner ? <OwnerProfileIcon name="play" /> : <Icon className="h-3.5 w-3.5 fill-current" name="play" />}</span>
      </>
    ) : item.media_type === "image" ? (
      <img alt="" className="h-full w-full object-cover" src={item.file} />
    ) : (
      <div className="grid h-full place-items-center bg-slate-100 p-3"><p className="line-clamp-5 text-center text-xs font-medium text-slate-700">{item.caption}</p></div>
    )}
  </div>
);

export default Profile;

