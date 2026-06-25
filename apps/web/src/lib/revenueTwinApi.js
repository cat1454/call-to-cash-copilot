export function createRevenueTwinApi(post, get) {
  return {
    evaluateRevenueTwin(callId) {
      return post(`/v1/calls/${callId}/revenue-twin/evaluations`, {});
    },
    getLatestRevenueTwinEvaluation(callId) {
      return get(`/v1/calls/${callId}/revenue-twin/evaluations/latest`);
    },
    getRevenueTwinDashboard() {
      return get("/v1/revenue-twin/dashboard");
    }
  };
}
