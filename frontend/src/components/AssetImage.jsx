import { useState } from "react";
import Icon from "./Icon";
import { mediaUrl } from "../services/api";

export default function AssetImage({ src, name, lazy = false }) {
  const [failedSource, setFailedSource] = useState(null);
  const [loadedSource, setLoadedSource] = useState(null);
  if (!src || failedSource === src) return <div className="public-asset-no-image" role="img" aria-label={`Fotografie indisponibilă pentru ${name}`}><Icon name="inventory" size={44} /><span>Fără fotografie</span></div>;
  return <img key={src} className={`public-photo${loadedSource === src ? " is-loaded" : ""}`} src={mediaUrl(src)} alt={name} width={640} height={480} decoding="async" loading={lazy ? "lazy" : "eager"} onLoad={() => setLoadedSource(src)} onError={() => setFailedSource(src)} />;
}
