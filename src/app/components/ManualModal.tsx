"use client";

import { useRef, useState } from "react";

import styles from "../page.module.css";
import { MANUAL_MARKDOWN } from "./manualMarkdown";
import Modal from "./Modal";

type ManualBlock =
  | { type: "heading"; level: number; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "rule" };

type TocItem = {
  id: string;
  level: number;
  text: string;
};

type ManualModalProps = {
  open: boolean;
  title: string;
  tocTitle: string;
  onClose: () => void;
};

const slugifyHeading = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

const parseManualMarkdown = (markdown: string) => {
  const blocks: ManualBlock[] = [];
  const headingCounts = new Map<string, number>();
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  const uniqueHeadingId = (text: string) => {
    const base = slugifyHeading(text) || "section";
    const count = headingCounts.get(base) ?? 0;
    headingCounts.set(base, count + 1);
    return count === 0 ? base : base + "-" + (count + 1);
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    if (/^(—{3,}|-{3,})$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "rule" });
      return;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const text = headingMatch[2];
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text,
        id: uniqueHeadingId(text),
      });
      return;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();

  const toc = blocks.flatMap<TocItem>((block) =>
    block.type === "heading" ? [{ id: block.id, level: block.level, text: block.text }] : []
  );
  return { blocks, toc };
};

const MANUAL_MARKDOWN_WITH_TRANSFER_SEARCH_MOBILE_NOTE = MANUAL_MARKDOWN.replace(
  "Bid amounts are handled in EUR in the UI. On mobile, the bid amount and max bid controls are stacked so each action has its own row.",
  "Bid amounts are handled in EUR in the UI. On mobile, the bid amount and max bid controls are stacked so each action has its own row, and the transfer search modal uses a tighter layout so table results keep as much visible space as possible in both portrait and landscape."
);

const { blocks: manualBlocks, toc: manualToc } = parseManualMarkdown(
  MANUAL_MARKDOWN_WITH_TRANSFER_SEARCH_MOBILE_NOTE
);

const renderHeading = (block: Extract<ManualBlock, { type: "heading" }>) => {
  switch (block.level) {
    case 1:
      return <h1 id={block.id}>{block.text}</h1>;
    case 2:
      return <h2 id={block.id}>{block.text}</h2>;
    case 3:
      return <h3 id={block.id}>{block.text}</h3>;
    case 4:
      return <h4 id={block.id}>{block.text}</h4>;
    case 5:
      return <h5 id={block.id}>{block.text}</h5>;
    default:
      return <h6 id={block.id}>{block.text}</h6>;
  }
};

export default function ManualModal({
  open,
  title,
  tocTitle,
  onClose,
}: ManualModalProps) {
  const manualContentRef = useRef<HTMLDivElement | null>(null);
  const [tocOpen, setTocOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const container = manualContentRef.current;
    const target = document.getElementById(id);
    if (!container || !target) return;
    setTocOpen(false);
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + targetRect.top - containerRect.top,
      behavior: "smooth",
    });
  };

  return (
    <Modal
      open={open}
      title={title}
      className={styles.manualModal}
      movable={false}
      body={
        <article className={styles.manualBody}>
          <button
            type="button"
            className={styles.manualTocToggle}
            onClick={() => setTocOpen((prev) => !prev)}
            aria-expanded={tocOpen}
          >
            {tocTitle}
          </button>
          <nav
            className={`${styles.manualToc} ${
              tocOpen ? styles.manualTocOpen : ""
            }`}
            aria-label={tocTitle}
          >
            <h2>{tocTitle}</h2>
            <ol>
              {manualToc.map((item) => (
                <li key={item.id} className={styles["manualTocLevel" + item.level]}>
                  <button type="button" onClick={() => scrollToSection(item.id)}>
                    {item.text}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div className={styles.manualMarkdown} ref={manualContentRef}>
            {manualBlocks.map((block, index) => {
              if (block.type === "heading") {
                return <div key={block.id}>{renderHeading(block)}</div>;
              }
              if (block.type === "list") {
                return (
                  <ul key={"list-" + index}>
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                );
              }
              if (block.type === "rule") {
                return <hr key={"rule-" + index} />;
              }
              return <p key={"paragraph-" + index}>{block.text}</p>;
            })}
          </div>
        </article>
      }
      closeOnBackdrop
      onClose={onClose}
    />
  );
}
