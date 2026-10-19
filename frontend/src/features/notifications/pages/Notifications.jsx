import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../../../api";
import Icon from "../../../components/Icon";
import BottomNav from "../../../components/ui/BottomNav";

const handleAuthError = (err) => {
  if (err.response?.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    window.location.assign("/");
  }
};

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("users/notifications/");
      setNotifications(res.data.results);
      setUnreadCount(res.data.unread_count);
      setTotalCount(res.data.total_count);
    } catch (err) {
      handleAuthError(err);
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchNotifications]);

  const markRead = async (notification) => {
    if (notification.is_read) {
      return;
    }

    try {
      const res = await API.post(`users/notifications/${notification.id}/read/`);
      setNotifications((currentNotifications) =>
        currentNotifications.map((item) => (item.id === notification.id ? res.data : item))
      );
      setUnreadCount((currentCount) => Math.max(currentCount - 1, 0));
    } catch (err) {
      handleAuthError(err);
      setError("Could not update notification.");
    }
  };

  const markAllRead = async () => {
    try {
      await API.post("users/notifications/mark-all-read/");
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({ ...notification, is_read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      handleAuthError(err);
      setError("Could not update notifications.");
    }
  };

  const openNotification = async (notification) => {
    await markRead(notification);

    const target = notification.target_url && notification.target_url !== "/profile"
      ? notification.target_url
      : notification.actor?.id
        ? `/profile/${notification.actor.id}`
        : "";

    if (target) {
      navigate(target);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto min-h-screen w-full max-w-app border-x border-line bg-panel pb-24 shadow-sm">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              aria-label="Back to feed"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-ink transition hover:bg-slate-200"
              to="/feed"
            >
              <Icon name="home" />
            </Link>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">Notifications</h1>
              <p className="mt-0.5 text-xs font-medium text-muted">
                {totalCount} {totalCount === 1 ? "notification" : "notifications"}
                {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
              </p>
            </div>

            <button
              className="h-10 shrink-0 rounded-full border border-line bg-white px-4 text-xs font-bold text-ink transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={unreadCount === 0}
              onClick={markAllRead}
              type="button"
            >
              Read all
            </button>
          </div>
        </header>

        <main>
          {error && (
            <div className="mx-4 mt-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
              {error}
            </div>
          )}

          <section aria-label="Account activity" className="divide-y divide-slate-100">
            {loading ? (
              <p className="px-4 py-12 text-center text-sm font-medium text-muted">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-20 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-muted">
                  <Icon name="notification" />
                </div>
                <p className="mt-4 font-bold">No notifications yet</p>
                <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted">
                  Your account activity will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onRead={openNotification}
                />
              ))
            )}
          </section>
        </main>

        <BottomNav active="notifications" />
      </div>
    </div>
  );
};

const NotificationCard = ({ notification, onRead }) => (
  <button
    className={`flex min-h-[78px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-6 ${notification.is_read ? "bg-white" : "bg-slate-50/80"}`}
    onClick={() => onRead(notification)}
    type="button"
  >
    <div
      className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-muted"
    >
      {notification.actor?.profile_picture ? (
        <img alt="" className="h-full w-full object-cover" src={notification.actor.profile_picture} />
      ) : (
        <Icon name={getNotificationIcon(notification.notification_type)} />
      )}
    </div>

    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm leading-5 ${notification.is_read ? "font-medium text-slate-700" : "font-semibold text-ink"}`}>{notification.message}</p>
          <p className="mt-1 text-xs text-subtle">{formatDate(notification.created_at)}</p>
        </div>
      </div>
    </div>

    {!notification.is_read && <span aria-label="Unread" className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink" />}
  </button>
);

const getNotificationIcon = (type) => {
  if (type === "message") {
    return "message";
  }

  if (type === "follow") {
    return "user";
  }

  return "notification";
};

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default Notifications;
