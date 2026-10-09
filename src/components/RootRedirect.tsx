/**
 * @file src/components/RootRedirect.tsx
 * @description Resolves where bare `/` (and any unrecognized path) should
 * go, gated by the `prod_release` flag in the `rules` table: while it's
 * 'N' (the default), every such path lands on the existing Ask-a-Question
 * flow at /ask -- exactly what every already-printed/shared QR code and
 * link expects. Once flipped to 'Y' directly in Supabase, they land on the
 * new chooser screen at /root instead. /root stays directly reachable
 * either way; this component only decides the default for an unspecified
 * path.
 */

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export const RootRedirect: React.FC = () => {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/rules/prod-release')
      .then(res => res.json())
      .then(data => { if (!cancelled) setTarget(data.prodRelease ? '/root' : '/ask'); })
      .catch(() => { if (!cancelled) setTarget('/ask'); });
    return () => { cancelled = true; };
  }, []);

  if (!target) {
    return <div className="min-h-screen" style={{ backgroundColor: `rgb(var(--background))` }} />;
  }
  return <Navigate to={target} replace />;
};
