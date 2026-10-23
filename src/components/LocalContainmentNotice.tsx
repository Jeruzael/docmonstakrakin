import React from 'react';
import {observedWorkspaceMode} from '../data/workspaceTransport';

export function LocalContainmentNotice(){
  return <aside aria-label="Local security containment" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
    <strong>Local containment active.</strong> Secret administration, repository access and agent dispatch remain unavailable. {observedWorkspaceMode()==='ENFORCED'?'Project access is checked against the private workspace identity and membership policy. Real-world enrollment, shared deployment and production release remain unaccepted.':'Explicit development mode has local, unscoped project access; this workspace is not ready for shared or remote use.'}
  </aside>;
}
