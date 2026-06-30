;; STX Solitaire Rewards Contract
;; Mainnet-oriented reward pool with cooldown, limits, and player stats

(define-constant CONTRACT_OWNER tx-sender)

(define-constant ERR_NOT_OWNER (err u100))
(define-constant ERR_POOL_EMPTY (err u101))
(define-constant ERR_COOLDOWN_ACTIVE (err u102))
(define-constant ERR_INVALID_SCORE (err u103))
(define-constant ERR_REWARD_TOO_HIGH (err u104))
(define-constant ERR_COOLDOWN_TOO_LOW (err u105))
(define-constant ERR_CONTRACT_PAUSED (err u106))

;; Micro-STX values
(define-constant MAX_BASE_REWARD u50000)       ;; 0.05 STX
(define-constant MAX_SPEED_BONUS u20000)       ;; 0.02 STX
(define-constant MAX_EFFICIENCY_BONUS u10000)  ;; 0.01 STX
(define-constant MIN_COOLDOWN u144)            ;; around 1 day

(define-data-var base-reward uint u50000)
(define-data-var speed-bonus uint u20000)
(define-data-var efficiency-bonus uint u10000)
(define-data-var claim-cooldown uint u144)
(define-data-var contract-paused bool false)

(define-data-var total-paid uint u0)
(define-data-var total-claims uint u0)

(define-map wins-by-player principal uint)
(define-map total-earned-by-player principal uint)
(define-map last-claim-height principal uint)

(define-private (is-owner)
  (is-eq tx-sender CONTRACT_OWNER)
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
    (asserts! (is-owner) ERR_NOT_OWNER)
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

    (asserts! (not (var-get contract-paused)) ERR_CONTRACT_PAUSED)
    (asserts! (> game-score u0) ERR_INVALID_SCORE)

    (asserts!
      (>= stacks-block-height (+ last-claim (var-get claim-cooldown)))
      ERR_COOLDOWN_ACTIVE
    )

    (asserts! (>= pool-balance reward) ERR_POOL_EMPTY)

    (map-set wins-by-player player (+ wins u1))
    (map-set total-earned-by-player player (+ earned reward))
    (map-set last-claim-height player stacks-block-height)

    (var-set total-paid (+ (var-get total-paid) reward))
    (var-set total-claims (+ (var-get total-claims) u1))

    (as-contract (stx-transfer? reward tx-sender player))
  )
)

(define-public (set-rewards (new-base uint) (new-speed uint) (new-efficiency uint))
  (begin
    (asserts! (is-owner) ERR_NOT_OWNER)
    (asserts! (<= new-base MAX_BASE_REWARD) ERR_REWARD_TOO_HIGH)
    (asserts! (<= new-speed MAX_SPEED_BONUS) ERR_REWARD_TOO_HIGH)
    (asserts! (<= new-efficiency MAX_EFFICIENCY_BONUS) ERR_REWARD_TOO_HIGH)
    (var-set base-reward new-base)
    (var-set speed-bonus new-speed)
    (var-set efficiency-bonus new-efficiency)
    (ok true)
  )
)

(define-public (set-cooldown (new-cooldown uint))
  (begin
    (asserts! (is-owner) ERR_NOT_OWNER)
    (asserts! (>= new-cooldown MIN_COOLDOWN) ERR_COOLDOWN_TOO_LOW)
    (var-set claim-cooldown new-cooldown)
    (ok true)
  )
)

(define-public (set-paused (paused bool))
  (begin
    (asserts! (is-owner) ERR_NOT_OWNER)
    (var-set contract-paused paused)
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
    cooldown: (var-get claim-cooldown),
    paused: (var-get contract-paused)
  }
)
