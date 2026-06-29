;; STX Solitaire Rewards Contract
;; Safer public reward pool with cooldown and player stats

(define-constant contract-owner tx-sender)

(define-constant err-not-owner (err u100))
(define-constant err-pool-empty (err u101))
(define-constant err-cooldown-active (err u102))
(define-constant err-invalid-score (err u103))

;; Reward values in micro-STX
;; 0.05 STX base reward
(define-data-var base-reward uint u50000)
(define-data-var speed-bonus uint u20000)
(define-data-var efficiency-bonus uint u10000)

;; Around 1 day cooldown on Stacks
(define-data-var claim-cooldown uint u144)

(define-data-var total-paid uint u0)
(define-data-var total-claims uint u0)

(define-map wins-by-player principal uint)
(define-map total-earned-by-player principal uint)
(define-map last-claim-height principal uint)

(define-private (is-owner)
  (is-eq tx-sender contract-owner)
)

(define-private (calculate-reward (score uint) (fast-win bool) (efficient bool))
  (+
    (var-get base-reward)
    (if fast-win (var-get speed-bonus) u0)
    (if efficient (var-get efficiency-bonus) u0)
  )
)

(define-public (fund-pool (amount uint))
  (begin
    (asserts! (is-owner) err-not-owner)
    (stx-transfer? amount tx-sender (as-contract tx-sender))
  )
)

(define-public (claim-reward (game-score uint) (fast-win bool) (efficient bool))
  (let
    (
      (player tx-sender)
      (reward (calculate-reward game-score fast-win efficient))
      (pool-balance (stx-get-balance (as-contract tx-sender)))
      (wins (default-to u0 (map-get? wins-by-player tx-sender)))
      (earned (default-to u0 (map-get? total-earned-by-player tx-sender)))
      (last-claim (default-to u0 (map-get? last-claim-height tx-sender)))
    )

    ;; Basic score check
    (asserts! (> game-score u0) err-invalid-score)

    ;; Cooldown check
    (asserts!
      (>= block-height (+ last-claim (var-get claim-cooldown)))
      err-cooldown-active
    )

    ;; Pool must have enough STX
    (asserts! (>= pool-balance reward) err-pool-empty)

    ;; Update stats
    (map-set wins-by-player player (+ wins u1))
    (map-set total-earned-by-player player (+ earned reward))
    (map-set last-claim-height player block-height)

    (var-set total-paid (+ (var-get total-paid) reward))
    (var-set total-claims (+ (var-get total-claims) u1))

    ;; Pay reward
    (as-contract (stx-transfer? reward tx-sender player))
  )
)

(define-public (set-rewards (new-base uint) (new-speed uint) (new-efficiency uint))
  (begin
    (asserts! (is-owner) err-not-owner)
    (var-set base-reward new-base)
    (var-set speed-bonus new-speed)
    (var-set efficiency-bonus new-efficiency)
    (ok true)
  )
)

(define-public (set-cooldown (new-cooldown uint))
  (begin
    (asserts! (is-owner) err-not-owner)
    (var-set claim-cooldown new-cooldown)
    (ok true)
  )
)

(define-read-only (get-wins (player principal))
  (default-to u0 (map-get? wins-by-player player))
)

(define-read-only (get-total-earned (player principal))
  (default-to u0 (map-get? total-earned-by-player player))
)

(define-read-only (get-last-claim-height (player principal))
  (default-to u0 (map-get? last-claim-height player))
)

(define-read-only (get-pool-balance)
  (stx-get-balance (as-contract tx-sender))
)

(define-read-only (get-contract-stats)
  {
    pool-balance: (stx-get-balance (as-contract tx-sender)),
    total-paid: (var-get total-paid),
    total-claims: (var-get total-claims),
    base-reward: (var-get base-reward),
    speed-bonus: (var-get speed-bonus),
    efficiency-bonus: (var-get efficiency-bonus),
    cooldown: (var-get claim-cooldown)
  }
)
