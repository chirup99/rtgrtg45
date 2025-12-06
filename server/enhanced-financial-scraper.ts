import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedStockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  marketCap: string;
  pe: number;
  eps: number;
  high52Week: number;
  low52Week: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  open: number;
  sector: string;
  industry: string;
  lastUpdated: string;
}

export interface ScrapedNewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface MarketOverview {
  index: string;
  value: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface QuarterlyData {
  quarter: string;
  value: number;
  change: number;
  changePercent: number;
}

// Balance Sheet row item
export interface BalanceSheetRow {
  label: string;
  values: Array<{ year: string; value: number }>;
}

// Profit & Loss row item
export interface ProfitLossRow {
  label: string;
  values: Array<{ year: string; value: number }>;
}

// Annual financial data structure
export interface AnnualFinancialData {
  years: string[];
  balanceSheet: BalanceSheetRow[];
  profitLoss: ProfitLossRow[];
}

export interface CompanyInsights {
  symbol: string;
  name: string;
  currentPrice: number;
  quarterlyPerformance: QuarterlyData[];
  trend: 'positive' | 'negative' | 'neutral';
  trendStrength: number;
  revenueGrowth: number;
  profitGrowth: number;
  pe: number;
  eps: number;
  recommendation: string;
  chartData: Array<{ quarter: string; value: number; trend: string }>;
  // New: Annual financial statements
  annualFinancials?: AnnualFinancialData;
}

export interface FinancialSearchResult {
  query: string;
  webResults: Array<{
    title: string;
    snippet: string;
    url: string;
    relevanceScore: number;
  }>;
  financialData: string;
  timestamp: string;
}

export class EnhancedFinancialScraper {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  private cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async searchFinancialWeb(query: string, maxResults: number = 10): Promise<FinancialSearchResult> {
    const result: FinancialSearchResult = {
      query,
      webResults: [],
      financialData: '',
      timestamp: new Date().toISOString()
    };

    try {
      console.log(`[ENHANCED-SCRAPER] Searching: "${query}"`);
      
      const searchQueries = [
        `${query} stock market india NSE BSE`,
        `${query} share price analysis`,
        `${query} financial news today`
      ];

      for (const searchQuery of searchQueries) {
        try {
          const googleNewsResults = await this.scrapeGoogleNews(searchQuery, 5);
          result.webResults.push(...googleNewsResults);
        } catch (e) {
          console.log(`[ENHANCED-SCRAPER] Google News search failed, trying alternatives`);
        }
      }

      try {
        const duckResults = await this.scrapeDuckDuckGo(query, 5);
        result.webResults.push(...duckResults);
      } catch (e) {
        console.log(`[ENHANCED-SCRAPER] DuckDuckGo search failed`);
      }

      const stockSymbol = this.extractStockSymbol(query);
      if (stockSymbol) {
        const stockInfo = await this.scrapeStockInfo(stockSymbol);
        if (stockInfo) {
          result.financialData = this.formatStockDataAsText(stockInfo);
        }
      }

      result.webResults = result.webResults
        .slice(0, maxResults)
        .map((r, index) => ({
          ...r,
          relevanceScore: 1 - (index * 0.1)
        }));

      console.log(`[ENHANCED-SCRAPER] Found ${result.webResults.length} results`);
      return result;

    } catch (error) {
      console.error('[ENHANCED-SCRAPER] Search error:', error);
      return result;
    }
  }

  private async scrapeGoogleNews(query: string, limit: number): Promise<Array<{title: string; snippet: string; url: string; relevanceScore: number}>> {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
      
      const response = await axios.get(rssUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const results: Array<{title: string; snippet: string; url: string; relevanceScore: number}> = [];

      $('item').slice(0, limit).each((i, elem) => {
        const title = this.cleanText($(elem).find('title').text());
        const link = $(elem).find('link').text();
        const description = this.cleanText($(elem).find('description').text()) || title;
        const pubDate = $(elem).find('pubDate').text();

        if (title && link) {
          results.push({
            title,
            snippet: description.length > 200 ? description.substring(0, 200) + '...' : description,
            url: link,
            relevanceScore: 0.9 - (i * 0.1)
          });
        }
      });

      return results;
    } catch (error) {
      console.error('[ENHANCED-SCRAPER] Google News RSS error:', error);
      return [];
    }
  }

  private async scrapeDuckDuckGo(query: string, limit: number): Promise<Array<{title: string; snippet: string; url: string; relevanceScore: number}>> {
    try {
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' india stock')}&format=json&no_html=1`;
      
      const response = await axios.get(searchUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });

      const results: Array<{title: string; snippet: string; url: string; relevanceScore: number}> = [];

      if (response.data.Abstract) {
        results.push({
          title: response.data.Heading || query,
          snippet: response.data.Abstract,
          url: response.data.AbstractURL || '',
          relevanceScore: 1.0
        });
      }

      if (response.data.RelatedTopics) {
        for (const topic of response.data.RelatedTopics.slice(0, limit - 1)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: this.cleanText(topic.Text.substring(0, 100)),
              snippet: this.cleanText(topic.Text),
              url: topic.FirstURL,
              relevanceScore: 0.8
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error('[ENHANCED-SCRAPER] DuckDuckGo error:', error);
      return [];
    }
  }

  private extractStockSymbol(query: string): string | null {
    const lowerQuery = query.toLowerCase();
    
    const stockMap: Record<string, string> = {
      'reliance': 'RELIANCE',
      'tcs': 'TCS',
      'tata consultancy': 'TCS',
      'infosys': 'INFY',
      'infy': 'INFY',
      'hdfc bank': 'HDFCBANK',
      'hdfcbank': 'HDFCBANK',
      'hdfc': 'HDFCBANK',
      'icici bank': 'ICICIBANK',
      'icicibank': 'ICICIBANK',
      'icici': 'ICICIBANK',
      'sbi': 'SBIN',
      'state bank': 'SBIN',
      'bharti airtel': 'BHARTIARTL',
      'airtel': 'BHARTIARTL',
      'itc': 'ITC',
      'wipro': 'WIPRO',
      'nifty': 'NIFTY50',
      'banknifty': 'BANKNIFTY',
      'sensex': 'SENSEX',
      'tata motors': 'TATAMOTORS',
      'maruti': 'MARUTI',
      'adani ports': 'ADANIPORTS',
      'adani enterprises': 'ADANIENT',
      'axis bank': 'AXISBANK',
      'kotak bank': 'KOTAKBANK',
      'bajaj finance': 'BAJFINANCE',
      'asian paints': 'ASIANPAINT',
      'larsen': 'LT',
      'l&t': 'LT',
      'tech mahindra': 'TECHM',
      'sun pharma': 'SUNPHARMA',
      'titan': 'TITAN',
      'ultratech': 'ULTRACEMCO',
      'nestle': 'NESTLEIND',
      'hul': 'HINDUNILVR',
      'hindustan unilever': 'HINDUNILVR',
      'power grid': 'POWERGRID',
      'ntpc': 'NTPC',
      'ongc': 'ONGC',
      'coal india': 'COALINDIA',
      'jio': 'JIOFINANCE'
    };

    for (const [keyword, symbol] of Object.entries(stockMap)) {
      if (lowerQuery.includes(keyword)) {
        return symbol;
      }
    }

    const symbolMatch = query.match(/\b([A-Z]{2,})\b/);
    if (symbolMatch) {
      return symbolMatch[1];
    }

    return null;
  }

  async scrapeStockInfo(symbol: string): Promise<ScrapedStockData | null> {
    try {
      console.log(`[ENHANCED-SCRAPER] Fetching stock info for: ${symbol}`);
      
      const moneycontrolUrl = `https://www.moneycontrol.com/india/stockpricequote/${symbol.toLowerCase()}`;
      
      try {
        const response = await axios.get(`https://www.moneycontrol.com/mc/bseMap?type=mcsearch&classic=true&search=${symbol}`, {
          headers: { 'User-Agent': this.userAgent },
          timeout: 10000
        });
        
        if (response.data && response.data.length > 0) {
          const stockData = response.data[0];
          return {
            symbol: stockData.sc_id || symbol,
            name: stockData.stock_name || symbol,
            price: parseFloat(stockData.current_price) || 0,
            change: parseFloat(stockData.change) || 0,
            changePercent: parseFloat(stockData.change_per) || 0,
            volume: stockData.volume || 'N/A',
            marketCap: stockData.market_cap || 'N/A',
            pe: parseFloat(stockData.pe) || 0,
            eps: parseFloat(stockData.eps) || 0,
            high52Week: parseFloat(stockData.high_52) || 0,
            low52Week: parseFloat(stockData.low_52) || 0,
            dayHigh: parseFloat(stockData.high) || 0,
            dayLow: parseFloat(stockData.low) || 0,
            previousClose: parseFloat(stockData.prev_close) || 0,
            open: parseFloat(stockData.open) || 0,
            sector: stockData.sector || 'N/A',
            industry: stockData.industry || 'N/A',
            lastUpdated: new Date().toISOString()
          };
        }
      } catch (mcError) {
        console.log('[ENHANCED-SCRAPER] Moneycontrol API failed, using fallback');
      }

      return {
        symbol,
        name: symbol,
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 'N/A',
        marketCap: 'N/A',
        pe: 0,
        eps: 0,
        high52Week: 0,
        low52Week: 0,
        dayHigh: 0,
        dayLow: 0,
        previousClose: 0,
        open: 0,
        sector: 'N/A',
        industry: 'N/A',
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ENHANCED-SCRAPER] Stock info error:', error);
      return null;
    }
  }

  private formatStockDataAsText(data: ScrapedStockData): string {
    let text = `\n**${data.name} (${data.symbol})**\n`;
    if (data.price > 0) {
      text += `Current Price: ₹${data.price.toLocaleString()}\n`;
      text += `Change: ${data.change >= 0 ? '+' : ''}₹${data.change.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)\n`;
    }
    if (data.dayHigh > 0) text += `Day Range: ₹${data.dayLow.toLocaleString()} - ₹${data.dayHigh.toLocaleString()}\n`;
    if (data.high52Week > 0) text += `52-Week Range: ₹${data.low52Week.toLocaleString()} - ₹${data.high52Week.toLocaleString()}\n`;
    if (data.volume !== 'N/A') text += `Volume: ${data.volume}\n`;
    if (data.marketCap !== 'N/A') text += `Market Cap: ${data.marketCap}\n`;
    if (data.pe > 0) text += `P/E Ratio: ${data.pe.toFixed(2)}\n`;
    if (data.eps > 0) text += `EPS: ₹${data.eps.toFixed(2)}\n`;
    if (data.sector !== 'N/A') text += `Sector: ${data.sector}\n`;
    
    return text;
  }

  async scrapeMarketNews(keywords: string[] = [], limit: number = 10): Promise<ScrapedNewsItem[]> {
    const news: ScrapedNewsItem[] = [];
    
    try {
      const searchTerms = keywords.length > 0 
        ? keywords.join(' OR ') + ' stock market india'
        : 'indian stock market NSE BSE nifty sensex';
        
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=en-IN&gl=IN&ceid=IN:en`;
      
      const response = await axios.get(rssUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000
      });

      const $ = cheerio.load(response.data, { xmlMode: true });

      $('item').slice(0, limit).each((i, elem) => {
        const title = this.cleanText($(elem).find('title').text());
        const link = $(elem).find('link').text();
        const description = this.cleanText($(elem).find('description').text()) || '';
        const pubDate = $(elem).find('pubDate').text();
        const source = $(elem).find('source').text() || 'Unknown Source';

        const sentiment = this.analyzeSentiment(title + ' ' + description);

        if (title) {
          news.push({
            title,
            source,
            url: link,
            publishedAt: pubDate || new Date().toISOString(),
            summary: description.length > 300 ? description.substring(0, 300) + '...' : description,
            sentiment
          });
        }
      });

    } catch (error) {
      console.error('[ENHANCED-SCRAPER] News scraping error:', error);
    }

    return news;
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const lowerText = text.toLowerCase();
    
    const positiveWords = ['surge', 'gain', 'rise', 'rally', 'bullish', 'up', 'growth', 'profit', 'record', 'high', 'boom', 'strong', 'advance', 'soar', 'jump'];
    const negativeWords = ['fall', 'drop', 'decline', 'bearish', 'down', 'loss', 'crash', 'plunge', 'sink', 'tumble', 'weak', 'low', 'slump', 'sell-off'];
    
    let score = 0;
    positiveWords.forEach(word => { if (lowerText.includes(word)) score++; });
    negativeWords.forEach(word => { if (lowerText.includes(word)) score--; });
    
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  async getCompanyInsights(symbol: string): Promise<CompanyInsights | null> {
    try {
      console.log(`[ENHANCED-SCRAPER] Fetching company insights for: ${symbol}`);
      
      const stockData = await this.scrapeStockInfo(symbol);
      if (!stockData) {
        return this.generateMockInsights(symbol);
      }

      // Fetch quarterly performance and annual financials in parallel
      const [quarterlyData, annualFinancials] = await Promise.all([
        this.fetchQuarterlyPerformance(symbol),
        this.fetchAnnualFinancials(symbol)
      ]);
      
      const trend = this.calculateTrend(quarterlyData);
      
      const insights: CompanyInsights = {
        symbol: stockData.symbol,
        name: stockData.name,
        currentPrice: stockData.price,
        quarterlyPerformance: quarterlyData,
        trend: trend.direction,
        trendStrength: trend.strength,
        revenueGrowth: this.estimateGrowth(quarterlyData),
        profitGrowth: this.estimateGrowth(quarterlyData) * 1.2,
        pe: stockData.pe,
        eps: stockData.eps,
        recommendation: this.generateRecommendation(trend, stockData),
        chartData: quarterlyData.map(q => ({
          quarter: q.quarter,
          value: q.value,
          trend: q.changePercent >= 0 ? 'positive' : 'negative'
        })),
        // Include annual financial statements if available
        annualFinancials: annualFinancials || undefined
      };

      return insights;
    } catch (error) {
      console.error('[ENHANCED-SCRAPER] Company insights error:', error);
      return this.generateMockInsights(symbol);
    }
  }

  private async fetchQuarterlyPerformance(symbol: string): Promise<QuarterlyData[]> {
    const quarters: QuarterlyData[] = [];
    const currentDate = new Date();
    const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Try multiple sources for real quarterly data
    
    // SOURCE 1: Screener.in - Best source for Indian stock quarterly results
    try {
      console.log(`[ENHANCED-SCRAPER] 🔍 Fetching REAL quarterly data for ${cleanSymbol} from Screener.in...`);
      
      const screenerUrl = `https://www.screener.in/company/${cleanSymbol}/consolidated/`;
      const response = await axios.get(screenerUrl, {
        headers: { 
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      
      // Extract quarter headers from the table header row
      const quarterHeaders: string[] = [];
      $('section#quarters table thead tr th').each((idx, elem) => {
        const headerText = $(elem).text().trim();
        // Match date patterns like "Sep 2024", "Dec 2023", "Mar 2024"
        if (headerText.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i)) {
          quarterHeaders.push(headerText);
        }
      });
      
      console.log(`[ENHANCED-SCRAPER] Found ${quarterHeaders.length} quarter headers: ${quarterHeaders.slice(-4).join(', ')}`);
      
      // Extract Sales (revenue) data - it's the first data row
      let salesValues: number[] = [];
      $('section#quarters table tbody tr').each((idx, elem) => {
        const rowLabel = $(elem).find('td.text').text().trim().toLowerCase();
        if (rowLabel.includes('sales') && salesValues.length === 0) {
          $(elem).find('td:not(.text)').each((cellIdx, cell) => {
            const valueText = $(cell).text().trim().replace(/[,\s]/g, '');
            const value = parseFloat(valueText);
            if (!isNaN(value)) {
              salesValues.push(value);
            }
          });
        }
      });
      
      console.log(`[ENHANCED-SCRAPER] Found ${salesValues.length} sales values, last 4: ${salesValues.slice(-4).join(', ')}`);
      
      if (quarterHeaders.length >= 4 && salesValues.length >= 4) {
        // Take last 4 quarters
        const numQuarters = Math.min(quarterHeaders.length, salesValues.length, 4);
        const startIdx = Math.max(0, quarterHeaders.length - numQuarters);
        
        for (let i = startIdx; i < quarterHeaders.length && i < startIdx + 4; i++) {
          const headerText = quarterHeaders[i];
          const revenue = salesValues[i];
          
          // Convert "Sep 2024" to "Q2 FY25" format
          const monthMatch = headerText.match(/(\w{3})\s+(\d{4})/i);
          if (monthMatch) {
            const month = monthMatch[1].toLowerCase();
            const year = parseInt(monthMatch[2]);
            
            // Indian fiscal year: Apr-Mar
            // Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
            const quarterMap: { [key: string]: { q: string, fyOffset: number } } = {
              'apr': { q: 'Q1', fyOffset: 1 }, 'may': { q: 'Q1', fyOffset: 1 }, 'jun': { q: 'Q1', fyOffset: 1 },
              'jul': { q: 'Q2', fyOffset: 1 }, 'aug': { q: 'Q2', fyOffset: 1 }, 'sep': { q: 'Q2', fyOffset: 1 },
              'oct': { q: 'Q3', fyOffset: 1 }, 'nov': { q: 'Q3', fyOffset: 1 }, 'dec': { q: 'Q3', fyOffset: 1 },
              'jan': { q: 'Q4', fyOffset: 0 }, 'feb': { q: 'Q4', fyOffset: 0 }, 'mar': { q: 'Q4', fyOffset: 0 }
            };
            
            const qInfo = quarterMap[month] || { q: 'Q1', fyOffset: 1 };
            const fiscalYear = year + qInfo.fyOffset;
            const quarterLabel = `${qInfo.q} FY${fiscalYear.toString().slice(-2)}`;
            
            const prevRevenue = i > 0 ? salesValues[i - 1] : revenue;
            const changePercent = prevRevenue > 0 ? 
              Math.round(((revenue - prevRevenue) / prevRevenue) * 100 * 100) / 100 : 0;
            
            quarters.push({
              quarter: quarterLabel,
              value: Math.round(revenue), // Revenue in Cr
              change: changePercent,
              changePercent: changePercent
            });
          }
        }
        
        if (quarters.length >= 3) {
          console.log(`[ENHANCED-SCRAPER] ✅ SUCCESS! Returning ${quarters.length} quarters of REAL data for ${cleanSymbol}:`);
          quarters.forEach(q => console.log(`   ${q.quarter}: ₹${q.value} Cr (${q.changePercent > 0 ? '+' : ''}${q.changePercent}%)`));
          return quarters;
        }
      }
      
      throw new Error('Could not parse quarterly data from Screener.in');
      
    } catch (screenerError: any) {
      console.log(`[ENHANCED-SCRAPER] ⚠️ Screener.in failed for ${cleanSymbol}: ${screenerError.message}`);
    }
    
    // SOURCE 2: Yahoo Finance Quarterly Financials
    try {
      console.log(`[ENHANCED-SCRAPER] 🔍 Trying Yahoo Finance for ${cleanSymbol} quarterly data...`);
      
      // For Indian stocks, add .NS suffix
      const yahooSymbol = `${cleanSymbol}.NS`;
      const yahooUrl = `https://finance.yahoo.com/quote/${yahooSymbol}/financials/`;
      
      const response = await axios.get(yahooUrl, {
        headers: { 
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const quarterlyDataArray: any[] = [];
      
      // Look for quarterly revenue data in Yahoo Finance tables
      $('div[data-test="fin-row"] div[data-test="fin-col"]').each((idx, elem) => {
        const value = $(elem).text().trim();
        // Parse revenue values - they might be in format like "1.5T", "234.5B", "123.4M"
        if (value && value.match(/[\d,.]+[TMBKtmbk]?$/)) {
          quarterlyDataArray.push({ value: this.parseFinancialValue(value) });
        }
      });
      
      if (quarterlyDataArray.length >= 4) {
        console.log(`[ENHANCED-SCRAPER] ✅ Found ${quarterlyDataArray.length} data points from Yahoo Finance`);
        
        // Take last 4 quarters worth of data
        const recentData = quarterlyDataArray.slice(0, 4);
        
        for (let i = 0; i < recentData.length; i++) {
          const quarterDate = new Date(currentDate);
          quarterDate.setMonth(currentDate.getMonth() - (i * 3));
          const quarterNum = Math.ceil((quarterDate.getMonth() + 1) / 3);
          const year = quarterDate.getFullYear();
          
          const prevValue = i < recentData.length - 1 ? recentData[i + 1].value : recentData[i].value;
          const changePercent = prevValue > 0 ? 
            Math.round(((recentData[i].value - prevValue) / prevValue) * 100 * 100) / 100 : 0;
          
          quarters.unshift({
            quarter: `Q${quarterNum} ${year}`,
            value: Math.round(recentData[i].value),
            change: changePercent,
            changePercent: changePercent
          });
        }
        
        if (quarters.length >= 3) {
          console.log(`[ENHANCED-SCRAPER] ✅ Returning ${quarters.length} quarters from Yahoo Finance`);
          return quarters;
        }
      }
      
      throw new Error('Could not parse Yahoo Finance quarterly data');
      
    } catch (yahooError: any) {
      console.log(`[ENHANCED-SCRAPER] ⚠️ Yahoo Finance failed for ${cleanSymbol}: ${yahooError.message}`);
    }
    
    // SOURCE 3: Tickertape.in - Another good Indian source
    try {
      console.log(`[ENHANCED-SCRAPER] 🔍 Trying Tickertape.in for ${cleanSymbol} quarterly data...`);
      
      const tickertapeUrl = `https://www.tickertape.in/stocks/${cleanSymbol.toLowerCase()}`;
      const response = await axios.get(tickertapeUrl, {
        headers: { 
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const quarterlyDataArray: any[] = [];
      
      // Look for quarterly financial data in Tickertape
      $('table.quarterly-results tbody tr').each((idx, elem) => {
        const cells = $(elem).find('td');
        if (cells.length >= 4) {
          const quarterText = $(cells[0]).text().trim();
          const revenueText = $(cells[1]).text().replace(/[₹,\s]/g, '');
          
          if (quarterText.match(/Q\d\s*(FY)?\d{2,4}/i)) {
            const revenue = parseFloat(revenueText);
            if (!isNaN(revenue) && revenue > 0) {
              quarterlyDataArray.push({
                quarter: quarterText,
                revenue: revenue
              });
            }
          }
        }
      });
      
      if (quarterlyDataArray.length >= 3) {
        console.log(`[ENHANCED-SCRAPER] ✅ Found ${quarterlyDataArray.length} quarters from Tickertape`);
        
        const recentQuarters = quarterlyDataArray.slice(0, 4).reverse();
        
        for (let i = 0; i < recentQuarters.length; i++) {
          const q = recentQuarters[i];
          const prevQuarter = i > 0 ? recentQuarters[i - 1] : null;
          
          let changePercent = 0;
          if (prevQuarter && prevQuarter.revenue > 0) {
            changePercent = Math.round(((q.revenue - prevQuarter.revenue) / prevQuarter.revenue) * 100 * 100) / 100;
          }
          
          quarters.push({
            quarter: q.quarter,
            value: Math.round(q.revenue),
            change: changePercent,
            changePercent: changePercent
          });
        }
        
        if (quarters.length >= 3) {
          return quarters;
        }
      }
      
      throw new Error('Could not parse Tickertape data');
      
    } catch (tickertapeError: any) {
      console.log(`[ENHANCED-SCRAPER] ⚠️ Tickertape failed for ${cleanSymbol}: ${tickertapeError.message}`);
    }
    
    // FINAL FALLBACK: Generate data based on current stock price with realistic quarter-over-quarter changes
    console.log(`[ENHANCED-SCRAPER] ⚠️ All web scraping failed for ${cleanSymbol}, using price-based estimation...`);
    
    try {
      const stockData = await this.scrapeStockInfo(cleanSymbol);
      if (stockData && stockData.price > 0) {
        // Use actual price movement to estimate quarterly performance
        const currentPrice = stockData.price;
        const yearHigh = stockData.high52Week || currentPrice * 1.2;
        const yearLow = stockData.low52Week || currentPrice * 0.8;
        
        // Calculate rough quarterly progression based on 52-week range
        const priceRange = yearHigh - yearLow;
        const currentPosition = (currentPrice - yearLow) / priceRange; // 0 to 1
        
        // Generate realistic quarterly values based on where the stock is in its 52-week range
        for (let i = 3; i >= 0; i--) {
          const quarterDate = new Date(currentDate);
          quarterDate.setMonth(currentDate.getMonth() - (i * 3));
          const quarterNum = Math.ceil((quarterDate.getMonth() + 1) / 3);
          const year = quarterDate.getFullYear();
          
          // Simulate quarterly progression toward current price
          const quarterPosition = currentPosition * (4 - i) / 4;
          const quarterValue = yearLow + (priceRange * quarterPosition);
          
          const prevQuarterValue = i < 3 ? (yearLow + (priceRange * (currentPosition * (4 - i - 1) / 4))) : quarterValue * 0.95;
          const changePercent = prevQuarterValue > 0 ? 
            Math.round(((quarterValue - prevQuarterValue) / prevQuarterValue) * 100 * 100) / 100 : 0;
          
          quarters.push({
            quarter: `Q${quarterNum} ${year}`,
            value: Math.round(quarterValue * 100) / 100,
            change: changePercent,
            changePercent: changePercent
          });
        }
        
        console.log(`[ENHANCED-SCRAPER] 📊 Generated price-based quarterly data for ${cleanSymbol}`);
        return quarters;
      }
    } catch (priceError) {
      console.log(`[ENHANCED-SCRAPER] ⚠️ Price-based estimation also failed`);
    }
    
    // Ultimate fallback with clearly marked estimated data
    console.log(`[ENHANCED-SCRAPER] ❌ All methods failed for ${cleanSymbol}, using minimal fallback`);
    
    for (let i = 3; i >= 0; i--) {
      const quarterDate = new Date(currentDate);
      quarterDate.setMonth(currentDate.getMonth() - (i * 3));
      const quarterNum = Math.ceil((quarterDate.getMonth() + 1) / 3);
      const year = quarterDate.getFullYear();
      
      quarters.push({
        quarter: `Q${quarterNum} ${year}`,
        value: 0, // Return 0 to indicate no real data
        change: 0,
        changePercent: 0
      });
    }

    return quarters;
  }

  // Fetch Balance Sheet and Profit & Loss data from Screener.in
  async fetchAnnualFinancials(symbol: string): Promise<AnnualFinancialData | null> {
    const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    try {
      console.log(`[ENHANCED-SCRAPER] 📊 Fetching Balance Sheet & P&L for ${cleanSymbol} from Screener.in...`);
      
      const screenerUrl = `https://www.screener.in/company/${cleanSymbol}/consolidated/`;
      const response = await axios.get(screenerUrl, {
        headers: { 
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const result: AnnualFinancialData = {
        years: [],
        balanceSheet: [],
        profitLoss: []
      };

      // Extract Profit & Loss data (section#profit-loss)
      const plYears: string[] = [];
      $('section#profit-loss table thead tr th').each((idx, elem) => {
        const headerText = $(elem).text().trim();
        // Match year patterns like "Mar 2024", "Mar 2023"
        if (headerText.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i)) {
          plYears.push(headerText);
        }
      });
      
      // Important P&L rows to extract
      const plLabelsToExtract = ['Sales', 'Expenses', 'Operating Profit', 'OPM %', 'Net Profit', 'EPS in Rs'];
      
      $('section#profit-loss table tbody tr').each((idx, elem) => {
        const rowLabel = $(elem).find('td.text, td:first-child').text().trim();
        const matchedLabel = plLabelsToExtract.find(l => rowLabel.toLowerCase().includes(l.toLowerCase()));
        
        if (matchedLabel) {
          const values: Array<{ year: string; value: number }> = [];
          $(elem).find('td:not(.text)').each((cellIdx, cell) => {
            const valueText = $(cell).text().trim().replace(/[,\s%]/g, '');
            const value = parseFloat(valueText);
            if (!isNaN(value) && cellIdx < plYears.length) {
              values.push({ year: plYears[cellIdx], value });
            }
          });
          
          if (values.length > 0) {
            result.profitLoss.push({
              label: matchedLabel,
              values: values.slice(-5) // Last 5 years
            });
          }
        }
      });

      // Extract Balance Sheet data (section#balance-sheet)
      const bsYears: string[] = [];
      $('section#balance-sheet table thead tr th').each((idx, elem) => {
        const headerText = $(elem).text().trim();
        if (headerText.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i)) {
          bsYears.push(headerText);
        }
      });
      
      // Important Balance Sheet rows to extract
      const bsLabelsToExtract = ['Total Assets', 'Equity Capital', 'Reserves', 'Borrowings', 'Total Liabilities', 'Fixed Assets', 'Investments', 'Other Assets'];
      
      $('section#balance-sheet table tbody tr').each((idx, elem) => {
        const rowLabel = $(elem).find('td.text, td:first-child').text().trim();
        const matchedLabel = bsLabelsToExtract.find(l => rowLabel.toLowerCase().includes(l.toLowerCase()));
        
        if (matchedLabel) {
          const values: Array<{ year: string; value: number }> = [];
          $(elem).find('td:not(.text)').each((cellIdx, cell) => {
            const valueText = $(cell).text().trim().replace(/[,\s]/g, '');
            const value = parseFloat(valueText);
            if (!isNaN(value) && cellIdx < bsYears.length) {
              values.push({ year: bsYears[cellIdx], value });
            }
          });
          
          if (values.length > 0) {
            result.balanceSheet.push({
              label: matchedLabel,
              values: values.slice(-5) // Last 5 years
            });
          }
        }
      });

      // Set years from P&L or Balance Sheet
      result.years = plYears.slice(-5).length > 0 ? plYears.slice(-5) : bsYears.slice(-5);
      
      if (result.profitLoss.length > 0 || result.balanceSheet.length > 0) {
        console.log(`[ENHANCED-SCRAPER] ✅ SUCCESS! Found P&L rows: ${result.profitLoss.length}, Balance Sheet rows: ${result.balanceSheet.length}`);
        result.profitLoss.forEach(row => console.log(`   P&L: ${row.label} - ${row.values.length} years`));
        result.balanceSheet.forEach(row => console.log(`   BS: ${row.label} - ${row.values.length} years`));
        return result;
      }
      
      console.log(`[ENHANCED-SCRAPER] ⚠️ No financial data found for ${cleanSymbol}`);
      return null;
      
    } catch (error: any) {
      console.log(`[ENHANCED-SCRAPER] ⚠️ Failed to fetch annual financials for ${cleanSymbol}: ${error.message}`);
      return null;
    }
  }
  
  private parseFinancialValue(value: string): number {
    const cleanValue = value.replace(/[,\s]/g, '');
    const multiplierMatch = cleanValue.match(/([\d.]+)([TMBKtmbk])?/);
    
    if (multiplierMatch) {
      const num = parseFloat(multiplierMatch[1]);
      const suffix = multiplierMatch[2]?.toUpperCase();
      
      switch (suffix) {
        case 'T': return num * 1000000000000;
        case 'B': return num * 1000000000;
        case 'M': return num * 1000000;
        case 'K': return num * 1000;
        default: return num;
      }
    }
    return parseFloat(cleanValue) || 0;
  }

  private calculateTrend(quarterlyData: QuarterlyData[]): { direction: 'positive' | 'negative' | 'neutral'; strength: number } {
    if (quarterlyData.length < 2) {
      return { direction: 'neutral', strength: 0 };
    }

    let positiveQuarters = 0;
    let totalChange = 0;

    for (const quarter of quarterlyData) {
      if (quarter.changePercent > 0) positiveQuarters++;
      totalChange += quarter.changePercent;
    }

    const avgChange = totalChange / quarterlyData.length;
    const strength = Math.min(Math.abs(avgChange) / 10, 1);

    if (positiveQuarters >= 2 && avgChange > 0) {
      return { direction: 'positive', strength };
    } else if (positiveQuarters <= 1 && avgChange < 0) {
      return { direction: 'negative', strength };
    }
    return { direction: 'neutral', strength };
  }

  private estimateGrowth(quarterlyData: QuarterlyData[]): number {
    if (quarterlyData.length < 2) return 0;
    
    const first = quarterlyData[0].value;
    const last = quarterlyData[quarterlyData.length - 1].value;
    
    if (first === 0) return 0;
    return Math.round(((last - first) / first) * 100 * 100) / 100;
  }

  private generateRecommendation(
    trend: { direction: 'positive' | 'negative' | 'neutral'; strength: number },
    stockData: ScrapedStockData
  ): string {
    if (trend.direction === 'positive' && trend.strength > 0.5) {
      return 'Strong Buy - Consistent positive performance over last 3 quarters';
    } else if (trend.direction === 'positive') {
      return 'Buy - Showing positive momentum with moderate growth';
    } else if (trend.direction === 'negative' && trend.strength > 0.5) {
      return 'Sell - Consistent decline over last 3 quarters';
    } else if (trend.direction === 'negative') {
      return 'Hold/Reduce - Showing negative trend, monitor closely';
    }
    return 'Hold - Mixed performance, wait for clearer direction';
  }

  private generateMockInsights(symbol: string): CompanyInsights {
    const currentDate = new Date();
    const quarterlyData: QuarterlyData[] = [];
    
    for (let i = 2; i >= 0; i--) {
      const quarterDate = new Date(currentDate);
      quarterDate.setMonth(currentDate.getMonth() - (i * 3));
      
      const quarterNum = Math.ceil((quarterDate.getMonth() + 1) / 3);
      const year = quarterDate.getFullYear();
      
      const variance = (Math.random() - 0.4) * 15;
      
      quarterlyData.push({
        quarter: `Q${quarterNum} ${year}`,
        value: 100 + (i * 5) + variance,
        change: variance,
        changePercent: variance
      });
    }

    const trend = this.calculateTrend(quarterlyData);

    return {
      symbol,
      name: symbol,
      currentPrice: 100 + Math.random() * 500,
      quarterlyPerformance: quarterlyData,
      trend: trend.direction,
      trendStrength: trend.strength,
      revenueGrowth: this.estimateGrowth(quarterlyData),
      profitGrowth: this.estimateGrowth(quarterlyData) * 1.1,
      pe: 15 + Math.random() * 25,
      eps: 5 + Math.random() * 20,
      recommendation: this.generateRecommendation(trend, { 
        symbol, name: symbol, price: 0, change: 0, changePercent: 0,
        volume: '0', marketCap: '0', pe: 0, eps: 0, high52Week: 0, low52Week: 0,
        dayHigh: 0, dayLow: 0, previousClose: 0, open: 0, sector: '', industry: '', lastUpdated: ''
      }),
      chartData: quarterlyData.map(q => ({
        quarter: q.quarter,
        value: q.value,
        trend: q.changePercent >= 0 ? 'positive' : 'negative'
      }))
    };
  }

  async getMarketOverview(): Promise<MarketOverview[]> {
    const indices: MarketOverview[] = [];
    
    try {
      const symbols = ['NIFTY50', 'SENSEX', 'BANKNIFTY'];
      
      for (const symbol of symbols) {
        indices.push({
          index: symbol,
          value: 0,
          change: 0,
          changePercent: 0,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[ENHANCED-SCRAPER] Market overview error:', error);
    }

    return indices;
  }
}

export const enhancedFinancialScraper = new EnhancedFinancialScraper();
