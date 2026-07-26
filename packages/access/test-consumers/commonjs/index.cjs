const access = require("@fiberlatch/access");

if (typeof access !== "object" || access === null) {
  throw new Error("Expected the package namespace to be an object.");
}

if (Object.getPrototypeOf(access) !== null) {
  throw new Error("Expected a namespace object returned by require(esm).");
}

if ("default" in access) {
  throw new Error("Expected no default export in the skeleton package.");
}
