export function createRevenueTwinApi(post, get) {
  return {
    evaluateRevenueTwin(callId) {
      return post(`/v1/calls/${callId}/revenue-twin/evaluations`, {});
    },
    getLatestRevenueTwinEvaluation(callId) {
      return get(`/v1/calls/${callId}/revenue-twin/evaluations/latest`);
    },
    acceptRevenueTwinOffer(callId, offerId, command, idempotencyKey) {
      return post(`/v1/calls/${callId}/revenue-twin/offers/${offerId}/accept`, command, {
        "Idempotency-Key": idempotencyKey
      });
    },
    getRevenueTwinDashboard() {
      return get("/v1/revenue-twin/dashboard");
    }
  };
}
