const { execFileSync, execSync } = require("child_process");

const version = process.argv[2];
const semverPattern = /^\d+\.\d+\.\d+$/;

function fail(message) {
  console.error(`\nRelease aborted: ${message}`);
  process.exit(1);
}

function run(command, args = []) {
  const printable = [command, ...args].join(" ");
  console.log(`> ${printable}`);
  execFileSync(command, args, { stdio: "inherit" });
}

function output(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

if (!version || !semverPattern.test(version)) {
  fail("Provide a semantic version, for example: npm run release -- 1.1.3");
}

const tag = `v${version}`;

try {
  // Releasing uncommitted work makes it unclear exactly what the tag represents.
  if (output("git status --porcelain")) {
    fail("Working tree is not clean. Commit or stash your changes before releasing.");
  }

  // Make sure HEAD belongs to a branch rather than a detached checkout.
  const branch = output("git branch --show-current");
  if (!branch) {
    fail("HEAD is detached. Check out the branch you want to release first.");
  }

  // Prevent accidental reuse of an existing release tag, locally or remotely.
  if (output(`git tag --list ${tag}`)) {
    fail(`Tag ${tag} already exists locally.`);
  }

  const remoteTag = output(`git ls-remote --tags origin refs/tags/${tag}`);
  if (remoteTag) {
    fail(`Tag ${tag} already exists on origin.`);
  }

  console.log(`\nValidating ProvisionPoint Teams App ${version}...`);
  run("npm", ["run", "validate"]);

  console.log(`\nBuilding all Teams app packages as ${version}...`);
  run("npm", ["run", "build:all", "--", "--version", version]);

  console.log(`\nPushing ${branch} before creating the release tag...`);
  run("git", ["push"]);

  console.log(`\nCreating ${tag}...`);
  run("git", ["tag", tag]);

  try {
    run("git", ["push", "origin", tag]);
  } catch (error) {
    // If the remote push fails, remove the local tag so the command can be retried cleanly.
    try {
      execFileSync("git", ["tag", "-d", tag], { stdio: "ignore" });
    } catch (_) {
      // Preserve the original push failure.
    }
    throw error;
  }

  console.log(`\nRelease ${tag} triggered successfully.`);
  console.log("GitHub Actions will create the release and attach all environment packages.");
} catch (error) {
  if (error && typeof error.status === "number") {
    fail(`A command failed with exit code ${error.status}.`);
  }
  fail(error?.message || "Unknown error.");
}
