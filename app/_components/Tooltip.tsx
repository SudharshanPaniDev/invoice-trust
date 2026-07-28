/** Lightweight hover tooltip — replaces the native `title` attribute, whose ~500ms-1s
 *  browser-default hover delay felt sluggish. Pure CSS (group-hover), no JS state, so the
 *  delay is just whatever `delay-100` says, not the browser's fixed timing.
 *
 *  Also reveals on keyboard focus (`tabIndex` + `group-focus-within`), since a hover-only
 *  affordance is invisible to anyone tabbing through the page. Touch is a known remaining
 *  gap: a tap can focus the wrapper, but there's no tap-and-hold "peek" the way hover
 *  works on desktop — left as hover/focus-only rather than showing every badge's tooltip
 *  permanently on touch devices, which would clutter the table. */
export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <span
      tabIndex={0}
      className="group relative inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-[240px] -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-normal text-background opacity-0 transition-opacity delay-100 duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
