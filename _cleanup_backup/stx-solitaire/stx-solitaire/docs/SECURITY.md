# STX Solitaire Security Notes

## Current Protections

- Reward pool balance check
- Claim cooldown
- Owner-only pool funding
- Owner-only reward settings
- Player win tracking

## Current Risks

1. Frontend trust risk
   - Browser currently tells contract the player won.

2. Reward farming
   - Cooldown reduces farming but does not fully prevent dishonest claims.

3. No server-side verification yet
   - Game completion is not independently verified.

4. No Clarinet tests yet
   - Contract behavior should be tested before mainnet.

## Before Mainnet

Required:

- Clarinet tests
- Stronger game session model
- Claim verification
- Abuse prevention
- Lower reward values
- Treasury controls
- Emergency pause function
