import * as React from "react";
import { cn } from "../../lib/utils";

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-green-100 bg-white/70 backdrop-blur text-green-900 shadow-sm transition-all duration-200",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

export { Card };