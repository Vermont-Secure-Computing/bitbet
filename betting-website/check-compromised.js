import fs from "fs";

const compromised = {
  "chalk": ["5.3.0", "5.3.1", "5.3.2", "5.3.3", "5.3.4"], // known compromised versions
  "debug": ["4.3.5", "4.3.6"],
  "flat": ["5.0.0"],
  "get-func-name": ["2.0.2"],
  "karma": ["6.4.3"],
  "kind-of": ["6.0.3"],
  "mikro-orm": ["6.3.3"],
  "mikro-orm-core": ["6.3.3"],
  "mikro-orm-migrations": ["6.3.3"],
  "mikro-orm-entity-generator": ["6.3.3"],
  "mikro-orm-cli": ["6.3.3"],
  "mikro-orm-knex": ["6.3.3"],
  "mikro-orm-mongodb": ["6.3.3"],
  "mikro-orm-mysql": ["6.3.3"],
  "mikro-orm-postgresql": ["6.3.3"],
  "mikro-orm-sqlite": ["6.3.3"],
  "mikro-orm-seeder": ["6.3.3"],
  "ms": ["2.1.3"],
  "npm-user-validate": ["1.0.1"],
  "nopt": ["9.0.1"],
  "proto-list": ["1.2.5"]
};

function scanLockfile(lockfilePath) {
  if (!fs.existsSync(lockfilePath)) {
    console.error(`❌ ${lockfilePath} not found`);
    return;
  }

  const data = fs.readFileSync(lockfilePath, "utf8");
  let issues = [];

  for (const [pkg, versions] of Object.entries(compromised)) {
    for (const ver of versions) {
      const pattern = `"${pkg}": {\n.*"version": "${ver}"`;
      if (new RegExp(pattern).test(data)) {
        issues.push({ pkg, ver });
      }
    }
  }

  if (issues.length > 0) {
    console.log("Found compromised packages:");
    issues.forEach(i => console.log(` - ${i.pkg}@${i.ver}`));
  } else {
    console.log("No compromised packages found in lockfile");
  }
}

// Adjust for your lockfile
scanLockfile("package-lock.json");
