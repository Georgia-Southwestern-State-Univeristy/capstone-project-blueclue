import { useState, useEffect } from 'react';
import { formatTimeAgo, formatDateTime } from '../utils/dateFormatter';

/**
 * RelativeTime
 * Renders a live-updating relative timestamp ("just now", "2m ago", "3h ago").
 *
 * - Updates automatically every 30 seconds so labels stay fresh without a page reload.
 * - Shows the full absolute datetime as a tooltip on hover.
 * - Covers socket-driven events: new comments, status changes, assignment updates.
 *
 * @param {string|Date} timestamp  - The date/time to display.
 * @param {string}      [className] - Extra CSS classes to apply to the <time> element.
 */
function RelativeTime({ timestamp, className = '' }) {
  // Force a re-render every 30 s so the label stays current.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!timestamp) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (!timestamp) return null;

  const relative = formatTimeAgo(timestamp);
  const absolute = formatDateTime(timestamp);

  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      title={absolute}
      className={className}
    >
      {relative}
    </time>
  );
}

export default RelativeTime;
