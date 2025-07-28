import * as colors from "@std/fmt/colors";
import { Box, Text, measureElement } from "ink";
import React, { useEffect, useRef, useState } from "react";

export const ProgressBar: React.FC<{ percent: number }> = ({ percent }) => {
  const ref = useRef<any>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const { width: measuredWidth } = measureElement(ref.current);
      setWidth(measuredWidth);
    }
  }, []);

  let content = "";
  if (width > 0) {
    const loaded = Math.max(0, Math.round(percent * width));
    const rest = Math.max(0, width - loaded);
    content = colors.cyan("█".repeat(loaded) + "░".repeat(rest));
  }

  return (
    <Box flexGrow={1} height={1} ref={ref}>
      <Text>{content}</Text>
    </Box>
  );
};
