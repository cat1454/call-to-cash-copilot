import assert from "node:assert/strict";
import { mock, test } from "node:test";

// Mock react module exports
const mockUseMemo = mock.fn((fn) => fn());
const mockUseState = mock.fn((init) => [init, () => {}]);
const mockUseRef = mock.fn((init) => ({ current: init }));
const mockUseEffect = mock.fn();
const mockUseCallback = mock.fn((fn) => fn);

mock.module("react", {
  namedExports: {
    useMemo: mockUseMemo,
    useState: mockUseState,
    useRef: mockUseRef,
    useEffect: mockUseEffect,
    useCallback: mockUseCallback,
  }
});

// Import hooks after mocking react
const {
  useCallSession,
  useBookingReadModel,
  useReceiptVerification,
  usePaymentStatus
} = await import("./useServerState.js");

test("useCallSession fetcher logic", () => {
  mockUseMemo.mock.resetCalls();
  const mockApiClient = {
    getCall: mock.fn(async () => ({ callId: "c1" }))
  };

  useCallSession("c1", mockApiClient);

  assert.equal(mockUseMemo.mock.calls.length, 1);
  const fetcher = mockUseMemo.mock.calls[0].arguments[0]();
  assert.equal(typeof fetcher, "function");

  void fetcher();
  assert.equal(mockApiClient.getCall.mock.calls.length, 1);
  assert.equal(mockApiClient.getCall.mock.calls[0].arguments[0], "c1");
});

test("useBookingReadModel fetcher logic", () => {
  mockUseMemo.mock.resetCalls();
  const mockApiClient = {
    getBooking: mock.fn(async () => ({ bookingId: "b1" }))
  };

  useBookingReadModel("b1", mockApiClient);

  assert.equal(mockUseMemo.mock.calls.length, 1);
  const fetcher = mockUseMemo.mock.calls[0].arguments[0]();
  assert.equal(typeof fetcher, "function");

  void fetcher();
  assert.equal(mockApiClient.getBooking.mock.calls.length, 1);
  assert.equal(mockApiClient.getBooking.mock.calls[0].arguments[0], "b1");
});

test("useReceiptVerification fetcher logic", () => {
  mockUseMemo.mock.resetCalls();
  const mockApiClient = {
    verifyReceipt: mock.fn(async () => ({ verified: true }))
  };

  useReceiptVerification("r1", mockApiClient);

  assert.equal(mockUseMemo.mock.calls.length, 1);
  const fetcher = mockUseMemo.mock.calls[0].arguments[0]();
  assert.equal(typeof fetcher, "function");

  void fetcher();
  assert.equal(mockApiClient.verifyReceipt.mock.calls.length, 1);
  assert.equal(mockApiClient.verifyReceipt.mock.calls[0].arguments[0], "r1");
});

test("usePaymentStatus fetcher logic", () => {
  mockUseMemo.mock.resetCalls();
  const mockApiClient = {
    getPaymentStatus: mock.fn(async () => ({ status: "CONFIRMED" }))
  };

  usePaymentStatus("b1", mockApiClient);

  assert.equal(mockUseMemo.mock.calls.length, 1);
  const fetcher = mockUseMemo.mock.calls[0].arguments[0]();
  assert.equal(typeof fetcher, "function");

  void fetcher();
  assert.equal(mockApiClient.getPaymentStatus.mock.calls.length, 1);
  assert.equal(mockApiClient.getPaymentStatus.mock.calls[0].arguments[0], "b1");
});

test("null deps returns null fetcher", () => {
  mockUseMemo.mock.resetCalls();
  useCallSession(null, null);
  assert.equal(mockUseMemo.mock.calls.length, 1);
  const fetcher = mockUseMemo.mock.calls[0].arguments[0]();
  assert.equal(fetcher, null);
});
