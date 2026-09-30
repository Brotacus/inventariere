import { useRef, useState } from "react";

// The ref closes the gap before React renders the disabled controls.
export default function usePendingAction() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  function beginAction() {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    return true;
  }
  function endAction() {
    pending.current = false;
    setBusy(false);
  }
  return { busy, beginAction, endAction };
}
