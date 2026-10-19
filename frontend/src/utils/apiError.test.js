import assert from "node:assert/strict";
import test from "node:test";
import { getRequestErrorMessage } from "./apiError.js";

const unavailableMessage = "Cannot reach the server. Please try again shortly.";

test("network failures and timeouts report that the server is unreachable", () => {
  for (const code of ["ERR_NETWORK", "ECONNABORTED"]) {
    assert.equal(getRequestErrorMessage({ request: {}, code }), unavailableMessage);
  }
});

for (const status of [502, 503, 504]) {
  test(`an empty or HTML ${status} proxy response reports server unavailability`, () => {
    for (const data of ["", "<html>Bad Gateway</html>"]) {
      assert.equal(
        getRequestErrorMessage({ response: { status, data } }, "Account creation failed."),
        unavailableMessage
      );
    }
  });
}

test("internal server errors do not expose debug pages or blame account details", () => {
  assert.equal(
    getRequestErrorMessage({ response: { status: 500, data: "<html>Traceback</html>" } }),
    "The server encountered an error. Please try again shortly."
  );
});

test("validation errors retain useful field details", () => {
  assert.equal(
    getRequestErrorMessage({
      response: { status: 400, data: { email: ["This email is already registered."] } },
    }),
    "email: This email is already registered."
  );
});

test("API detail errors are retained", () => {
  assert.equal(
    getRequestErrorMessage({
      response: { status: 400, data: { non_field_errors: ["Unable to create this account."] } },
    }),
    "Unable to create this account."
  );
});

test("unknown failures use the supplied fallback", () => {
  assert.equal(getRequestErrorMessage(new Error("unknown"), "Try again."), "Try again.");
  assert.equal(getRequestErrorMessage(undefined, "Try again."), "Try again.");
});
