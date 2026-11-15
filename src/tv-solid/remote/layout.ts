/** The shared geometry of every TV screen.
 *
 * The app renders into one fixed logical frame and the renderer scales it to
 * the display, so these numbers are resolution-independent by construction:
 * a 4K panel and a 720p panel use the same layout, only the raster differs.
 * Screens read their edges from here instead of repeating the numbers, so a
 * title, a shelf and the player's timeline all start on the same line.
 */
export const FRAME = { width: 1920, height: 1080 } as const;

export const LAYOUT = {
  /** Left inset of every screen's content. */
  inset: 96,
  /** Right edge of every screen's content. */
  rightEdge: 1824,
  /** Width from the inset to the frame's own right edge, for full-bleed rows. */
  rightSpan: 1824,
  /** The band the top navigation occupies. */
  topBand: 132,
  /** The player's control row. */
  controlRow: 846,
  /** The player's timeline. */
  timeline: 936,
  /** Last line that still respects the bottom safe margin. */
  bottomSafe: 1026,
  /** The player's own right column, used by Next episode and Skip. */
  playerRight: 1584,
  /** Gap between a section's title and the content under it. */
  sectionGap: 52,
  /** Gap between sibling controls in one row. */
  controlGap: 12,
} as const;

/** The width of the content area between the insets. */
export const CONTENT_WIDTH = LAYOUT.rightEdge - LAYOUT.inset;
