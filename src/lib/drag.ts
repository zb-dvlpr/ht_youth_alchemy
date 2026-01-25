import type { DragEvent } from "react";

type DragGhostOptions = {
  label: string;
  className: string;
  slotSelector?: string;
};

export function setDragGhost(event: DragEvent, options: DragGhostOptions) {
  const { label, className, slotSelector } = options;
  const transfer = event.dataTransfer;
  if (!transfer) return;

  const ghost = document.createElement("div");
  ghost.className = className;
  ghost.textContent = label;
  ghost.style.position = "absolute";
  ghost.style.top = "-1000px";
  ghost.style.left = "-1000px";
  ghost.style.pointerEvents = "none";

  document.body.appendChild(ghost);

  const reference =
    slotSelector && typeof document !== "undefined"
      ? (document.querySelector(slotSelector) as HTMLElement | null)
      : null;
  const rect = reference?.getBoundingClientRect();
  const width = rect?.width ?? ghost.getBoundingClientRect().width;
  const height = rect?.height ?? ghost.getBoundingClientRect().height;

  if (width) ghost.style.width = `${width}px`;
  if (height) ghost.style.height = `${height}px`;

  transfer.setDragImage(ghost, width ? width / 2 : 0, height ? height / 2 : 0);

  requestAnimationFrame(() => {
    ghost.remove();
  });
}
