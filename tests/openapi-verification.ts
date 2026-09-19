import fs from "fs";
import path from "path";
import assert from "assert";
import { parseAndNormalizeOpenApi } from "../lib/openapi";

function runTests() {
  console.log("==================================================");
  console.log("RUNNING OPENAPI ENGINE VERIFICATION (12 SCENARIOS)");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✖ [FAIL] ${name}`);
      console.error("  Error:", err);
      failed++;
    }
  }

  const fixturesDir = path.join(__dirname, "fixtures");

  // 1. Valid OpenAPI JSON
  test("1. Valid OpenAPI JSON", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "valid-petstore.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw, "valid-petstore.json");
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.result.title, "Swagger Petstore");
      assert.strictEqual(res.result.version, "1.0.0");
      assert.strictEqual(res.result.openapiVersion, "3.0.0");
      assert.strictEqual(res.result.endpoints.length > 0, true);
    }
  });

  // 2. Valid OpenAPI YAML
  test("2. Valid OpenAPI YAML", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "valid-users.yaml"), "utf8");
    const res = parseAndNormalizeOpenApi(raw, "valid-users.yaml");
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.result.title, "Users Microservice");
      assert.strictEqual(res.result.version, "2.1.0");
      assert.strictEqual(res.result.openapiVersion, "3.0.3");
      assert.strictEqual(res.result.endpoints.length, 3);
    }
  });

  // 3. Invalid JSON syntax
  test("3. Invalid JSON", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "invalid-syntax.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw, "invalid-syntax.json");
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.error.code, "INVALID_JSON");
    }
  });

  // 4. Invalid YAML syntax
  test("4. Invalid YAML", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "invalid-syntax.yaml"), "utf8");
    const res = parseAndNormalizeOpenApi(raw, "invalid-syntax.yaml");
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.error.code, "INVALID_YAML");
    }
  });

  // 5. Missing paths
  test("5. Missing paths", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "missing-paths.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw, "missing-paths.json");
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.error.code, "MISSING_PATHS");
    }
  });

  // 6. Unsupported OpenAPI version (Swagger 2.0)
  test("6. Unsupported OpenAPI version (Swagger 2.0 rejection)", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "unsupported-swagger2.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw, "unsupported-swagger2.json");
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.error.code, "UNSUPPORTED_VERSION");
      assert.strictEqual(res.error.message.includes("Swagger"), true);
    }
  });

  // 7. Multiple HTTP methods
  test("7. Multiple HTTP methods normalization", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "valid-petstore.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw);
    assert.strictEqual(res.success, true);
    if (res.success) {
      const methods = res.result.endpoints.map((e) => e.method);
      assert.strictEqual(methods.includes("GET"), true);
      assert.strictEqual(methods.includes("POST"), true);
      assert.strictEqual(methods.includes("DELETE"), true);
      assert.strictEqual(res.result.stats.getEndpoints, 2);
      assert.strictEqual(res.result.stats.postEndpoints, 1);
      assert.strictEqual(res.result.stats.deleteEndpoints, 1);
    }
  });

  // 8. Path parameters
  test("8. Path parameters extraction", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "valid-petstore.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw);
    assert.strictEqual(res.success, true);
    if (res.success) {
      const ep = res.result.endpoints.find(
        (e) => e.path === "/pets/{petId}" && e.method === "GET"
      );
      assert.ok(ep, "Endpoint /pets/{petId} GET should exist");
      const pathParam = ep?.parameters.find((p) => p.name === "petId");
      assert.ok(pathParam, "petId parameter should exist");
      assert.strictEqual(pathParam?.location, "path");
      assert.strictEqual(pathParam?.required, true);
      assert.strictEqual(pathParam?.schemaType, "string");
    }
  });

  // 9. Query parameters
  test("9. Query parameters extraction", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "valid-petstore.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw);
    assert.strictEqual(res.success, true);
    if (res.success) {
      const ep = res.result.endpoints.find(
        (e) => e.path === "/pets" && e.method === "GET"
      );
      assert.ok(ep, "Endpoint /pets GET should exist");
      const queryParam = ep?.parameters.find((p) => p.name === "limit");
      assert.ok(queryParam, "limit query param should exist");
      assert.strictEqual(queryParam?.location, "query");
      assert.strictEqual(queryParam?.required, false);
      assert.strictEqual(queryParam?.schemaType, "integer");
    }
  });

  // 10. Request body
  test("10. Request body parsing", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "valid-petstore.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw);
    assert.strictEqual(res.success, true);
    if (res.success) {
      const ep = res.result.endpoints.find(
        (e) => e.path === "/pets" && e.method === "POST"
      );
      assert.ok(ep, "Endpoint /pets POST should exist");
      assert.ok(ep?.requestBody, "requestBody should exist");
      assert.strictEqual(ep?.requestBody?.required, true);
      assert.strictEqual(ep?.requestBody?.contentType, "application/json");
      assert.ok(ep?.requestBody?.schema, "schema should exist");
    }
  });

  // 11. Responses
  test("11. Responses mapping", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "valid-petstore.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw);
    assert.strictEqual(res.success, true);
    if (res.success) {
      const ep = res.result.endpoints.find(
        (e) => e.path === "/pets" && e.method === "POST"
      );
      assert.ok(ep, "Endpoint /pets POST should exist");
      const statusCodes = ep?.responses.map((r) => r.statusCode);
      assert.strictEqual(statusCodes?.includes("201"), true);
      assert.strictEqual(statusCodes?.includes("400"), true);
    }
  });

  // 12. Local $ref resolution
  test("12. Local $ref resolution (#/components/schemas/Pet)", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "valid-petstore.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw);
    assert.strictEqual(res.success, true);
    if (res.success) {
      const ep = res.result.endpoints.find(
        (e) => e.path === "/pets/{petId}" && e.method === "GET"
      );
      const resp200 = ep?.responses.find((r) => r.statusCode === "200");
      assert.ok(resp200, "200 response should exist");
      const schema = resp200?.schema as { properties?: Record<string, unknown>; required?: string[] };
      assert.ok(schema?.properties, "Resolved Pet schema should have properties");
      assert.ok("id" in (schema?.properties || {}), "Pet schema should contain id property");
      assert.ok("name" in (schema?.properties || {}), "Pet schema should contain name property");
    }
  });

  // Bonus: Verify user's sample-api.json
  test("13. User sample-api.json verification", () => {
    const raw = fs.readFileSync(path.join(__dirname, "../prisma/test-data/sample-api.json"), "utf8");
    const res = parseAndNormalizeOpenApi(raw, "sample-api.json");
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.result.title, "Reqly Demo API");
      assert.strictEqual(res.result.version, "1.0.0");
      assert.strictEqual(res.result.openapiVersion, "3.0.3");
      assert.strictEqual(res.result.endpoints.length, 5);
      assert.strictEqual(res.result.stats.getEndpoints, 2);
      assert.strictEqual(res.result.stats.postEndpoints, 2);
      assert.strictEqual(res.result.stats.deleteEndpoints, 1);
      assert.deepStrictEqual(res.result.stats.tags, ["Auth", "Users"]);
    }
  });

  console.log("==================================================");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
