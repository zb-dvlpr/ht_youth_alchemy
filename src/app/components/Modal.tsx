import type { ReactNode } from "react";

import styles from "../page.module.css";

type ModalVariant = "local" | "global";

type ModalProps = {
  open: boolean;
  title?: string;
  body?: ReactNode;
  actions?: ReactNode;
  variant?: ModalVariant;
  className?: string;
};

export default function Modal({
  open,
  title,
  body,
  actions,
  variant = "global",
  className,
}: ModalProps) {
  if (!open) return null;
  const overlayClass =
    variant === "local" ? styles.confirmOverlay : styles.trainingOverlay;

  return (
    <div className={overlayClass}>
      <div
        className={`${styles.confirmCard}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
      >
        {title ? <div className={styles.confirmTitle}>{title}</div> : null}
        {body ? <div className={styles.confirmBody}>{body}</div> : null}
        {actions ? (
          <div className={styles.confirmActions}>{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
