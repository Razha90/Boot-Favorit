import { findRawImgViolations } from "./lib/rules.mjs";
import { runRule } from "./lib/run.mjs";

runRule("no-raw-img", ["src/web"], [".ts", ".tsx", ".css"], findRawImgViolations);
