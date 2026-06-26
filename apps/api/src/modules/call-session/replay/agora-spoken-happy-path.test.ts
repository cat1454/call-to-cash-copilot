import assert from "node:assert/strict";
import test from "node:test";

import { extractReplayFacts } from "./replay-extractor.js";

const options = {
  departures: [
    {
      routeCode: "DAD-NHA",
      routeFrom: "Da Nang",
      routeTo: "Nha Trang",
      departureAtUtc: new Date("2026-06-28T00:00:00.000Z")
    }
  ],
  now: new Date("2026-06-22T00:00:00.000Z")
};

test("extracts every separately spoken Agora happy-path phrase", () => {
  assert.deepEqual(extractReplayFacts("Toi muon dat ve xe tu Da Nang den Nha Trang.", options), {
    routeFrom: "Da Nang",
    routeTo: "Nha Trang"
  });
  assert.deepEqual(extractReplayFacts("Ngay khoi hanh la ngay hai muoi tam thang sau."), {
    departureDay: 28,
    departureMonth: 6
  });
  assert.deepEqual(extractReplayFacts("Gio khoi hanh la bay gio."), {
    departureLocalTime: "07:00"
  });
  assert.equal(extractReplayFacts("So luong hanh khach la ba nguoi.").passengerCount, 3);
  assert.equal(
    extractReplayFacts("So dien thoai la khong chin khong mot hai ba bon nam sau bay.")
      .contactPhoneMasked,
    "0901***567"
  );
  assert.equal(
    extractReplayFacts("So dien thoai la khong, chin khong, mothai, ba, bon, nam, sau, bay.")
      .contactPhoneMasked,
    "0901***567"
  );
  assert.equal(
    extractReplayFacts("So dien thoai la chin tram le mot hai ba bon nam sau bay.")
      .contactPhoneMasked,
    "0901***567"
  );
  assert.equal(
    extractReplayFacts("khong chin khong mot hai ba bon nam sau bay.").contactPhoneMasked,
    undefined
  );
  assert.equal(
    extractReplayFacts("mot hai ba bon nam sau bay tam chin.").contactPhoneMasked,
    undefined
  );
  assert.equal(
    extractReplayFacts("Diem don la ben xe trung tam Da Nang.", options).pickupPoint,
    "Ben xe Trung tam Da Nang"
  );
  assert.equal(
    extractReplayFacts("Diem don la bay xe trung tam Da Nang.", options).pickupPoint,
    "Ben xe Trung tam Da Nang"
  );
  assert.equal(
    extractReplayFacts("Diem don la bay xe trung tam Da Nang.", options).pickupPoint,
    "Ben xe Trung tam Da Nang"
  );
  assert.equal(
    extractReplayFacts("Toi giu so luong hanh khach la ba nguoi. Cac thong tin khac giu nguyen.")
      .passengerCount,
    3
  );
  assert.deepEqual(
    extractReplayFacts(
      "Toi xac nhan chuyen tu Da Nang den Nha Trang, ngay hai muoi tam thang sau, luc bay gio, cho ba nguoi. Toi dong y dat coc theo dieu khoan vua doc.",
      options
    ),
    {
      routeFrom: "Da Nang",
      routeTo: "Nha Trang",
      departureLocalTime: "07:00",
      departureDay: 28,
      departureMonth: 6,
      passengerCount: 3
    }
  );
});
