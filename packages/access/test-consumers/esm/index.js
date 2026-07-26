import * as access from "@fiberlatch/access";

if (typeof access !== "object" || access === null) {
  throw new Error("Expected the package namespace to be an object.");
}

if (Object.getPrototypeOf(access) !== null) {
  throw new Error("Expected an ESM namespace object.");
}

if ("default" in access) {
  throw new Error("Expected no default export in the skeleton package.");
}
