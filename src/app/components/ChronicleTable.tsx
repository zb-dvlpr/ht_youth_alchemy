"use client";
/* eslint-disable jsx-a11y/role-supports-aria-props */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import styles from "../page.module.css";
import Tooltip from "./Tooltip";

export type ChronicleSortValue =
  | string
  | number
  | null
  | ChronicleSortValue[];

export type ChronicleTableColumn<Row, Snapshot> = {
  key: string;
  label: string;
  headerAccessory?: ReactNode;
  headerTooltipContent?: ReactNode;
  sortable?: boolean;
  getValue: (
    snapshot: Snapshot | undefined,
    row?: Row
  ) => string | number | null | undefined;
  getSortValue?: (
    snapshot: Snapshot | undefined,
    row?: Row
  ) => ChronicleSortValue | undefined;
  renderCell?: (
    snapshot: Snapshot | undefined,
    row: Row,
    formatValue: (value: string | number | null | undefined) => string
  ) => ReactNode;
};

type ChronicleTableProps<Row, Snapshot> = {
  columns: ChronicleTableColumn<Row, Snapshot>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  getSnapshot: (row: Row) => Snapshot | undefined;
  freezeFirstColumn?: boolean;
  freezeFirstColumnsCount?: number;
  className?: string;
  getRowClassName?: (row: Row) => string | undefined;
  onRowClick?: (row: Row) => void;
  formatValue: (value: string | number | null | undefined) => string;
  style?: CSSProperties;
  sortKey?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  maskedTeamId?: number | null;
  maskText?: string;
  isMaskActive?: boolean;
  onMaskedRowClick?: (row: Row) => void;
  renderMergedTrailingCells?: (
    row: Row,
    snapshot: Snapshot | undefined
  ) => ReactNode | null;
};

export function ChronicleTable<Row, Snapshot>({
  columns,
  rows,
  getRowKey,
  getSnapshot,
  freezeFirstColumn = false,
  freezeFirstColumnsCount,
  className,
  getRowClassName,
  onRowClick,
  formatValue,
  style,
  sortKey,
  sortDirection,
  onSort,
  maskedTeamId = null,
  maskText,
  isMaskActive = false,
  onMaskedRowClick,
  renderMergedTrailingCells,
}: ChronicleTableProps<Row, Snapshot>) {
  return (
    <div
      className={`${styles.chronicleTable}${freezeFirstColumn || (freezeFirstColumnsCount ?? 0) > 0 ? ` ${styles.chronicleTableFreezeFirstColumn}` : ""}${(freezeFirstColumnsCount ?? 0) > 1 ? ` ${styles.chronicleTableFreezeFirstTwoColumns}` : ""}${className ? ` ${className}` : ""}`}
      style={style}
    >
      <div className={styles.chronicleTableHeader}>
        {columns.map((column) => {
          const isSortable = Boolean(onSort) && column.sortable !== false;
          const isActive = sortKey === column.key;
          const headerKey = `header-${column.key}`;
          const headerLabel = column.headerTooltipContent ? (
            <Tooltip content={column.headerTooltipContent}>
              <span>{column.label}</span>
            </Tooltip>
          ) : (
            column.label
          );
          if (isSortable) {
            const icon = isActive
              ? sortDirection === "desc"
                ? "▼"
                : "▲"
              : "⇅";
            const ariaSort: "none" | "ascending" | "descending" = isActive
              ? sortDirection === "desc"
                ? "descending"
                : "ascending"
              : "none";
            return (
              <span
                key={headerKey}
                className={`${styles.chronicleTableHeaderItem}${column.headerAccessory ? ` ${styles.chronicleTableHeaderItemWithAccessory}` : ""}`}
                data-label={column.label}
              >
                <button
                  type="button"
                  className={styles.chronicleTableHeaderButton}
                  onClick={() => onSort?.(column.key)}
                  aria-sort={ariaSort}
                >
                  {headerLabel}
                  <span className={styles.chronicleTableSortIcon}>{icon}</span>
                </button>
                {column.headerAccessory ? (
                  <span className={styles.chronicleTableHeaderAccessory}>
                    {column.headerAccessory}
                  </span>
                ) : null}
              </span>
            );
          }
          return (
            <span
              key={headerKey}
              className={`${styles.chronicleTableHeaderItem}${column.headerAccessory ? ` ${styles.chronicleTableHeaderItemWithAccessory}` : ""}`}
              data-label={column.label}
            >
              <span>{headerLabel}</span>
              {column.headerAccessory ? (
                <span className={styles.chronicleTableHeaderAccessory}>
                  {column.headerAccessory}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      {rows.map((row) => {
        const snapshot = getSnapshot(row);
        const rowKey = getRowKey(row);
        const rowClassName = getRowClassName?.(row);
        const rowTeamId = (row as { teamId?: number }).teamId;
        const isMaskedRow =
          isMaskActive &&
          maskedTeamId !== null &&
          rowTeamId === maskedTeamId &&
          Boolean(maskText);
        const mergedTrailingCells = renderMergedTrailingCells?.(row, snapshot);
        return (
          <div
            key={rowKey}
            className={`${styles.chronicleTableRow}${rowClassName ? ` ${rowClassName}` : ""}${isMaskedRow ? ` ${styles.chronicleTableRowMasked}` : ""}`}
            role={onRowClick || isMaskedRow ? "button" : undefined}
            tabIndex={onRowClick || isMaskedRow ? 0 : undefined}
            onClick={
              isMaskedRow
                ? () => onMaskedRowClick?.(row)
                : onRowClick
                  ? () => onRowClick(row)
                  : undefined
            }
            onKeyDown={
              onRowClick || isMaskedRow
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (isMaskedRow) {
                        onMaskedRowClick?.(row);
                      } else {
                        onRowClick?.(row);
                      }
                    }
                  }
                : undefined
            }
          >
            {isMaskedRow ? (
              <span
                className={`${styles.chronicleTableCell} ${styles.chronicleTableCellMaskedLead}`}
              >
                {maskText}
              </span>
            ) : mergedTrailingCells ? (
              <>
                <span
                  key={`${rowKey}-${columns[0]?.key ?? "lead"}`}
                  className={styles.chronicleTableCell}
                  data-label={columns[0]?.label}
                >
                  {columns[0]?.renderCell
                    ? columns[0].renderCell(snapshot, row, formatValue)
                    : formatValue(columns[0]?.getValue(snapshot, row))}
                </span>
                <span
                  className={`${styles.chronicleTableCell} ${styles.chronicleTableCellMerged}`}
                >
                  {mergedTrailingCells}
                </span>
              </>
            ) : (
              columns.map((column) => (
                <span
                  key={`${rowKey}-${column.key}`}
                  className={styles.chronicleTableCell}
                  data-label={column.label}
                >
                  {column.renderCell
                    ? column.renderCell(snapshot, row, formatValue)
                    : formatValue(column.getValue(snapshot, row))}
                </span>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChronicleDetailHorizontalScroll({
  children,
  refreshKey,
  className,
  viewportClassName,
  fillHeight = false,
}: {
  children: ReactNode;
  refreshKey: string;
  className?: string;
  viewportClassName?: string;
  fillHeight?: boolean;
}) {
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const floatingScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const [scrollMetrics, setScrollMetrics] = useState({
    hasOverflow: false,
    scrollWidth: 0,
  });

  const updateScrollMetrics = useCallback(() => {
    const tableScroll = tableScrollRef.current;
    const floatingScroll = floatingScrollRef.current;
    if (!tableScroll) return;
    const scrollWidth = tableScroll.scrollWidth;
    const clientWidth = tableScroll.clientWidth;
    const hasOverflow = scrollWidth > clientWidth + 1;
    setScrollMetrics((current) =>
      current.hasOverflow === hasOverflow && current.scrollWidth === scrollWidth
        ? current
        : { hasOverflow, scrollWidth }
    );
    if (floatingScroll) {
      floatingScroll.scrollLeft = tableScroll.scrollLeft;
    }
  }, []);

  useEffect(() => {
    updateScrollMetrics();
    const tableScroll = tableScrollRef.current;
    if (!tableScroll) return;

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollMetrics);
    resizeObserver?.observe(tableScroll);
    if (tableScroll.firstElementChild) {
      resizeObserver?.observe(tableScroll.firstElementChild);
    }
    window.addEventListener("resize", updateScrollMetrics);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateScrollMetrics);
    };
  }, [refreshKey, updateScrollMetrics]);

  useEffect(() => {
    if (tableScrollRef.current && floatingScrollRef.current) {
      floatingScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  }, [scrollMetrics.hasOverflow]);

  const syncScroll = (
    source: HTMLDivElement | null,
    target: HTMLDivElement | null
  ) => {
    if (!source || !target || syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    target.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  return (
    <div
      className={`${styles.chronicleDetailTableScrollHost}${
        fillHeight ? ` ${styles.chronicleDetailTableScrollHostFill}` : ""
      }${className ? ` ${className}` : ""}`}
    >
      <div
        ref={tableScrollRef}
        className={`${styles.chronicleTransferHistoryTableWrap} ${
          styles.chronicleDetailTableScroll
        }${viewportClassName ? ` ${viewportClassName}` : ""}`}
        onScroll={() =>
          syncScroll(tableScrollRef.current, floatingScrollRef.current)
        }
      >
        {children}
      </div>
      {scrollMetrics.hasOverflow ? (
        <div
          ref={floatingScrollRef}
          className={styles.chronicleDetailFloatingScrollbar}
          onScroll={() =>
            syncScroll(floatingScrollRef.current, tableScrollRef.current)
          }
        >
          <div
            className={styles.chronicleDetailFloatingScrollbarSpacer}
            style={{ width: scrollMetrics.scrollWidth }}
          />
        </div>
      ) : null}
    </div>
  );
}
