
import { useEffect } from "react";


export function AutoRefresh({
  seconds = 15,
  onRefresh,
}: {
  seconds?: number;
  onRefresh: () => void;
}) {
  useEffect(() => {
    const id = setInterval(onRefresh, seconds * 1000);
    return () => clearInterval(id);
  }, [onRefresh, seconds]);

  return null;
}
