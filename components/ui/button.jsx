import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

const Button = React.forwardRef(({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-400 disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-green-600 text-white shadow hover:bg-green-700": variant === "default",
          "bg-red-600 text-white shadow-sm hover:bg-red-700": variant === "destructive",
          "border border-green-200 bg-white shadow-sm hover:bg-green-50 hover:text-green-700": variant === "outline",
          "bg-green-100 text-green-900 shadow-sm hover:bg-green-200": variant === "secondary",
          "hover:bg-green-50 hover:text-green-700": variant === "ghost",
          "text-green-600 underline-offset-4 hover:underline": variant === "link",
          "h-9 px-4 py-2": size === "default",
          "h-8 rounded-md px-3 text-xs": size === "sm",
          "h-10 rounded-md px-8": size === "lg",
          "h-11 rounded-md px-8": size === "xl"
        },
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };