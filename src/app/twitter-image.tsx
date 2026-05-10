// Twitter image — réutilise la composition Open Graph.
// On duplique au lieu de re-exporter pour que Next.js détecte
// correctement la directive `runtime = "edge"` (le re-export
// produisait des warnings au build).
import OpenGraphImage, {
  alt as ogAlt,
  size as ogSize,
  contentType as ogContentType,
} from "./opengraph-image";

export const runtime = "edge";
export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

export default OpenGraphImage;
