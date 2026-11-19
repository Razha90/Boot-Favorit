import { findBoundaryViolations } from "./lib/rules.mjs";
import { runRule } from "./lib/run.mjs";

runRule("lint-boundaries", ["src"], [".ts", ".tsx"], findBoundaryViolations);
