/**
 * Advanced AI Trading Agent - Like Replit Agent but for Trading
 * 
 * This agent uses LLM function calling to intelligently:
 * - Analyze stocks with real-time data from Angel One
 * - Search news and market sentiment
 * - Access user's trading journal for personalized insights
 * - Query social feed for community discussions
 * - Generate comprehensive reports with charts
 */

import { GoogleGenAI } from "@google/genai";
import axios from "axios";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// =============================================================================
// TYPES
// =============================================================================

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

export interface AgentResponse {
  message: string;
  charts?: ChartData[];
  stocks?: StockInsight[];
  news?: NewsItem[];
  insights?: string[];
  actions?: ActionSuggestion[];
  sources?: string[];
}

export interface ChartData {
  type: 'price' | 'performance' | 'comparison' | 'sentiment';
  title: string;
  data: Array<{ time: string; value: number; label?: string }>;
  trend?: 'positive' | 'negative' | 'neutral';
}

export interface StockInsight {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  technicalSignal?: string;
  sentimentScore?: number;
  recommendation?: string;
}

export interface NewsItem {
  title: string;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevance: number;
  url?: string;
}

export interface ActionSuggestion {
  action: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

// =============================================================================
// TRADING TOOLS - Functions the AI can call
// =============================================================================

const tradingTools: AgentTool[] = [
  {
    name: "get_stock_price",
    description: "Get real-time stock price, technical indicators (RSI, MACD, EMA), and fundamental data for a stock symbol",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol like RELIANCE, TCS, INFY" }
      },
      required: ["symbol"]
    },
    execute: async (params: { symbol: string }) => {
      try {
        const response = await axios.get(`http://localhost:5000/api/stock-analysis/${params.symbol.toUpperCase()}`);
        return response.data;
      } catch (error) {
        return { error: `Failed to fetch data for ${params.symbol}` };
      }
    }
  },
  {
    name: "get_chart_data",
    description: "Get historical price chart data for a stock with specified timeframe (1D, 5D, 1M, 6M, 1Y)",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol" },
        timeframe: { type: "string", enum: ["1D", "5D", "1M", "6M", "1Y"], description: "Chart timeframe" }
      },
      required: ["symbol"]
    },
    execute: async (params: { symbol: string; timeframe?: string }) => {
      try {
        const tf = params.timeframe || "1D";
        const response = await axios.get(`http://localhost:5000/api/stock-chart-data/${params.symbol.toUpperCase()}?timeframe=${tf}`);
        return { chartData: response.data, timeframe: tf };
      } catch (error) {
        return { error: `Failed to fetch chart data for ${params.symbol}` };
      }
    }
  },
  {
    name: "search_market_news",
    description: "Search for latest financial news and market updates. Can filter by stock symbol or topic.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query like 'RELIANCE earnings' or 'RBI rate decision'" },
        limit: { type: "number", description: "Number of results to return (max 10)" }
      },
      required: ["query"]
    },
    execute: async (params: { query: string; limit?: number }) => {
      try {
        const response = await axios.get(`http://localhost:5000/api/stock-news`, {
          params: { q: params.query, limit: params.limit || 5 }
        });
        return response.data;
      } catch (error) {
        return { news: [], error: "Failed to fetch news" };
      }
    }
  },
  {
    name: "get_trading_journal",
    description: "Get user's trading journal data including P&L, win rate, trade history, and performance metrics",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "week", "month", "all"], description: "Time period for journal data" }
      }
    },
    execute: async (params: { period?: string }) => {
      try {
        const response = await axios.get(`http://localhost:5000/api/journal/all-dates`);
        const allData = response.data;
        
        // Calculate summary statistics
        const dates = Object.keys(allData);
        let totalPnL = 0;
        let totalTrades = 0;
        let winningTrades = 0;
        
        dates.forEach(date => {
          const dayData = allData[date];
          const metrics = dayData?.tradingData?.performanceMetrics || dayData?.performanceMetrics;
          if (metrics) {
            totalPnL += metrics.netPnL || 0;
            totalTrades += metrics.totalTrades || 0;
            winningTrades += metrics.winningTrades || 0;
          }
        });
        
        return {
          totalDays: dates.length,
          totalPnL,
          totalTrades,
          winRate: totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(1) : 0,
          recentDates: dates.slice(-7)
        };
      } catch (error) {
        return { error: "Failed to fetch journal data" };
      }
    }
  },
  {
    name: "get_social_feed",
    description: "Get community discussions and sentiment from the social feed. Filter by stock symbol or topic.",
    parameters: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter by stock symbol or topic" },
        limit: { type: "number", description: "Number of posts to return" }
      }
    },
    execute: async (params: { filter?: string; limit?: number }) => {
      try {
        const response = await axios.get(`http://localhost:5000/api/social-posts`, {
          params: { limit: params.limit || 10 }
        });
        
        let posts = response.data.posts || [];
        
        // Filter by keyword if provided
        if (params.filter) {
          const filterLower = params.filter.toLowerCase();
          posts = posts.filter((post: any) => 
            post.content?.toLowerCase().includes(filterLower) ||
            post.stockSymbol?.toLowerCase().includes(filterLower)
          );
        }
        
        return {
          posts: posts.slice(0, params.limit || 10),
          totalCount: posts.length
        };
      } catch (error) {
        return { posts: [], error: "Failed to fetch social feed" };
      }
    }
  },
  {
    name: "compare_stocks",
    description: "Compare multiple stocks by price, fundamentals, and performance",
    parameters: {
      type: "object",
      properties: {
        symbols: { type: "array", items: { type: "string" }, description: "List of stock symbols to compare" }
      },
      required: ["symbols"]
    },
    execute: async (params: { symbols: string[] }) => {
      try {
        const comparisons = await Promise.all(
          params.symbols.slice(0, 5).map(async (symbol) => {
            try {
              const response = await axios.get(`http://localhost:5000/api/stock-analysis/${symbol.toUpperCase()}`);
              return { symbol: symbol.toUpperCase(), data: response.data };
            } catch {
              return { symbol: symbol.toUpperCase(), error: "Data unavailable" };
            }
          })
        );
        return { comparisons };
      } catch (error) {
        return { error: "Failed to compare stocks" };
      }
    }
  },
  {
    name: "get_market_indices",
    description: "Get current market indices like NIFTY, SENSEX, Bank Nifty with real-time prices",
    parameters: {
      type: "object",
      properties: {}
    },
    execute: async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/market-indices`);
        return response.data;
      } catch (error) {
        return { error: "Failed to fetch market indices" };
      }
    }
  },
  {
    name: "search_ipo",
    description: "Get information about upcoming IPOs, current IPO subscriptions, and recent IPO listings",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["upcoming", "current", "recent", "all"], description: "IPO status filter" }
      }
    },
    execute: async (params: { status?: string }) => {
      // Return structured IPO data
      return {
        upcoming: [
          { name: "Upcoming IPO 1", date: "Dec 2025", priceRange: "₹500-550", size: "₹1000 Cr" }
        ],
        current: [
          { name: "Active IPO", subscriptionDays: "Day 2 of 3", subscriptionRate: "2.5x" }
        ],
        recent: [
          { name: "Recent Listing", listingGain: "+15%", currentPrice: "₹625" }
        ],
        note: "For latest IPO data, check financial news sources"
      };
    }
  },
  {
    name: "analyze_sentiment",
    description: "Analyze market sentiment for a stock based on news, social feed, and price action",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol to analyze" }
      },
      required: ["symbol"]
    },
    execute: async (params: { symbol: string }) => {
      try {
        // Get stock data
        const stockResponse = await axios.get(`http://localhost:5000/api/stock-analysis/${params.symbol.toUpperCase()}`);
        const stockData = stockResponse.data;
        
        // Get social feed mentions
        const socialResponse = await axios.get(`http://localhost:5000/api/social-posts`, {
          params: { limit: 20 }
        });
        const posts = socialResponse.data.posts || [];
        const mentions = posts.filter((p: any) => 
          p.content?.toLowerCase().includes(params.symbol.toLowerCase())
        );
        
        // Calculate sentiment
        const priceChange = stockData?.priceData?.close && stockData?.priceData?.open 
          ? ((stockData.priceData.close - stockData.priceData.open) / stockData.priceData.open * 100)
          : 0;
        
        const sentimentScore = (
          (priceChange > 0 ? 60 : priceChange < 0 ? 40 : 50) +
          (mentions.length > 5 ? 10 : mentions.length > 0 ? 5 : 0)
        ) / 100;
        
        return {
          symbol: params.symbol.toUpperCase(),
          sentimentScore,
          sentiment: sentimentScore > 0.6 ? 'bullish' : sentimentScore < 0.4 ? 'bearish' : 'neutral',
          priceChange: priceChange.toFixed(2) + '%',
          socialMentions: mentions.length,
          technicalRating: stockData?.indicators?.rsi > 70 ? 'overbought' : 
                          stockData?.indicators?.rsi < 30 ? 'oversold' : 'neutral'
        };
      } catch (error) {
        return { error: `Failed to analyze sentiment for ${params.symbol}` };
      }
    }
  }
];

// =============================================================================
// AI AGENT ORCHESTRATOR
// =============================================================================

export class TradingAIAgent {
  private tools: AgentTool[];
  private conversationHistory: Array<{ role: string; content: string }>;

  constructor() {
    this.tools = tradingTools;
    this.conversationHistory = [];
  }

  private getToolDescriptions(): string {
    return this.tools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');
  }

  private parseToolCalls(response: string): Array<{ tool: string; params: any }> {
    const toolCalls: Array<{ tool: string; params: any }> = [];
    
    // Look for tool call patterns like [TOOL: tool_name(params)]
    const toolPattern = /\[TOOL:\s*(\w+)\((.*?)\)\]/g;
    let match;
    
    while ((match = toolPattern.exec(response)) !== null) {
      const toolName = match[1];
      const paramsStr = match[2];
      
      try {
        // Parse parameters as JSON or key=value pairs
        let params = {};
        if (paramsStr.trim().startsWith('{')) {
          params = JSON.parse(paramsStr);
        } else if (paramsStr.includes('=')) {
          paramsStr.split(',').forEach(pair => {
            const [key, value] = pair.split('=').map(s => s.trim().replace(/["']/g, ''));
            (params as any)[key] = value;
          });
        } else if (paramsStr.trim()) {
          // Single value - assume it's the first required parameter
          const tool = this.tools.find(t => t.name === toolName);
          if (tool) {
            const firstRequired = Object.keys(tool.parameters.properties || {})[0];
            if (firstRequired) {
              (params as any)[firstRequired] = paramsStr.trim().replace(/["']/g, '');
            }
          }
        }
        
        toolCalls.push({ tool: toolName, params });
      } catch (e) {
        console.error(`Failed to parse tool call: ${match[0]}`, e);
      }
    }
    
    return toolCalls;
  }

  async processQuery(query: string, context?: {
    userId?: string;
    journalData?: any;
    socialData?: any;
  }): Promise<AgentResponse> {
    console.log(`🤖 [TRADING-AGENT] Processing query: ${query}`);
    
    const systemPrompt = `You are an advanced AI Trading Agent - like a personal trading assistant that can analyze markets, provide insights, and help with investment decisions.

## YOUR CAPABILITIES
You have access to these tools that you can use to gather information:
${this.getToolDescriptions()}

## HOW TO USE TOOLS
When you need data, include a tool call in this exact format:
[TOOL: tool_name(param1="value1", param2="value2")]

Examples:
- [TOOL: get_stock_price(symbol="RELIANCE")]
- [TOOL: search_market_news(query="RBI rate decision")]
- [TOOL: get_chart_data(symbol="TCS", timeframe="1M")]
- [TOOL: compare_stocks(symbols=["RELIANCE", "TCS", "INFY"])]
- [TOOL: get_trading_journal(period="week")]
- [TOOL: analyze_sentiment(symbol="HDFCBANK")]

## RESPONSE GUIDELINES
1. **Understand the user's intent** - Are they asking about a stock, news, their performance, or market trends?
2. **Call relevant tools** to get accurate, real-time data
3. **Provide comprehensive analysis** combining multiple data sources
4. **Be specific with numbers** - Show prices, percentages, volumes
5. **Include actionable insights** - What should the user do with this information?
6. **Format responses clearly** with sections and bullet points

## SPECIAL MARKERS
- For chart data, include: [CHART:symbol_timeframe] (e.g., [CHART:RELIANCE_1M])
- For key metrics, use: **metric: value**
- For recommendations: 📊 for analysis, 💡 for insights, ⚠️ for warnings

## CONTEXT
The user is on a trading platform with:
- Real-time stock data from Angel One API
- A personal trading journal tracking their trades
- A social feed with community discussions
- Technical analysis tools (RSI, MACD, EMA, etc.)

Now respond to the user's query. Be helpful, accurate, and insightful.`;

    try {
      // First pass: Let LLM decide what tools to call
      const planningResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "user", parts: [{ text: `User Query: ${query}\n\nFirst, determine which tools you need to call to answer this query. Include all relevant tool calls.` }] }
        ]
      });

      const planText = planningResponse.text || "";
      console.log(`🔧 [TRADING-AGENT] Planning response:`, planText.substring(0, 500));
      
      // Parse and execute tool calls
      const toolCalls = this.parseToolCalls(planText);
      console.log(`🔧 [TRADING-AGENT] Tool calls identified:`, toolCalls.length);
      
      const toolResults: Record<string, any> = {};
      
      for (const call of toolCalls) {
        const tool = this.tools.find(t => t.name === call.tool);
        if (tool) {
          console.log(`🔧 [TRADING-AGENT] Executing: ${call.tool}`, call.params);
          try {
            toolResults[call.tool] = await tool.execute(call.params);
          } catch (e) {
            console.error(`❌ [TRADING-AGENT] Tool error:`, e);
            toolResults[call.tool] = { error: `Failed to execute ${call.tool}` };
          }
        }
      }
      
      // Second pass: Generate final response with tool results
      const hasToolResults = Object.keys(toolResults).length > 0;
      
      const finalPrompt = hasToolResults 
        ? `${systemPrompt}

## TOOL RESULTS
Here is the data from the tools you called:
${JSON.stringify(toolResults, null, 2)}

Now provide a comprehensive response to the user's query using this data. Be specific with numbers and provide actionable insights.

User Query: ${query}`
        : `${systemPrompt}

User Query: ${query}

Provide a helpful response. If you need specific data, mention what tools would help.`;

      const finalResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }]
      });

      const responseText = finalResponse.text || "I apologize, but I couldn't generate a response. Please try again.";
      
      // Extract chart markers for the frontend
      const charts: ChartData[] = [];
      const chartPattern = /\[CHART:(\w+)_(\w+)\]/g;
      let chartMatch;
      while ((chartMatch = chartPattern.exec(responseText)) !== null) {
        const symbol = chartMatch[1];
        const timeframe = chartMatch[2];
        const chartToolResult = toolResults['get_chart_data'];
        if (chartToolResult?.chartData) {
          charts.push({
            type: 'price',
            title: `${symbol} - ${timeframe}`,
            data: chartToolResult.chartData,
            trend: chartToolResult.chartData.length > 1 && 
                   chartToolResult.chartData[chartToolResult.chartData.length - 1]?.price > 
                   chartToolResult.chartData[0]?.price ? 'positive' : 'negative'
          });
        }
      }

      // Extract stock insights
      const stocks: StockInsight[] = [];
      const stockPriceResult = toolResults['get_stock_price'];
      if (stockPriceResult?.priceData) {
        stocks.push({
          symbol: stockPriceResult.symbol || 'Unknown',
          price: stockPriceResult.priceData?.close,
          change: stockPriceResult.priceData?.close - stockPriceResult.priceData?.open,
          changePercent: ((stockPriceResult.priceData?.close - stockPriceResult.priceData?.open) / stockPriceResult.priceData?.open * 100),
          technicalSignal: stockPriceResult.indicators?.rsi > 70 ? 'Overbought' : 
                          stockPriceResult.indicators?.rsi < 30 ? 'Oversold' : 'Neutral'
        });
      }

      // Collect sources
      const sources: string[] = [];
      if (toolResults['get_stock_price']) sources.push('Angel One Real-time Data');
      if (toolResults['search_market_news']) sources.push('Financial News');
      if (toolResults['get_trading_journal']) sources.push('Your Trading Journal');
      if (toolResults['get_social_feed']) sources.push('Community Discussions');
      if (toolResults['get_market_indices']) sources.push('Market Indices');

      return {
        message: responseText,
        charts,
        stocks,
        sources,
        insights: this.extractInsights(responseText)
      };

    } catch (error) {
      console.error(`❌ [TRADING-AGENT] Error:`, error);
      return {
        message: `I encountered an error processing your request. Please try again or rephrase your question.`,
        insights: ['Try being more specific with stock symbols', 'Check if the market is open']
      };
    }
  }

  private extractInsights(text: string): string[] {
    const insights: string[] = [];
    
    // Extract lines starting with 💡, 📊, or containing "insight", "recommendation"
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('💡') || line.includes('📊') || 
          line.toLowerCase().includes('insight') ||
          line.toLowerCase().includes('recommend')) {
        insights.push(line.trim().replace(/^[-*•]\s*/, ''));
      }
    }
    
    return insights.slice(0, 5);
  }
}

// Export singleton instance
export const tradingAIAgent = new TradingAIAgent();
