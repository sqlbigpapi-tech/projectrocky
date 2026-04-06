'use client';
import { useState, useEffect } from 'react';

type Company = {
  id: string;
  name: string;
  city: string;
  industry: string;
  revenue: string;
  employees: string;
  linkedin: string;
  ticker?: string;
};

type NewsArticle = { title: string; link: string; pubDate: string; source: string };
type StockQuote = { price: number; change: number; pct: number };

const INDUSTRIES = ['All', 'Financial Services', 'Real Estate', 'Healthcare', 'Technology', 'Energy', 'Retail', 'Hospitality', 'Manufacturing'] as const;
type IndustryFilter = typeof INDUSTRIES[number];

const COMPANIES: Company[] = [
  { id: 'nextera',     name: 'NextEra Energy',           city: 'Juno Beach',       industry: 'Energy',             revenue: '$20.6B',  employees: '15,000+',  linkedin: 'https://www.linkedin.com/company/nextera-energy',                          ticker: 'NEE'  },
  { id: 'publix',      name: 'Publix Super Markets',     city: 'Lakeland',         industry: 'Retail',             revenue: '$58.5B',  employees: '240,000+', linkedin: 'https://www.linkedin.com/company/publix-super-markets'                               },
  { id: 'lennar',      name: 'Lennar Corporation',       city: 'Miami',            industry: 'Real Estate',        revenue: '$34.2B',  employees: '12,000+',  linkedin: 'https://www.linkedin.com/company/lennar',                                  ticker: 'LEN'  },
  { id: 'jabil',       name: 'Jabil',                    city: 'St. Petersburg',   industry: 'Manufacturing',      revenue: '$34.7B',  employees: '260,000+', linkedin: 'https://www.linkedin.com/company/jabil',                                   ticker: 'JBL'  },
  { id: 'autonation',  name: 'AutoNation',               city: 'Fort Lauderdale',  industry: 'Retail',             revenue: '$26.1B',  employees: '25,000+',  linkedin: 'https://www.linkedin.com/company/autonation',                              ticker: 'AN'   },
  { id: 'carnival',    name: 'Carnival Corporation',     city: 'Miami',            industry: 'Hospitality',        revenue: '$21.6B',  employees: '160,000+', linkedin: 'https://www.linkedin.com/company/carnival-corporation',                    ticker: 'CCL'  },
  { id: 'raymondjames',name: 'Raymond James Financial',  city: 'St. Petersburg',   industry: 'Financial Services', revenue: '$12.0B',  employees: '15,000+',  linkedin: 'https://www.linkedin.com/company/raymond-james',                           ticker: 'RJF'  },
  { id: 'darden',      name: 'Darden Restaurants',       city: 'Orlando',          industry: 'Hospitality',        revenue: '$11.4B',  employees: '195,000+', linkedin: 'https://www.linkedin.com/company/darden-restaurants',                      ticker: 'DRI'  },
  { id: 'fidelitynat', name: 'Fidelity National Info.',  city: 'Jacksonville',     industry: 'Financial Services', revenue: '$14.1B',  employees: '55,000+',  linkedin: 'https://www.linkedin.com/company/fidelity-national-information-services', ticker: 'FIS'  },
  { id: 'fnf',         name: 'Fidelity National Fin.',   city: 'Jacksonville',     industry: 'Financial Services', revenue: '$10.7B',  employees: '23,000+',  linkedin: 'https://www.linkedin.com/company/fidelity-national-financial',            ticker: 'FNF'  },
  { id: 'hca',         name: 'HCA Healthcare (FL Div.)', city: 'Tampa',            industry: 'Healthcare',         revenue: '$9.2B',   employees: '50,000+',  linkedin: 'https://www.linkedin.com/company/hca-healthcare',                          ticker: 'HCA'  },
  { id: 'roper',       name: 'Roper Technologies',       city: 'Sarasota',         industry: 'Technology',         revenue: '$5.8B',   employees: '27,000+',  linkedin: 'https://www.linkedin.com/company/roper-technologies',                      ticker: 'ROP'  },
  { id: 'adt',         name: 'ADT',                      city: 'Boca Raton',       industry: 'Technology',         revenue: '$4.9B',   employees: '20,000+',  linkedin: 'https://www.linkedin.com/company/adt-security-services',                   ticker: 'ADT'  },
  { id: 'healthfirst', name: 'Florida Blue',             city: 'Jacksonville',     industry: 'Healthcare',         revenue: '$11.0B',  employees: '13,000+',  linkedin: 'https://www.linkedin.com/company/florida-blue'                                      },
  { id: 'citrix',      name: 'Cloud Software Group',     city: 'Fort Lauderdale',  industry: 'Technology',         revenue: '$3.5B',   employees: '10,000+',  linkedin: 'https://www.linkedin.com/company/cloud-software-group'                              },
  { id: 'wellcare',    name: 'WellCare Health Plans',    city: 'Tampa',            industry: 'Healthcare',         revenue: '$8.0B',   employees: '12,000+',  linkedin: 'https://www.linkedin.com/company/wellcare-health-plans'                             },
  { id: 'bankoffl',    name: 'BankUnited',               city: 'Miami Lakes',      industry: 'Financial Services', revenue: '$1.2B',   employees: '1,700+',   linkedin: 'https://www.linkedin.com/company/bankunited',                              ticker: 'BKU'  },
  { id: 'synnex',      name: 'TD SYNNEX',                city: 'Clearwater',       industry: 'Technology',         revenue: '$57.6B',  employees: '23,000+',  linkedin: 'https://www.linkedin.com/company/td-synnex',                               ticker: 'SNX'  },
  { id: 'hertz',       name: 'Hertz Global Holdings',    city: 'Estero',           industry: 'Retail',             revenue: '$9.7B',   employees: '30,000+',  linkedin: 'https://www.linkedin.com/company/hertz',                                   ticker: 'HTZ'  },
  { id: 'watsco',      name: 'Watsco',                   city: 'Miami',            industry: 'Manufacturing',      revenue: '$6.9B',   employees: '6,200+',   linkedin: 'https://www.linkedin.com/company/watsco',                                  ticker: 'WSO'  },
];

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

function CompanyCard({ company, quote }: { company: Company; quote?: StockQuote }) {
  const [newsOpen, setNewsOpen] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsFetched, setNewsFetched] = useState(false);

  function toggleNews() {
    if (!newsOpen && !newsFetched) {
      setNewsLoading(true);
      fetch(`/api/company-news?company=${encodeURIComponent(company.name)}`)
        .then(r => r.json())
        .then(d => { setNews(d.articles ?? []); setNewsFetched(true); })
        .catch(() => setNewsFetched(true))
        .finally(() => setNewsLoading(false));
    }
    setNewsOpen(o => !o);
  }

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 hover:border-zinc-700 flex flex-col transition-colors">
      <div className="p-5 flex flex-col gap-3">
        {/* Name + city */}
        <div>
          <a href={company.linkedin} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold text-white leading-snug hover:text-amber-400 transition-colors">
            {company.name}
          </a>
          <p className="text-xs text-zinc-500 mt-0.5">{company.city}, FL</p>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md font-mono">
            {company.industry}
          </span>
          <span className="text-xs text-amber-400 font-bold font-mono">{company.revenue}</span>
          <span className="text-xs text-zinc-600 font-mono">{company.employees} emp.</span>
          {company.ticker && (
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {quote ? (
                <>
                  <span className="text-xs font-mono text-zinc-500">{company.ticker}</span>
                  <span className="text-xs font-bold font-mono text-white tabular-nums">${quote.price.toFixed(2)}</span>
                  <span className={`text-xs font-mono tabular-nums ${quote.pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {quote.pct >= 0 ? '+' : ''}{quote.pct.toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-xs font-mono text-zinc-700">{company.ticker}</span>
              )}
            </div>
          )}
        </div>

        {/* News toggle */}
        <button
          onClick={toggleNews}
          className="flex items-center justify-between w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors pt-1 border-t border-zinc-800/60"
        >
          <span className="font-mono uppercase tracking-widest">Recent News</span>
          <span className="text-zinc-600">{newsOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {newsOpen && (
        <div className="border-t border-zinc-800/60 px-5 pb-4 pt-3">
          {newsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-4 bg-zinc-900 rounded animate-pulse" />)}
            </div>
          ) : news.length === 0 ? (
            <p className="text-xs text-zinc-600 font-mono">No recent news found.</p>
          ) : (
            <div className="space-y-3">
              {news.map((article, i) => (
                <a key={i} href={article.link} target="_blank" rel="noopener noreferrer" className="group block">
                  <p className="text-xs text-zinc-300 group-hover:text-white leading-snug transition-colors line-clamp-2">
                    {article.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {article.source && <span className="text-xs text-zinc-600 font-mono">{article.source}</span>}
                    {article.pubDate && <span className="text-xs text-zinc-700 font-mono">{timeAgo(article.pubDate)}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BDTargetsTab() {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [industryFilter, setIndustryFilter] = useState<IndustryFilter>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const tickers = COMPANIES.filter(c => c.ticker).map(c => c.ticker).join(',');
    fetch(`/api/stock-quote?symbols=${tickers}`)
      .then(r => r.json())
      .then(d => setQuotes(d.quotes ?? {}))
      .catch(() => {});
  }, []);

  const filtered = COMPANIES.filter(c => {
    if (industryFilter !== 'All' && c.industry !== industryFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">BD Targets</h2>
        <p className="text-xs text-zinc-500 mt-0.5 font-mono">Florida top companies · research & intel</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search companies…"
          className="bg-zinc-950 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition w-48"
        />
        <div className="flex gap-1.5 flex-wrap">
          {INDUSTRIES.map(ind => (
            <button key={ind} onClick={() => setIndustryFilter(ind)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                industryFilter === ind
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-white hover:border-zinc-600'
              }`}>
              {ind}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500 text-sm">
          No companies match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CompanyCard key={c.id} company={c} quote={c.ticker ? quotes[c.ticker] : undefined} />
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-700 font-mono mt-6 text-center">{COMPANIES.length} companies · click Recent News for intel</p>
    </div>
  );
}
