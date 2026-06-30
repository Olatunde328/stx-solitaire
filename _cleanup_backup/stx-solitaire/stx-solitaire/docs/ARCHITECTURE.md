# STX Solitaire Architecture

## Product Direction

STX Solitaire is the first game in a wider Stacks-based casual gaming platform.

Core pillars:

- Play
- Compete
- Earn
- Build profile
- Join leaderboards
- Participate in tournaments

## Current System

Frontend:
- Vite
- JavaScript
- Stacks Connect
- Hosted on Vercel

Smart Contract:
- Clarity reward pool
- Claim cooldown
- Player win tracking
- Total earned tracking

## Current Flow

1. Player connects Stacks wallet.
2. Player plays Solitaire in browser.
3. Player wins.
4. Player claims limited STX reward.
5. Contract checks cooldown and pool balance.
6. Contract pays reward.

## Security Notes

The current reward flow is suitable for demo and beta testing, but not yet ideal for large real-money rewards.

Main risk:
- Browser can still claim victory without strong proof.

Future secure flow:

1. Start game session.
2. Create game ID.
3. Track moves.
4. Verify completion.
5. Allow claim.
6. Record stats.

## Future Modules

- Player profiles
- XP and levels
- Daily missions
- Leaderboards
- Referrals
- Tournaments
- Sponsor-funded prize pools
- NFT achievements
