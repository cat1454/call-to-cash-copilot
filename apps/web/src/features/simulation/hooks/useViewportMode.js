import { useEffect, useState } from "react";

export function useViewportMode(maxMobileWidth = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= maxMobileWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [maxMobileWidth]);

  return isMobile;
}
