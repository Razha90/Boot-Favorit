import { findTokenViolations } from "./lib/rules.mjs";
import { runRule } from "./lib/run.mjs";

runRule("lint-tokens", ["src/web"], [".ts", ".tsx", ".css", ".html"], findTokenViolations);
