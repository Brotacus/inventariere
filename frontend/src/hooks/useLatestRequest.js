import { useEffect, useRef } from "react";

/** Ignore responses superseded by a newer request or a page change. */
export default function useLatestRequest() {
  const version = useRef(0);
  useEffect(() => () => { version.current += 1; }, []);
  return {
    begin: () => ++version.current,
    isCurrent: (request) => request === version.current,
  };
}
