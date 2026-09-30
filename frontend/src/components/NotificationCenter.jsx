import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";
import { parseApiDate } from "../hooks/dateFormatting";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";

function timeAgo(value) {
  const date = parseApiDate(value);
  if (!date) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
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
  const [readingAll, setReadingAll] = useState(false);
  const [readingIds, setReadingIds] = useState(new Set());
  const [error, setError] = useState("");
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const pendingReads = useRef(new Set());
  const readingAllRef = useRef(false);
  const refreshVersion = useRef(0);
  const panelId = useId();

  async function refresh() {
    if (readingAllRef.current || pendingReads.current.size) return;
    const version = ++refreshVersion.current;
    try {
      const [notifications, unread] = await Promise.all([
        getNotifications({ limit: 30 }),
        getUnreadNotificationCount(),
      ]);
      if (version === refreshVersion.current) {
        setItems(notifications);
        setCount(unread.count || 0);
        setError("");
      }
    } catch {
      if (version === refreshVersion.current) setError("Notificările nu pot fi actualizate momentan.");
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 20000);
    return () => { window.clearInterval(timer); refreshVersion.current += 1; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function closeOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function closeWithEscape(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  async function readItem(item) {
    if (item.is_read || readingAllRef.current || pendingReads.current.has(item.id)) return;
    pendingReads.current.add(item.id);
    refreshVersion.current += 1;
    setReadingIds(new Set(pendingReads.current));
    try {
      await markNotificationRead(item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry));
      setCount((current) => Math.max(0, current - 1));
    } catch {
      setError("Notificarea nu a putut fi marcată drept citită. Încearcă din nou.");
    } finally {
      pendingReads.current.delete(item.id);
      setReadingIds(new Set(pendingReads.current));
    }
  }

  async function readAll() {
    if (readingAllRef.current || pendingReads.current.size || !count) return;
    readingAllRef.current = true;
    refreshVersion.current += 1;
    setReadingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((entry) => ({ ...entry, is_read: true })));
      setCount(0);
    } catch {
      setError("Notificările nu au putut fi marcate drept citite. Încearcă din nou.");
    } finally {
      readingAllRef.current = false;
      setReadingAll(false);
    }
  }

  return (
    <div className="notification-center" ref={rootRef} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        ref={triggerRef}
        type="button"
        className={`icon-button notification-button ${count ? "has-unread" : ""}`}
        aria-label="Notificări"
        title="Notificări"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" />
        {count > 0 && <span className="notification-count">{count > 99 ? "99+" : count}</span>}
      </button>

      {open && (
        <div className="notification-popover" id={panelId} role="region" aria-labelledby={`${panelId}-title`}>
          <div className="notification-popover-head">
            <div>
              <span className="panel-eyebrow">ACTIVITATE RECENTĂ</span>
              <strong id={`${panelId}-title`}>Notificări</strong>
            </div>
            {count > 0 && <button type="button" className="text-button" onClick={readAll} disabled={readingAll || readingIds.size > 0}>{readingAll ? "Se salvează..." : "Marchează toate citite"}</button>}
            <button type="button" className="icon-button notification-close" aria-label="Închide notificările" onClick={() => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }}><Icon name="close" size={18} /></button>
          </div>

          <div className="notification-list" aria-busy={loading}>
            {error && <div className="notification-error" role="alert">{error}<button type="button" className="text-button" disabled={loading} onClick={() => { setLoading(true); refresh().finally(() => setLoading(false)); }}>Reîncearcă</button></div>}
            {loading && <div className="notification-load-status" role="status">Se încarcă…</div>}
            {!loading && !error && !items.length && (
              <div className="notification-empty">
                <Icon name="check" size={22} />
                <strong>Totul este liniștit</strong>
                <span>Evenimentele importante vor apărea aici.</span>
              </div>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`notification-item ${item.is_read ? "read" : "unread"} severity-${(item.severity || "info").toLowerCase()}`}
                onClick={() => readItem(item)}
                disabled={readingAll || readingIds.has(item.id)}
                aria-busy={readingIds.has(item.id)}
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
            type="button"
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
