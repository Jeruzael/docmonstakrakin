import React from 'react';

export function LocalContainmentNotice(){
  return <aside aria-label="Local security containment" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
    <strong>Local containment active.</strong> Secret administration, repository access and agent dispatch are unavailable until their authorization controls exist. Project access remains local and unscoped; this workspace is not ready for shared or remote use.
  </aside>;
}
