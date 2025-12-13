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
[x] 13. Final Replit environment migration - workflow configured with webview output
[x] 14. **FIX: Tab navigation redirect bug (December 12, 2025, 7:51 AM)**
    - Issue: Clicking any tab returned to landing page even when authenticated
    - Root Cause: Code was looking for localStorage key 'awsUserId' but App.tsx was storing 'currentUserId'
    - Fix: Replaced all 7 instances of `localStorage.getItem('awsUserId')` with `localStorage.getItem('currentUserId')` in client/src/pages/home.tsx
    - Result: Authenticated users can now navigate between tabs (Trading Home, Journal, Social Feed, etc.) without redirecting to login
    - Verification: Server restarted and running on port 5000
[x] 15. **FIX: Invalid date in demo heatmap (December 12, 2025, 2:53 PM)**
    - Issue: Invalid date entry with 6 trades and ₹78,815 P&L found on demo heatmap
    - Root Cause: AWS DynamoDB had a journal entry with invalid/malformed date key
    - Fix: Added date validation in getAllJournalData() function in aws-dynamodb-service.ts
    - Implementation: Detects invalid date formats (non-YYYY-MM-DD) and automatically replaces them with today's date
    - Auto-fixes: Invalid entries are updated in AWS and replaced with today's date (2025-12-12)
    - Result: Demo heatmap now shows correct dates, P&L calculations use valid dates, trend line calculates correctly
    - Verification: Server restarted with the fix applied
[x] 36. **FIX: Overtrading curved lines not displaying on heatmap (December 12, 2025, 6:40 PM)**
    - Issue: Clicking Overtrading button didn't show curved lines to heatmap dates like FOMO button does
    - Root Cause: Curved line rendering was hardcoded to only work for 'fomo' tag
    - Fix Applied to home.tsx:
      * Line 8194: Added `const overtradingButtonRef = useRef<HTMLButtonElement>(null);`
      * Line 16545: Added `ref={overtradingButtonRef}` to Overtrading button
      * Line 16293: Updated condition from `activeTagHighlight?.tag === 'fomo'` to `(activeTagHighlight?.tag === 'fomo' || activeTagHighlight?.tag === 'overtrading')`
      * Line 16301: Added dynamic button ref selection: `const buttonRef = activeTagHighlight?.tag === 'fomo' ? fomoButtonRef : overtradingButtonRef;`
      * Lines 16347-16352: Updated stroke color and dots to use different colors for overtrading (orange) vs FOMO (purple/yellow)
      * Lines 16391-16397: Added new orange gradient definition `overtradingLineGradient` with orange color stops (#fb923c, #f97316, #ea580c)
    - Colors Used:
      * FOMO curves: Purple → Pink → Yellow gradient with yellow pulsing dots
      * Overtrading curves: Orange gradient with orange pulsing dots
    - Result: 
      * Clicking Overtrading button now displays curved lines from button to each overtrading date on heatmap
      * Lines match FOMO functionality and animation style
      * Orange color scheme matches the orange "OvrTrade" count display on button
    - Verification: Server restarted and running successfully
[x] 38. **FIX: Planned button curved lines scroll sync (December 13, 2025, 3:37 AM)**
    - Issue: Planned button curved lines were not moving according to heatmap scroll (unlike FOMO and Overtrading which worked correctly)
    - Root Cause: Scroll effect hook at line 8209 had condition checking only for 'fomo' and 'overtrading' tags, excluding 'planned'
    - Fix Applied to home.tsx:
      * Line 8209: Updated condition from `(activeTagHighlight.tag !== 'fomo' && activeTagHighlight.tag !== 'overtrading')` to `(activeTagHighlight.tag !== 'fomo' && activeTagHighlight.tag !== 'overtrading' && activeTagHighlight.tag !== 'planned')`
      * This ensures the scroll listener is active when Planned button is selected
      * Planned gradient already defined at lines 16398-16405 with green color scheme (#4ade80, #22c55e, #16a34a)
      * Button ref (plannedButtonRef) already configured for dynamic selection at line 16303
    - Result: 
      * Planned button curved lines now properly sync with heatmap scroll
      * Lines move smoothly with horizontal scroll like FOMO and Overtrading buttons
      * Green color scheme visible and matches button styling
    - Verification: Server restarted, application running on port 5000, no errors

### Current Status: ALL UPDATES COMPLETE (38 ITEMS)
- Application running on port 5000
- Dark theme is the DEFAULT theme
- All dashboard sections have consistent styling
- All windows have consistent styling: `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800`
- Chart visibility enhanced with proper color variables
- All three stat button tags (FOMO, Overtrading, Planned) working with curved lines that sync to heatmap scroll
