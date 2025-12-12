# Project Import & AWS Deployment Complete

## STATUS: FULLY OPERATIONAL

### Import Progress
[x] 1. Install required packages
[x] 2. Configure workflow for webview
[x] 3. Verify project is working locally
[x] 4. Fix production build (removed vite dependency in production)
[x] 5. Deploy to AWS Elastic Beanstalk
[x] 6. Configure environment variables on AWS
[x] 7. Verify AWS deployment is healthy
[x] 8. Migrate import to Replit environment
[x] 9. Remove Fyers API completely - using Angel One only
[x] 10. Final verification - server running on port 5000
[x] 11. Install tsx package for development mode
[x] 12. Complete project import

### AWS Elastic Beanstalk Deployment
- **Application**: perala ai
- **Environment**: perala-live
- **Status**: Ready
- **Health**: Green
- **Region**: eu-north-1

### Live Production URL
**http://perala-live.eba-pdmvmcm2.eu-north-1.elasticbeanstalk.com**

### Local Development
- **Frontend**: React + Vite on port 5000
- **Backend**: Express server
- **Status**: Running

### Configuration Files Created
- `Procfile` - EB process configuration
- `.ebextensions/nodecommand.config` - EB Node.js settings
- `.ebextensions/environment.config` - Environment variables

### What Was Fixed
1. Removed vite as a production dependency (dynamic import only in dev)
2. Added --external flags in esbuild to exclude dev-only packages
3. Configured proper port (8080) for EB nginx proxy
4. Added all required AWS environment variables
5. Removed Fyers API completely - now using Angel One API only
6. Installed tsx package for development mode

### Fyers Removal Summary (December 12, 2025)
- Removed FYERS_APP_ID from .ebextensions/environment.config
- Removed FyersCredentials type from shared/schema.ts
- Removed fyers from brokerIds array
- Removed fyersCredentialSchema from schema
- Updated broker-import-dialog.tsx to remove Fyers form
- Updated broker-integrations service to remove Fyers case
- Updated log messages to reference Angel One instead of Fyers

### Journal Chart Bug Fix (December 12, 2025)
**Issue**: Journal chart was streaming fake candles when market is closed
**Root Cause**: Both backend AND frontend were processing new candles regardless of market status

**Backend Fix** (`server/angel-one-real-ticker.ts`):
- Added early market hours check at the start of WebSocket tick callback
- When market is closed: sends last known price with `isMarketOpen: false`, `isNewCandle: false`
- Skips all candle OHLC updates and new candle creation when market is closed
- Returns early to prevent any candle processing during closed hours

**Frontend Fix** (`client/src/pages/home.tsx` line 6785):
- Added `isMarketActuallyOpen` check to the new candle addition condition
- Changed: `} else if (currentCandleStartTime > lastCandleStartTime)`
- To: `} else if (currentCandleStartTime > lastCandleStartTime && isMarketActuallyOpen)`

**Files Modified**:
- `server/angel-one-real-ticker.ts` - Backend early exit when market is closed
- `client/src/pages/home.tsx` - Frontend guard for new candle addition

### Paper Trading NFO Price Streaming Fix (December 12, 2025, 3:53 AM)
**Issue**: Options and Futures (NFO) paper trading positions were not updating LTP while stocks (NIFTY) were streaming correctly.
**Root Cause**: Exchange value was not being correctly stored when creating paper positions. For NFO contracts (futures/options), the exchange was defaulting to "NSE" instead of "NFO", causing the live price stream to fail to find the correct instruments from Angel One.
**Fix Applied** (line 4584 in `client/src/pages/home.tsx`):
- Changed: `exchange: (selectedPaperTradingInstrument as any)?.exchange || "NSE"`
- To: `exchange: (selectedPaperTradingInstrument as any)?.exchange || (paperTradeType === 'MCX' ? 'MCX' : paperTradeType === 'FUTURES' || paperTradeType === 'OPTIONS' ? 'NFO' : 'NSE')`
- Now correctly defaults to:
  - 'NFO' for FUTURES and OPTIONS (enables proper Angel One NFO price streaming)
  - 'MCX' for MCX commodities
  - 'NSE' for STOCK trades
**Result**: Options and Futures positions will now stream live LTP updates every 700ms from Angel One NFO, just like stocks.

### Completion Date
December 12, 2025
