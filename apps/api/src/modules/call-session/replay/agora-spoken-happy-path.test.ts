import assert from "node:assert/strict";
import test from "node:test";

import { extractReplayFacts } from "./replay-extractor.js";

const options = {
  departures: [
    {
      routeFrom: "Da Nang",
      routeTo: "Ha Noi",
      departureAtUtc: new Date("2026-06-28T12:00:00.000Z")
    }
  ],
  now: new Date("2026-06-22T00:00:00.000Z")
};

test("extracts every separately spoken Agora happy-path phrase", () => {
  assert.deepEqual(extractReplayFacts("Tôi muốn đặt vé xe từ Đà Nẵng đến Hà Nội.", options), {
    routeFrom: "Da Nang",
    routeTo: "Ha Noi"
  });
  assert.deepEqual(extractReplayFacts("Ngày khởi hành là ngày hai mươi tám tháng sáu."), {
    departureDay: 28,
    departureMonth: 6
  });
  assert.deepEqual(extractReplayFacts("Giờ khởi hành là mười chín giờ."), {
    departureLocalTime: "19:00"
  });
  assert.equal(extractReplayFacts("Số lượng hành khách là ba người.").passengerCount, 3);
  assert.equal(
    extractReplayFacts("Số điện thoại là không chín không một hai ba bốn năm sáu bảy.")
      .contactPhoneMasked,
    "0901***567"
  );
  assert.equal(
    extractReplayFacts("Điểm đón là bến xe trung tâm Đà Nẵng.").pickupPoint,
    "Ben xe Trung tam Da Nang"
  );
  assert.equal(
    extractReplayFacts(
      "Tôi muốn sửa số lượng hành khách từ ba người thành bốn người. Các thông tin khác giữ nguyên."
    ).passengerCount,
    4
  );
  assert.deepEqual(
    extractReplayFacts(
      "Tôi xác nhận chuyến từ Đà Nẵng đến Hà Nội, ngày hai mươi tám tháng sáu, lúc mười chín giờ, cho bốn người. Tôi đồng ý đặt cọc theo điều khoản vừa đọc.",
      options
    ),
    {
      routeFrom: "Da Nang",
      routeTo: "Ha Noi",
      departureLocalTime: "19:00",
      departureDay: 28,
      departureMonth: 6,
      passengerCount: 4
    }
  );
});
