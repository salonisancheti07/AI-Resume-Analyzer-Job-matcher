import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const DASHBOARD_NOTIFICATIONS_KEY = "dashboard_notifications_hidden";
const DASHBOARD_ACTIVITY_NOTIFICATIONS_KEY = "dashboard_activity_notifications";

const typeRoute = {
  resume: "/feedback",
  jobs: "/matcher",
  workflow: "/matcher",
  interview: "/interview",
  learning: "/coach",
  general: "/dashboard",
};

const typeMeta = {
  resume: { icon: "Resume", tone: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  jobs: { icon: "Jobs", tone: "text-sky-700 bg-sky-50 border-sky-200" },
  workflow: { icon: "Flow", tone: "text-teal-700 bg-teal-50 border-teal-200" },
  interview: { icon: "Interview", tone: "text-amber-700 bg-amber-50 border-amber-200" },
  learning: { icon: "Learning", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  general: { icon: "Update", tone: "text-slate-700 bg-slate-50 border-slate-200" },
};

const priorityMeta = {
  high: { label: "High priority", tone: "text-rose-700 bg-rose-100" },
  medium: { label: "Medium priority", tone: "text-amber-700 bg-amber-100" },
  low: { label: "Low priority", tone: "text-slate-700 bg-slate-100" },
};

const formatRelativeTime = (value) => {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

export default function Notifications() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [hiddenNotifications, setHiddenNotifications] = useState([]);
  const [activityNotifications, setActivityNotifications] = useState([]);
  const [statusFilter, setStatusFilter] = useState("unread");
  const [typeFilter, setTypeFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const profile = await api.profile();
        const savedHidden = JSON.parse(localStorage.getItem(DASHBOARD_NOTIFICATIONS_KEY) || "[]");
        const savedActivity = JSON.parse(localStorage.getItem(DASHBOARD_ACTIVITY_NOTIFICATIONS_KEY) || "[]");

        setData(profile);

        const serverHidden = Array.isArray(profile.dashboardState?.hiddenNotifications)
          ? profile.dashboardState.hiddenNotifications
          : [];
        const localHidden = Array.isArray(savedHidden) ? savedHidden : [];
        setHiddenNotifications(Array.from(new Set([...serverHidden, ...localHidden])));

        const serverActivity = Array.isArray(profile.dashboardState?.customNotifications)
          ? profile.dashboardState.customNotifications
          : [];
        const localActivity = Array.isArray(savedActivity) ? savedActivity : [];
        setActivityNotifications([...serverActivity, ...localActivity]);
      } catch (e) {
        setError(e.message || "Failed to load notifications");
      }
    })();
  }, []);

  const persistNotificationState = async (nextHidden, nextActivity = activityNotifications) => {
    setHiddenNotifications(nextHidden);
    setActivityNotifications(nextActivity);
    localStorage.setItem(DASHBOARD_NOTIFICATIONS_KEY, JSON.stringify(nextHidden));
    localStorage.setItem(DASHBOARD_ACTIVITY_NOTIFICATIONS_KEY, JSON.stringify(nextActivity));
    try {
      await api.saveDashboardState({
        hiddenNotifications: nextHidden,
        customNotifications: nextActivity,
      });
    } catch {
      // Keep local persistence as a fallback.
    }
  };

  const allNotifications = useMemo(() => {
    const defaultNotifications = data?.notificationsCenter || [];
    return [...activityNotifications, ...defaultNotifications];
  }, [activityNotifications, data]);

  const typeOptions = useMemo(() => {
    const set = new Set(allNotifications.map((item) => item.type || "general"));
    return ["all", ...Array.from(set)];
  }, [allNotifications]);

  const filteredNotifications = useMemo(() => {
    return allNotifications.filter((item) => {
      const isRead = hiddenNotifications.includes(item.id);
      const matchesStatus =
        statusFilter === "all" ? true : statusFilter === "read" ? isRead : !isRead;
      const matchesType = typeFilter === "all" ? true : (item.type || "general") === typeFilter;
      return matchesStatus && matchesType;
    });
  }, [allNotifications, hiddenNotifications, statusFilter, typeFilter]);

  const groupedNotifications = useMemo(
    () =>
      filteredNotifications.reduce((acc, item) => {
        const key = item.type || "general";
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {}),
    [filteredNotifications]
  );

  const unreadCount = allNotifications.filter((item) => !hiddenNotifications.includes(item.id)).length;
  const readCount = allNotifications.length - unreadCount;

  const markAsRead = (id) => {
    if (hiddenNotifications.includes(id)) return;
    persistNotificationState([...hiddenNotifications, id]);
  };

  const markAsUnread = (id) => {
    persistNotificationState(hiddenNotifications.filter((item) => item !== id));
  };

  const markAllAsRead = () => {
    persistNotificationState(allNotifications.map((item) => item.id));
  };

  const markAllAsUnread = () => {
    persistNotificationState([]);
  };

  const openNotification = (item) => {
    if (item?.id && !hiddenNotifications.includes(item.id)) {
      markAsRead(item.id);
    }
    navigate(typeRoute[item.type] || "/dashboard");
  };

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading notifications...</p>;

  return (
    <div className="notifications-theme-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="pill">Attention Center</div>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">Notifications</h2>
          <p className="mt-1 text-sm text-slate-500">
            Track resume, jobs, interview, learning, and workflow updates in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={markAllAsRead}
            className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700"
          >
            Mark all read
          </button>
          <button
            type="button"
            onClick={markAllAsUnread}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Reset unread
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5 bg-gradient-to-br from-rose-50 to-white border-rose-100">
          <div className="text-xs uppercase tracking-wide text-rose-700 font-semibold">Unread</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{unreadCount}</div>
          <div className="text-xs text-slate-500">Needs attention right now</div>
        </div>
        <div className="card p-5 bg-gradient-to-br from-slate-50 to-white border-slate-200">
          <div className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Read</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{readCount}</div>
          <div className="text-xs text-slate-500">Already reviewed</div>
        </div>
        <div className="card p-5 bg-gradient-to-br from-teal-50 to-white border-teal-100">
          <div className="text-xs uppercase tracking-wide text-teal-700 font-semibold">Total</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{allNotifications.length}</div>
          <div className="text-xs text-slate-500">Across all activity types</div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Filter by status</div>
          <div className="flex flex-wrap gap-2">
            {["unread", "read", "all"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatusFilter(item)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  statusFilter === item
                    ? "bg-teal-700 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold">Filter by type</div>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTypeFilter(item)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  typeFilter === item
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {item === "all" ? "All types" : item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {Object.entries(groupedNotifications).map(([group, items]) => (
          <div key={group} className="card p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{items.length} alerts</div>
              </div>
            </div>
            <div className="space-y-3">
              {items.map((item) => {
                const isRead = hiddenNotifications.includes(item.id);
                const typeInfo = typeMeta[item.type] || typeMeta.general;
                const priorityInfo = priorityMeta[item.priority] || priorityMeta.low;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border px-4 py-4 ${
                      isRead
                        ? "border-slate-200 bg-slate-50/80"
                        : item.priority === "high"
                          ? "border-rose-200 bg-rose-50"
                          : "border-sky-200 bg-sky-50/70"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeInfo.tone}`}>
                            {typeInfo.icon}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityInfo.tone}`}>
                            {priorityInfo.label}
                          </span>
                          <span className="text-[11px] text-slate-400">{formatRelativeTime(item.createdAt)}</span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-2 text-sm text-slate-600">{item.message}</div>
                      </div>
                      <div className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {isRead ? "Read" : "Unread"}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openNotification(item)}
                        className="rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700"
                      >
                        {item.cta}
                      </button>
                      {isRead ? (
                        <button
                          type="button"
                          onClick={() => markAsUnread(item.id)}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Mark unread
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markAsRead(item.id)}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!filteredNotifications.length && (
          <div className="card p-8 text-center">
            <div className="text-lg font-semibold text-slate-900">No notifications in this view</div>
            <div className="mt-2 text-sm text-slate-500">
              Try switching the status or type filter to see more alerts.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
