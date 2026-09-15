declare module "sonner" {
  import type { ComponentType, ReactNode } from "react";

  interface ToastOptions {
    description?: ReactNode;
    duration?: number;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
    style?: React.CSSProperties;
    className?: string;
    dismissible?: boolean;
    onDismiss?: (t: string | number) => void;
    onAutoClose?: (t: string | number) => void;
  }

  interface Toast {
    (message: string | ReactNode, options?: ToastOptions): string | number;
    success: (message: string | ReactNode, options?: ToastOptions) => string | number;
    error: (message: string | ReactNode, options?: ToastOptions) => string | number;
    info: (message: string | ReactNode, options?: ToastOptions) => string | number;
    warning: (message: string | ReactNode, options?: ToastOptions) => string | number;
    loading: (message: string | ReactNode, options?: ToastOptions) => string | number;
    dismiss: (id?: string | number) => void;
    promise: <T>(
      promise: Promise<T>,
      options: {
        loading?: string | ReactNode;
        success?: string | ReactNode | ((data: T) => string | ReactNode);
        error?: string | ReactNode | ((err: Error) => string | ReactNode);
      }
    ) => Promise<T>;
  }

  export const toast: Toast;

  interface ToasterProps {
    richColors?: boolean;
    closeButton?: boolean;
    position?: ToastOptions["position"];
    duration?: number;
    visibleToasts?: number;
    expand?: boolean;
    theme?: "light" | "dark" | "system";
  }

  export const Toaster: ComponentType<ToasterProps>;
}

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

declare module "*.gif" {
  const value: string;
  export default value;
}
