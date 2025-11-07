import { type ComponentProps } from "react";
import { Toaster as SonnerToaster } from "sonner";

export { toast } from "sonner";

export type ToasterProps = ComponentProps<typeof SonnerToaster>;

export function Toaster({ position = "bottom-center", richColors = true, ...props }: ToasterProps) {
  return (
    <SonnerToaster
      position={position}
      richColors={richColors}
      offset="80px"
      toastOptions={{
        classNames: {
          toast: "border border-gray-200 bg-white text-gray-900 shadow-lg",
          description: "text-gray-600",
        },
      }}
      {...props}
    />
  );
}
