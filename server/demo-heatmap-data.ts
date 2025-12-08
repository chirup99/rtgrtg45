// Demo heatmap data for testing and demonstration purposes
export const DEMO_HEATMAP_DATA: Record<string, any> = {
  "2025-01-05": {
    date: "2025-01-05",
    performanceMetrics: {
      netPnL: 2500,
      totalTrades: 3,
      winRate: 66.67,
      avgWin: 2000,
      avgLoss: -500,
      maxWin: 3000,
      maxLoss: -1000,
      profitFactor: 3.0
    },
    tradeHistory: [
      {
        symbol: "BANKNIFTY",
        direction: "BUY",
        entryPrice: "59200",
        exitPrice: "59400",
        quantity: "1",
        pnl: "₹2,000",
        pnlPercent: "0.34%",
        duration: "25m",
        time: "09:45"
      },
      {
        symbol: "NIFTY50",
        direction: "SELL",
        entryPrice: "23950",
        exitPrice: "23900",
        quantity: "1",
        pnl: "₹500",
        pnlPercent: "0.21%",
        duration: "15m",
        time: "10:20"
      },
      {
        symbol: "RELIANCE",
        direction: "BUY",
        entryPrice: "3120",
        exitPrice: "3080",
        quantity: "1",
        pnl: "₹-40",
        pnlPercent: "-1.28%",
        duration: "10m",
        time: "10:45"
      }
    ]
  },
  "2025-02-03": {
    date: "2025-02-03",
    performanceMetrics: {
      netPnL: 5200,
      totalTrades: 5,
      winRate: 80.0,
      avgWin: 1300,
      avgLoss: -200,
      maxWin: 2500,
      maxLoss: -500,
      profitFactor: 5.2
    },
    tradeHistory: [
      {
        symbol: "BANKNIFTY",
        direction: "BUY",
        entryPrice: "59100",
        exitPrice: "59600",
        quantity: "1",
        pnl: "₹2,500",
        pnlPercent: "0.84%",
        duration: "35m",
        time: "09:30"
      },
      {
        symbol: "NIFTY50",
        direction: "BUY",
        entryPrice: "23800",
        exitPrice: "24050",
        quantity: "1",
        pnl: "₹1,050",
        pnlPercent: "1.05%",
        duration: "45m",
        time: "10:15"
      },
      {
        symbol: "SENSEX",
        direction: "SELL",
        entryPrice: "85200",
        exitPrice: "85100",
        quantity: "1",
        pnl: "₹1,200",
        pnlPercent: "0.12%",
        duration: "20m",
        time: "11:00"
      },
      {
        symbol: "GOLD",
        direction: "BUY",
        entryPrice: "35500",
        exitPrice: "35700",
        quantity: "1",
        pnl: "₹500",
        pnlPercent: "0.56%",
        duration: "30m",
        time: "14:30"
      },
      {
        symbol: "RELIANCE",
        direction: "SELL",
        entryPrice: "3150",
        exitPrice: "3140",
        quantity: "1",
        pnl: "₹-50",
        pnlPercent: "-0.32%",
        duration: "12m",
        time: "15:00"
      }
    ]
  },
  "2025-03-24": {
    date: "2025-03-24",
    performanceMetrics: {
      netPnL: -1500,
      totalTrades: 4,
      winRate: 50.0,
      avgWin: 1500,
      avgLoss: -2000,
      maxWin: 2000,
      maxLoss: -3000,
      profitFactor: 1.0
    },
    tradeHistory: [
      {
        symbol: "BANKNIFTY",
        direction: "SELL",
        entryPrice: "59500",
        exitPrice: "59300",
        quantity: "1",
        pnl: "₹1,500",
        pnlPercent: "-0.34%",
        duration: "18m",
        time: "10:00"
      },
      {
        symbol: "NIFTY50",
        direction: "BUY",
        entryPrice: "23900",
        exitPrice: "23700",
        quantity: "1",
        pnl: "₹-2,000",
        pnlPercent: "-0.84%",
        duration: "22m",
        time: "11:30"
      },
      {
        symbol: "GOLD",
        direction: "SELL",
        entryPrice: "35800",
        exitPrice: "35900",
        quantity: "1",
        pnl: "₹-1,000",
        pnlPercent: "-0.28%",
        duration: "25m",
        time: "13:00"
      },
      {
        symbol: "SILVER",
        direction: "BUY",
        entryPrice: "42500",
        exitPrice: "42600",
        quantity: "1",
        pnl: "₹500",
        pnlPercent: "0.24%",
        duration: "15m",
        time: "14:30"
      }
    ]
  },
  "2025-04-15": {
    date: "2025-04-15",
    performanceMetrics: {
      netPnL: 3800,
      totalTrades: 6,
      winRate: 66.67,
      avgWin: 1400,
      avgLoss: -1200,
      maxWin: 2500,
      maxLoss: -2000,
      profitFactor: 2.4
    },
    tradeHistory: [
      {
        symbol: "BANKNIFTY",
        direction: "BUY",
        entryPrice: "59400",
        exitPrice: "59900",
        quantity: "1",
        pnl: "₹2,500",
        pnlPercent: "0.84%",
        duration: "40m",
        time: "09:20"
      },
      {
        symbol: "NIFTY50",
        direction: "SELL",
        entryPrice: "24100",
        exitPrice: "24000",
        quantity: "1",
        pnl: "₹1,000",
        pnlPercent: "-0.41%",
        duration: "30m",
        time: "10:30"
      },
      {
        symbol: "RELIANCE",
        direction: "BUY",
        entryPrice: "3180",
        exitPrice: "3200",
        quantity: "1",
        pnl: "₹500",
        pnlPercent: "0.63%",
        duration: "20m",
        time: "11:45"
      },
      {
        symbol: "HDFCBANK",
        direction: "SELL",
        entryPrice: "1650",
        exitPrice: "1620",
        quantity: "1",
        pnl: "₹-3,000",
        pnlPercent: "-1.82%",
        duration: "35m",
        time: "13:15"
      },
      {
        symbol: "INFY",
        direction: "BUY",
        entryPrice: "3350",
        exitPrice: "3400",
        quantity: "1",
        pnl: "₹1,500",
        pnlPercent: "1.49%",
        duration: "28m",
        time: "14:00"
      },
      {
        symbol: "TCS",
        direction: "BUY",
        entryPrice: "3950",
        exitPrice: "3980",
        quantity: "1",
        pnl: "₹1,300",
        pnlPercent: "0.76%",
        duration: "32m",
        time: "15:15"
      }
    ]
  },
  "2025-05-22": {
    date: "2025-05-22",
    performanceMetrics: {
      netPnL: 6500,
      totalTrades: 7,
      winRate: 71.43,
      avgWin: 1500,
      avgLoss: -1500,
      maxWin: 3000,
      maxLoss: -3000,
      profitFactor: 3.5
    },
    tradeHistory: []
  },
  "2025-06-18": {
    date: "2025-06-18",
    performanceMetrics: {
      netPnL: 1200,
      totalTrades: 3,
      winRate: 66.67,
      avgWin: 1200,
      avgLoss: -600,
      maxWin: 2000,
      maxLoss: -1000,
      profitFactor: 2.0
    },
    tradeHistory: []
  }
};

export function getDemoHeatmapData(): Record<string, any> {
  return { ...DEMO_HEATMAP_DATA };
}

export function seedDemoDataToAWS(): Record<string, any> {
  // Format data for AWS DynamoDB with journal_ prefix
  const awsFormattedData: Record<string, any> = {};
  
  Object.entries(DEMO_HEATMAP_DATA).forEach(([date, data]) => {
    const key = `journal_${date}`;
    awsFormattedData[key] = data;
  });
  
  return awsFormattedData;
}
