# Grounded Answer Judge Rubric (`grounded-answer-judge`)

## Purpose

Verify that `SupportAnswerDto` produced by `RefundSupportAgent` is grounded in the looked-up order record and the active v2.0 refund policy (`fixtures/refund-policy-current.md`).

## Passing Criteria

1. **Order Facts Match:** `orderId`, purchase window eligibility, and `refundedUsd` match the result of `lookup-order-tool`.
2. **Active Policy Rules:**
   - Self-service refund cap is **$500 USD**.
   - Purchase window is **30 days**.
3. **No Invented Fees or Promises:** The explanation must not invent restocking fees, legal settlements, or unverified exceptions not present in v2.0 policy.

## Calibration Notes

- Labeler `anna` applies the rubric strictly to v2.0 policy facts (`kappa = 1.0`).
- Labeler `ben` additionally requires explicit acknowledgement when a customer cites superseded v1.0 terms (`kappa = 0.5714`), surfacing rubric ambiguity on execution `a6d3f085-da2d-4b86-ab4e-8e5a3f61a192`.
