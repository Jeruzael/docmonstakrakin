import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

interface WbsItem {
  id: string;
  wbs_path: string;
  parent_id: string;
  title: string;
  description: string;
  type: string;
  phase: string;
  epic: string;
  priority: string;
  risk: string;
  status: string;
  evidence?: string | string[];
  dependencies?: string[];
  requirements?: string[];
  architecture_links?: string[];
  security_controls?: string[];
  acceptance_criteria?: string[];
  verification_method?: string;
  children?: WbsItem[];
}

interface WbsPhase {
  id: string;
  name: string;
  wbs_prefix: string;
}

interface WbsDocument {
  version: string;
  project: string;
  baseline: string;
  baseline_description?: string;
  release_status?: string;
  gate_7_status?: string;
  manual_qa_status?: string;
  remediation_status?: string;
  last_updated: string;
  authoritative: boolean;
  status_definitions: Record<string, string>[];
  phases: WbsPhase[];
  items: WbsItem[];
}

const ROOT_DIR = process.cwd();
const YAML_PATH = path.join(ROOT_DIR, 'docs', '00_control', 'MASTER_WBS.yaml');
const MD_PATH = path.join(ROOT_DIR, 'docs', '00_control', 'MASTER_WBS.md');

function formatEvidence(ev?: string | string[]): string {
  if (!ev) return '';
  if (Array.isArray(ev)) return ev.join(', ');
  return String(ev);
}

function computePhaseStatus(phaseId: string, items: WbsItem[]): string {
  const phaseItems = items.filter((i) => i.phase === phaseId);
  if (phaseItems.length === 0) return '`IMPLEMENTED`';

  const statuses = phaseItems.map((i) => i.status);
  if (statuses.every((s) => s === 'PROPOSED')) {
    return '`PROPOSED` (Planning Milestone)';
  }
  if (phaseId === 'PHASE-12') {
    return statuses.includes('READY') ? '`VERIFIED` (Automated remediation); human retest `READY`; Gate 7 pending' : '`VERIFIED` (Technical Complete; Gate 7 Sign-off Pending — Release Candidate)';
  }
  if (statuses.includes('READY')) {
    return '`IMPLEMENTED` (Test harness in `READY`)';
  }
  if (statuses.includes('VERIFIED')) {
    return '`IMPLEMENTED` / `VERIFIED`';
  }
  return '`IMPLEMENTED`';
}

export function generateWbsMarkdown(doc: WbsDocument): string {
  const lines: string[] = [];

  lines.push('# docmonstakrakin Master Work Breakdown Structure (WBS)');
  lines.push('## Authoritative Engineering Task & Decomposition Catalog');
  lines.push('');
  lines.push('> **AUTO-GENERATED FILE — DO NOT EDIT MANUALLY**  ');
  lines.push('> Generated deterministically from canonical structured source: [`docs/00_control/MASTER_WBS.yaml`](./MASTER_WBS.yaml)  ');
  lines.push('> Run `npm run wbs:render` to regenerate, or `npm run wbs:check` to verify synchronization.');
  lines.push('');
  lines.push('**Document ID:** DOC-CTRL-003  ');
  lines.push('**Machine-Readable Source of Truth:** [`docs/00_control/MASTER_WBS.yaml`](./MASTER_WBS.yaml)  ');
  lines.push(`**Baseline:** ${doc.baseline} (${doc.baseline_description || 'Technically Verified Release Candidate; Gate 7 Human Sign-off Pending'})  `);
  if (doc.release_status) {
    lines.push(`**Release Status:** \`${doc.release_status}\`  `);
  }
  if (doc.gate_7_status) {
    lines.push(`**Gate 7 Status:** \`${doc.gate_7_status}\`  `);
  }
  if(doc.manual_qa_status)lines.push(`**Manual QA Status:** \`${doc.manual_qa_status}\`  `);
  if(doc.remediation_status)lines.push(`**Remediation Status:** \`${doc.remediation_status}\`  `);
  lines.push('**Status Standard:** `PROPOSED` | `READY` | `IN_PROGRESS` | `BLOCKED` | `IMPLEMENTED` | `VERIFICATION_PENDING` | `VERIFIED` | `DEFERRED` | `CANCELLED`  ');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 1. WBS Architecture & Hierarchy');
  lines.push('');
  lines.push('The Master WBS follows a strict 6-tier decomposition:');
  lines.push('$$\\text{Project} \\longrightarrow \\text{Phase} \\longrightarrow \\text{Epic/Capability} \\longrightarrow \\text{Feature} \\longrightarrow \\text{Work Package} \\longrightarrow \\text{Atomic Task}$$');
  lines.push('');
  lines.push('Permanent **DMK IDs** identify tasks immutably across re-organizations. The **WBS Path** (e.g. `13.03.01.01`) represents the current hierarchical location within the lifecycle.');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 2. Phase & Epic Summary');
  lines.push('');
  lines.push('| WBS Prefix | Phase ID | Capability / Epic | Focus Area | Status Summary |');
  lines.push('| :--- | :--- | :--- | :--- | :--- |');

  const epicMap: Record<string, { epic: string; focus: string }> = {
    'PHASE-0': { epic: '`EPIC-01`', focus: 'Foundation & Engineering Baseline' },
    'PHASE-1': { epic: '`EPIC-02`', focus: 'Canonical Project Core' },
    'PHASE-2': { epic: '`EPIC-03`', focus: 'Requirements & Discovery Engine' },
    'PHASE-3': { epic: '`EPIC-04`', focus: 'A-SSDLC Lifecycle & Risk Engine' },
    'PHASE-4': { epic: '`EPIC-05`', focus: 'Standards Registry & Pinning' },
    'PHASE-5': { epic: '`EPIC-06`', focus: 'Prompt Compiler & Validation' },
    'PHASE-6': { epic: '`EPIC-07`', focus: 'AI Gateway (Codex & Gemini)' },
    'PHASE-7': { epic: '`EPIC-08`', focus: 'Work Management Projections' },
    'PHASE-8': { epic: '`EPIC-09`', focus: 'Repository, Git & Command Safety' },
    'PHASE-9': { epic: '`EPIC-10`', focus: 'Evidence, Audit & Traceability' },
    'PHASE-10': { epic: '`EPIC-11`', focus: 'Standards Update & Migration' },
    'PHASE-11': { epic: '`EPIC-12`', focus: 'Dashboard & Next Safe Action' },
    'PHASE-12': { epic: '`EPIC-13`', focus: 'Forms, Export, Secrets & Release' },
    'PHASE-13': { epic: '`EPIC-14`', focus: 'Multi-Agent Collaboration & Peer Trust' },
    'PHASE-14': { epic: '`EPIC-15`', focus: 'Encrypted Sync Gateway & Transport Abstraction' },
    'PHASE-15': { epic: '`EPIC-16`', focus: 'Post-MVP Integrations & Extensibility' },
    'PHASE-16': { epic: '`EPIC-17`', focus: 'v0.2 Governance, Verification & Milestone Closure' },
  };

  const allPhases = [
    { id: 'PHASE-0', prefix: '01', phaseNum: '0' },
    { id: 'PHASE-1', prefix: '02', phaseNum: '1' },
    { id: 'PHASE-2', prefix: '03', phaseNum: '2' },
    { id: 'PHASE-3', prefix: '04', phaseNum: '3' },
    { id: 'PHASE-4', prefix: '05', phaseNum: '4' },
    { id: 'PHASE-5', prefix: '06', phaseNum: '5' },
    { id: 'PHASE-6', prefix: '07', phaseNum: '6' },
    { id: 'PHASE-7', prefix: '08', phaseNum: '7' },
    { id: 'PHASE-8', prefix: '09', phaseNum: '8' },
    { id: 'PHASE-9', prefix: '10', phaseNum: '9' },
    { id: 'PHASE-10', prefix: '11', phaseNum: '10' },
    { id: 'PHASE-11', prefix: '12', phaseNum: '11' },
    { id: 'PHASE-12', prefix: '13', phaseNum: '12' },
    { id: 'PHASE-13', prefix: '14', phaseNum: '13' },
    { id: 'PHASE-14', prefix: '15', phaseNum: '14' },
    { id: 'PHASE-15', prefix: '16', phaseNum: '15' },
    { id: 'PHASE-16', prefix: '17', phaseNum: '16' },
  ];

  for (const p of allPhases) {
    const meta = epicMap[p.id];
    const status = computePhaseStatus(p.id, doc.items);
    lines.push(`| **${p.prefix}** | Phase ${p.phaseNum} | ${meta.epic} | ${meta.focus} | ${status} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 3. Active & Pending Task Catalog (Epics 01 through 13)');
  lines.push('');

  // Group items by epic for Epics 01..13
  const v01Items = doc.items.filter((item) => {
    const epicNum = parseInt(item.epic.replace('EPIC-', ''), 10);
    return epicNum <= 13;
  });

  const epicsOrder = Array.from(new Set(v01Items.map((i) => i.epic)));

  for (const epicId of epicsOrder) {
    const epicItems = v01Items.filter((i) => i.epic === epicId);
    const epicMeta = Object.values(epicMap).find((m) => m.epic.includes(epicId));
    const epicName = epicMeta ? epicMeta.focus : epicId;
    const epicNumber = epicId.replace('EPIC-', '');

    lines.push(`### Epic ${epicNumber}: ${epicName}`);
    lines.push('');

    for (const item of epicItems) {
      lines.push(`#### \`${item.id}\` — ${item.title}`);
      lines.push(`- **WBS Path:** \`${item.wbs_path}\``);
      lines.push(`- **Type:** \`${item.type}\` | **Priority:** \`${item.priority}\` | **Risk:** \`${item.risk}\``);

      const evStr = formatEvidence(item.evidence);
      if (evStr) {
        lines.push(`- **Status:** \`${item.status}\` (Evidence: \`${evStr}\`)`);
      } else {
        lines.push(`- **Status:** \`${item.status}\``);
      }

      if (item.dependencies && item.dependencies.length > 0) {
        lines.push(`- **Dependencies:** ${item.dependencies.map((d) => `\`${d}\``).join(', ')}`);
      }

      const parts: string[] = [];
      if (item.requirements && item.requirements.length > 0) {
        parts.push(`**Requirements:** ${item.requirements.map((r) => `\`${r}\``).join(', ')}`);
      }
      if (item.architecture_links && item.architecture_links.length > 0) {
        parts.push(`**Architecture:** ${item.architecture_links.map((a) => `\`${a}\``).join(', ')}`);
      }
      if (item.security_controls && item.security_controls.length > 0) {
        parts.push(`**Controls:** ${item.security_controls.map((c) => `\`${c}\``).join(', ')}`);
      }
      if (parts.length > 0) {
        lines.push(`- ${parts.join(' | ')}`);
      }

      if (item.description) {
        lines.push(`- **Description:** ${item.description}`);
      }

      if (item.acceptance_criteria && item.acceptance_criteria.length > 0) {
        lines.push('- **Acceptance Criteria:**');
        for (const ac of item.acceptance_criteria) {
          lines.push(`  - "${ac}"`);
        }
      }

      if (item.verification_method) {
        lines.push(`- **Verification Method:** ${item.verification_method}`);
      }

      if (item.children && item.children.length > 0) {
        lines.push('- **Atomic Subtask Decomposition:**');
        item.children.forEach((child, idx) => {
          const childEv = formatEvidence(child.evidence);
          const evSuffix = childEv ? ` (Evidence: \`${childEv}\`)` : '';
          lines.push(`  ${idx + 1}. **\`${child.id}\` (\`${child.status}\` / ${child.priority} / ${child.risk}):** ${child.title}${evSuffix}.`);
        });
      }

      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## 4. Milestone v0.2 Candidate Task Catalog (Epics 14–17 / Planning Phase)');
  lines.push('');
  lines.push('*Note: In accordance with project governance, all v0.2 tasks reside in `PROPOSED` status. No work items may be marked `READY` or `IN_PROGRESS` until the v0.2 Implementation Entry Gate is officially ratified.*');
  lines.push('');

  const v02Items = doc.items.filter((item) => {
    const epicNum = parseInt(item.epic.replace('EPIC-', ''), 10);
    return epicNum >= 14;
  });

  const v02Epics = Array.from(new Set(v02Items.map((i) => i.epic)));

  for (const epicId of v02Epics) {
    const epicItems = v02Items.filter((i) => i.epic === epicId);
    const epicMeta = Object.values(epicMap).find((m) => m.epic.includes(epicId));
    const epicName = epicMeta ? epicMeta.focus : epicId;
    const epicNumber = epicId.replace('EPIC-', '');

    lines.push(`### Epic ${epicNumber}: ${epicName}`);

    for (const item of epicItems) {
      const reqList = (item.requirements || []).map((r) => `\`${r}\``).join(', ');
      const archList = (item.architecture_links || []).map((a) => `\`${a}\``).join(', ');
      const ctrlList = (item.security_controls || []).map((c) => `\`${c}\``).join(', ');
      const tags = [reqList, archList, ctrlList].filter(Boolean).join(', ');

      lines.push(`- **\`${item.id}\` (${item.wbs_path}, ${item.priority}, ${item.risk}, \`${item.status}\`):** ${item.title} (${tags}).`);
    }

    lines.push('');
  }

  return lines.join('\n') + '\n';
}

function run() {
  const isCheckMode = process.argv.includes('--check');

  if (!fs.existsSync(YAML_PATH)) {
    console.error(`[ERROR] Canonical YAML not found at: ${YAML_PATH}`);
    process.exit(1);
  }

  const rawYaml = fs.readFileSync(YAML_PATH, 'utf8');
  const doc = YAML.parse(rawYaml) as WbsDocument;

  const generatedMd = generateWbsMarkdown(doc);

  if (isCheckMode) {
    if (!fs.existsSync(MD_PATH)) {
      console.error(`[FAIL] ${MD_PATH} does not exist. Run "npm run wbs:render" first.`);
      process.exit(1);
    }
    const currentMd = fs.readFileSync(MD_PATH, 'utf8');
    if (currentMd === generatedMd) {
      console.log('✓ [PASS] MASTER_WBS.md is 100% synchronized with MASTER_WBS.yaml (zero drift).');
      process.exit(0);
    } else {
      console.error('✗ [FAIL] Drift detected between MASTER_WBS.yaml and MASTER_WBS.md!');
      console.error('Run "npm run wbs:render" to regenerate and synchronize MASTER_WBS.md.');
      process.exit(1);
    }
  } else {
    fs.writeFileSync(MD_PATH, generatedMd, 'utf8');
    console.log(`✓ [SUCCESS] Successfully rendered ${MD_PATH} from ${YAML_PATH}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('renderWbs.ts')) {
  run();
}
