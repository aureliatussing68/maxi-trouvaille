import { spawnSync } from "node:child_process";

const audits = [
  {
    name: "images_partenaire",
    command: ["node", "scripts/automation/audit_partner_catalog_images.mjs"],
  },
  {
    name: "gates_publication",
    command: ["node", "scripts/automation/audit_partner_publication_gates.mjs"],
  },
];

const results = audits.map((audit) => {
  const run = spawnSync(audit.command[0], audit.command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  let parsed = null;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    parsed = { rawOutput: run.stdout.trim() };
  }

  return {
    name: audit.name,
    ok: run.status === 0,
    exitCode: run.status,
    summary: parsed,
    stderr: run.stderr.trim(),
  };
});

const summary = {
  ok: results.every((result) => result.ok),
  checkedAt: new Date().toISOString(),
  results,
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exitCode = 1;
}
