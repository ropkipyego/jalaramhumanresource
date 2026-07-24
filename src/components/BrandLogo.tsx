import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_LOGO_URL, FALLBACK_LOGO_URL, resolveLogoUrl } from "@/lib/brand";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
};

/** Hospital logo with graceful fallback if the local file is missing. */
export function BrandLogo({ src, alt = "Jalaram Hospital", className }: Props) {
  const [url, setUrl] = useState(resolveLogoUrl(src));

  useEffect(() => {
    setUrl(resolveLogoUrl(src));
  }, [src]);

  return (
    <img
      src={url}
      alt={alt}
      className={cn("object-contain", className)}
      onError={() => {
        if (url !== FALLBACK_LOGO_URL && url !== DEFAULT_LOGO_URL) {
          setUrl(DEFAULT_LOGO_URL);
        } else if (url === DEFAULT_LOGO_URL) {
          setUrl(FALLBACK_LOGO_URL);
        }
      }}
    />
  );
}
