import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";

function timeAgo(value) {
  if (!value) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "acum";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} zile`;
}

export default function NotificationCenter({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  async function refresh() {
    try {
      const [notifications, unread] = await Promise.all([
        getNotifications({ limit: 30 }),
        getUnreadNotificationCount(),
      ]);
      setItems(notifications);
      setCount(unread.count || 0);
    } catch {
      // The rest of the app should remain usable even if notifications are unavailable.
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function closeOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  async function openPanel() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  }

  async function readItem(item) {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id);
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry));
        setCount((current) => Math.max(0, current - 1));
      } catch {
        // Non-critical UI action.
      }
    }
  }

  async function readAll() {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((entry) => ({ ...entry, is_read: true })));
      setCount(0);
    } catch {
      // Non-critical UI action.
    }
  }

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        className={`icon-button notification-button ${count ? "has-unread" : ""}`}
        aria-label="Notificări"
        title="Notificări"
        onClick={openPanel}
      >
        <Icon name="bell" />
        {count > 0 && <span className="notification-count">{count > 99 ? "99+" : count}</span>}
      </button>

      {open && (
        <div className="notification-popover">
          <div className="notification-popover-head">
            <div>
              <span className="panel-eyebrow">ACTIVITATE RECENTĂ</span>
              <strong>Notificări</strong>
            </div>
            {count > 0 && <button className="text-button" onClick={readAll}>Marchează toate citite</button>}
          </div>

          <div className="notification-list">
            {loading && <div className="notification-empty">Se încarcă...</div>}
            {!loading && !items.length && (
              <div className="notification-empty">
                <Icon name="check" size={22} />
                <strong>Totul este liniștit</strong>
                <span>Evenimentele importante vor apărea aici.</span>
              </div>
            )}
            {!loading && items.map((item) => (
              <button
                key={item.id}
                className={`notification-item ${item.is_read ? "read" : "unread"} severity-${item.severity.toLowerCase()}`}
                onClick={() => readItem(item)}
              >
                <span className="notification-severity-dot" />
                <span className="notification-copy">
                  <span className="notification-title-row">
                    <strong>{item.title}</strong>
                    <time>{timeAgo(item.created_at)}</time>
                  </span>
                  <span>{item.message}</span>
                </span>
              </button>
            ))}
          </div>

          <button
            className="notification-footer"
            onClick={() => {
              setOpen(false);
              onNavigate?.("Journal");
            }}
          >
            Vezi jurnalul detaliat <Icon name="arrow" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
