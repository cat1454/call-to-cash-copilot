export const WEB_CONFIRMATION_TEXT = "Xác nhận điều khoản và mở thanh toán";
export const inactiveAgreementConfirmation = {
  required: false,
  editRequested: false,
  pending: false,
  confirm: () => {},
  requestEdit: () => {}
};

export function isReadyForWebAgreementConfirmation(booking, paymentGate) {
  return (
    booking?.status === "AGREEMENT_READY" &&
    Number.isSafeInteger(booking.agreementVersion) &&
    booking.agreementVersion > 0 &&
    paymentGate === "READY_FOR_CONFIRMATION"
  );
}

export function webAgreementConfirmationPayload(booking) {
  return {
    agreementVersion: booking.agreementVersion,
    confirmation: {
      method: "WEB",
      text: WEB_CONFIRMATION_TEXT
    }
  };
}

export function agreementConfirmationKey(booking) {
  return `${booking?.bookingId ?? ""}:v${booking?.agreementVersion ?? ""}`;
}
