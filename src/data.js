/** @typedef {'stock'|'etf'} InstrumentType */
/** @typedef {'CHF'|'EUR'|'USD'|'GBP'} Currency */
/** @typedef {{ticker:string,name:string,type:InstrumentType,market:string,currency:Currency,icon:string,iconClass:string,price:number,change1d:number,chfReturn:number,high:number,rollingDecline:number,dividend?:{status:string,exDate:string,payDate:string,amount:number,yield:number}}} Instrument */

/** Curated MVP universe used by the development fixture provider. */
export const instruments = /** @type {Instrument[]} */ ([
  {ticker:'CHSPI',name:'Swiss Performance ETF',type:'etf',market:'Switzerland',currency:'CHF',icon:'🇨🇭',iconClass:'swiss-icon',price:126.84,change1d:0.84,chfReturn:7.42,high:142.11,rollingDecline:1.3,dividend:{status:'Declared',exDate:'15 Sep 2026',payDate:'17 Sep 2026',amount:.28,yield:2.8}},
  {ticker:'CSSMI',name:'Swiss SMI ETF',type:'etf',market:'Switzerland',currency:'CHF',icon:'🇨🇭',iconClass:'swiss-icon',price:118.21,change1d:-.32,chfReturn:4.18,high:132.86,rollingDecline:5.8,dividend:{status:'Upcoming',exDate:'03 Oct 2026',payDate:'07 Oct 2026',amount:.74,yield:3.1}},
  {ticker:'CHSPIH',name:'SPI® CHF Hedged',type:'etf',market:'Switzerland',currency:'CHF',icon:'🇨🇭',iconClass:'swiss-icon',price:98.44,change1d:1.14,chfReturn:9.8,high:111.93,rollingDecline:2.1,dividend:{status:'Paid',exDate:'21 Aug 2026',payDate:'25 Aug 2026',amount:.39,yield:2.4}},
  {ticker:'IWCH',name:'iShares MSCI World CHF Hdg',type:'etf',market:'Worldwide',currency:'CHF',icon:'🌍',iconClass:'world-icon',price:84.72,change1d:1.76,chfReturn:12.62,high:101.34,rollingDecline:4.4,dividend:{status:'Upcoming',exDate:'12 Dec 2026',payDate:'17 Dec 2026',amount:.21,yield:1.8}},
  {ticker:'VWRL',name:'Vanguard FTSE All-World',type:'etf',market:'Worldwide',currency:'USD',icon:'🌍',iconClass:'world-icon',price:129.32,change1d:1.22,chfReturn:8.31,high:151.4,rollingDecline:5.2,dividend:{status:'Declared',exDate:'18 Sep 2026',payDate:'30 Sep 2026',amount:.82,yield:2.1}},
  {ticker:'SMH',name:'VanEck Semiconductor',type:'etf',market:'Worldwide',currency:'USD',icon:'◈',iconClass:'purple-icon',price:261.03,change1d:-2.64,chfReturn:-6.1,high:318.12,rollingDecline:7.1},
  {ticker:'NOVN',name:'Novartis AG',type:'stock',market:'Switzerland',currency:'CHF',icon:'N',iconClass:'blue-icon',price:102.18,change1d:.42,chfReturn:3.7,high:108.51,rollingDecline:1.4},
  {ticker:'NESN',name:'Nestlé SA',type:'stock',market:'Switzerland',currency:'CHF',icon:'N',iconClass:'red-icon',price:78.64,change1d:-.86,chfReturn:-3.2,high:108.42,rollingDecline:6.4},
  {ticker:'SAP',name:'SAP SE',type:'stock',market:'Europe',currency:'EUR',icon:'S',iconClass:'blue-icon',price:241.6,change1d:1.16,chfReturn:11.2,high:283.4,rollingDecline:4.1},
  {ticker:'ASML',name:'ASML Holding',type:'stock',market:'Europe',currency:'EUR',icon:'A',iconClass:'orange-icon',price:682.2,change1d:-1.28,chfReturn:-9.3,high:1021.5,rollingDecline:8.2},
  {ticker:'AAPL',name:'Apple Inc.',type:'stock',market:'Worldwide',currency:'USD',icon:'●',iconClass:'dark-icon',price:234.91,change1d:.66,chfReturn:6.8,high:260.1,rollingDecline:3.2},
  {ticker:'MSFT',name:'Microsoft Corp.',type:'stock',market:'Worldwide',currency:'USD',icon:'⊞',iconClass:'blue-icon',price:511.04,change1d:1.44,chfReturn:14.8,high:555.2,rollingDecline:2.4}
]);

export const mockProvider = {
  async getInstruments() { return instruments; },
  async getQuotes() { return instruments.map(({ticker,price,change1d}) => ({ticker,price,change1d})); }
};

/** Browser boundary: the EODHD token is only used by the server-side API routes. */
export const provider = {
  async getInstruments() {
    const response = await fetch('/api/instruments');
    if (!response.ok) throw new Error((await response.json()).error || 'Market data is unavailable.');
    return response.json();
  }
};
