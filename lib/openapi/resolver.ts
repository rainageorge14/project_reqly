/**
 * Resolves local JSON references (e.g. #/components/schemas/User)
 * within an OpenAPI 3.x document with cycle detection.
 */

export class OpenApiRefResolver {
  private rootDoc: Record<string, unknown>;
  private cache: Map<string, unknown> = new Map();

  constructor(rootDoc: Record<string, unknown>) {
    this.rootDoc = rootDoc;
  }

  /**
   * Resolves a single $ref string or object containing $ref.
   * If not local or not found, preserves the original reference.
   */
  public resolveRef<T = unknown>(ref: string, visited: Set<string> = new Set()): T {
    if (!ref.startsWith("#/")) {
      // External references are preserved as-is for safety
      return { $ref: ref } as unknown as T;
    }

    if (visited.has(ref)) {
      // Circular reference detected; return placeholder to avoid infinite loop
      return { $ref: ref, _circular: true } as unknown as T;
    }

    if (this.cache.has(ref)) {
      return this.cache.get(ref) as T;
    }

    visited.add(ref);

    const parts = ref
      .replace(/^#\//, "")
      .split("/")
      .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));

    let current: unknown = this.rootDoc;

    for (const part of parts) {
      if (
        current &&
        typeof current === "object" &&
        part in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[part];
      } else {
        // Target path not found in document; preserve reference
        return { $ref: ref } as unknown as T;
      }
    }

    // Recursively resolve nested $refs if the resolved item itself has $ref
    if (
      current &&
      typeof current === "object" &&
      "$ref" in current &&
      typeof (current as Record<string, unknown>).$ref === "string"
    ) {
      const resolved = this.resolveRef(
        (current as Record<string, unknown>).$ref as string,
        visited
      );
      this.cache.set(ref, resolved);
      return resolved as T;
    }

    // Resolve any properties inside the resolved object if needed
    const deeplyResolved = this.deepResolve(current, visited);
    this.cache.set(ref, deeplyResolved);
    return deeplyResolved as T;
  }

  /**
   * Recursively traverses an object/schema and resolves all local $refs within it.
   */
  public deepResolve<T>(item: T, visited: Set<string> = new Set()): T {
    if (!item || typeof item !== "object") {
      return item;
    }

    if (Array.isArray(item)) {
      return item.map((element) =>
        this.deepResolve(element, new Set(visited))
      ) as unknown as T;
    }

    const obj = item as Record<string, unknown>;

    if (typeof obj.$ref === "string") {
      const resolved = this.resolveRef(obj.$ref, visited);
      if (resolved && typeof resolved === "object") {
        // Merge resolved object with any sibling properties
        const rest = { ...obj };
        delete rest.$ref;
        return { ...(resolved as Record<string, unknown>), ...rest } as unknown as T;
      }
      return resolved as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.deepResolve(value, new Set(visited));
    }

    return result as T;
  }
}
