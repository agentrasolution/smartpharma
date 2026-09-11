import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";
import { useServerConnection } from "@/contexts/ServerConnectionContext";

export default function OfflineBanner() {
  const { isOnline, isInitialCheck, reconnect } = useServerConnection();

  if (isInitialCheck) return null;

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-2 bg-warning/10 border-b border-warning/20">
            <div className="flex items-center gap-2 text-sm text-warning">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span className="font-medium">Server offline</span>
              <span className="text-warning/70 text-xs">check connection</span>
            </div>
            <button
              onClick={reconnect}
              className="flex items-center gap-1.5 text-xs font-medium text-warning hover:text-warning/80 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
