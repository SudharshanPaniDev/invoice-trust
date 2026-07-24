export function TrustBanner({
  canTrust,
  openFlags,
  confidence,
}: {
  canTrust: boolean;
  openFlags: number;
  confidence?: number;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        canTrust
          ? "border-success/30 bg-success-bg text-success"
          : "border-warning/30 bg-warning-bg text-warning"
      }`}
    >
      {canTrust
        ? "✓ All checks passed — safe to mark trusted."
        : `⚠ ${openFlags} open flag(s) — cannot mark trusted yet.`}
      {confidence != null && (
        <span className="ml-2 text-muted">overall {Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}
