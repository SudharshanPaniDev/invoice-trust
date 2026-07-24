/** Lightweight hover tooltip — replaces the native `title` attribute, whose ~500ms-1s
 *  browser-default hover delay felt sluggish. Pure CSS (group-hover), no JS state, so the
 *  delay is just whatever `delay-100` says, not the browser's fixed timing. */
export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-block">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-[240px] -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-normal text-background opacity-0 transition-opacity delay-100 duration-100 group-hover:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
