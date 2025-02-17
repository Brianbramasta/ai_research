"use client";

import * as React from "react";

const CustomScrollArea = React.forwardRef(({ children, className, ...props }, ref) => (
  <div
    ref={ref}
    className={`overflow-auto ${className}`}
    style={{ 
      scrollbarWidth: 'auto',
      scrollbarColor: 'rgb(203 213 225) transparent',
      WebkitOverflowScrolling: 'touch'
    }}
    {...props}
  >
    {children}
  </div>
));

CustomScrollArea.displayName = "CustomScrollArea";

export { CustomScrollArea };
