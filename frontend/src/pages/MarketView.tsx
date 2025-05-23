import React, { useState, useEffect, useRef } from 'react';
import KLineChart from '../components/KLineChart';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import Toast from '../components/Toast';
import Layout from '../components/layout/Layout';
import ReactMarkdown from 'react-markdown';
import Signallet from '../components/Signallet';
import { Select } from 'antd';

interface MarketData {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  openInterest: number;
  settlement: number;
}

interface SRLevel {
  price: number;
  type: 'Support' | 'Resistance';
  strength: number;
  start_time: string;
  break_time: string | null;
  retest_times: string[];
  timeframe: string;
}

interface Contract {
  symbol: string;
  name: string;
  is_main: boolean;
}

const SkeletonCard = () => (
  <div className="bg-gray-50 p-4 rounded-lg animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
    <div className="h-8 bg-gray-200 rounded w-24"></div>
  </div>
);

const NumberTransition: React.FC<{
  value: number;
  precision?: number;
  prefix?: string;
  className?: string;
}> = ({ value, precision = 2, prefix = '', className = '' }) => {
  return (
    <span className={`transition-all duration-300 ease-out ${className}`}>
      {prefix}{value.toFixed(precision)}
    </span>
  );
};

const MarketView: React.FC = () => {
  const [strategy, setStrategy] = useState<string>('');
  const [streamingStrategy, setStreamingStrategy] = useState<string>('');
  const chartRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [marketData, setMarketData] = useState<MarketData>({
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    turnover: 0,
    openInterest: 0,
    settlement: 0
  });
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [srLevels, setSRLevels] = useState<SRLevel[]>([]);

  // 获取合约列表
  const fetchContracts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/market/futures/contracts/list`);
      // 按合约代码排序
      const sortedContracts = response.data.sort((a: Contract, b: Contract) => a.symbol.localeCompare(b.symbol));
      setContracts(sortedContracts);
      // 默认选择主力合约
      const mainContract = sortedContracts.find((c: Contract) => c.is_main);
      if (mainContract) {
        setSelectedContract(mainContract.symbol);
      } else if (sortedContracts.length > 0) {
        // 如果没有标记主力合约，选择第一个合约
        setSelectedContract(sortedContracts[0].symbol);
      }
    } catch (error) {
      console.error('获取合约列表失败:', error);
      setToast({
        message: '获取合约列表失败',
        type: 'error'
      });
    }
  };

  // 获取操盘策略
  const fetchStrategy = async () => {
    if (!selectedContract) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/market/strategy/${selectedContract}`);
      setStrategy(response.data.strategy);
    } catch (error) {
      console.error('获取操盘策略失败:', error);
      setToast({
        message: '获取操盘策略失败',
        type: 'error'
      });
    }
  };

  // 获取支撑阻力位数据
  const fetchSRLevels = async () => {
    if (!selectedContract) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/market/kline/30`, {
        params: { contract: selectedContract }
      });
      setSRLevels(response.data.sr_levels);
    } catch (error) {
      console.error('获取支撑阻力位数据失败:', error);
      setToast({
        message: '获取支撑阻力位数据失败',
        type: 'error'
      });
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  // 当合约变化时获取策略和支撑阻力位数据
  useEffect(() => {
    if (selectedContract) {
      fetchStrategy();
      fetchSRLevels();
    }
  }, [selectedContract]);

  // 获取实时行情数据
  const fetchMarketData = async () => {
    if (!selectedContract) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/market/realtime?contract=${selectedContract}`);
      setMarketData(response.data);
    } catch (error) {
      console.error('获取行情数据失败:', error);
      setToast({
        message: '获取行情数据失败',
        type: 'error'
      });
    }
  };

  useEffect(() => {
    // 只有在有选中合约时才开始轮询
    if (selectedContract) {
      // 初始加载数据
      fetchMarketData();

      // 判断当前是否为交易时间
      const isTradeTime = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // 判断是否为工作日
        const day = now.getDay();
        if (day === 0 || day === 6) { // 0是周日，6是周六
          return false;
        }
        
        // 上午9:00-11:30
        if ((hours === 9 && minutes >= 0) || 
            (hours === 10) || 
            (hours === 11 && minutes <= 30)) {
          return true;
        }
        
        // 下午13:30-15:00
        if ((hours === 13 && minutes >= 30) || 
            (hours === 14)) {
          return true;
        }
        
        // 晚上21:00-23:00
        if ((hours === 21) || 
            (hours === 22)) {
          return true;
        }
        
        return false;
      };

      // 只在交易时间内每3秒刷新一次数据
      const timer = setInterval(() => {
        if (isTradeTime()) {
          fetchMarketData();
        }
      }, 3000);

      return () => {
        clearInterval(timer);
      };
    }
  }, [selectedContract]);

  // 清理函数
  const cleanupEventSource = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanupEventSource();
    };
  }, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            操盘
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            豆粕期货主力合约行情监控，提供K线图表与支撑阻力位分析
          </p>
        </div>

        <div className="flex">
          <div className="flex-1">
            <div className="mb-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">最新价</p>
                  <p className={`text-2xl font-bold ${marketData.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ¥{marketData.price.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">涨跌幅</p>
                  <p className={`text-2xl font-bold ${marketData.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {marketData.changePercent.toFixed(2)}%
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">成交量</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {marketData.volume.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">持仓量</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {marketData.openInterest.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">豆粕期货行情</h2>
                <Select
                  value={selectedContract}
                  onChange={setSelectedContract}
                  style={{ width: 120 }}
                  options={contracts.map(contract => ({
                    value: contract.symbol,
                    label: contract.name
                  }))}
                />
              </div>
              <div>
                <KLineChart ref={chartRef} contract={selectedContract} />
              </div>
            </div>

            <div className="bg-white rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">操盘策略（by DeepSeek）</h2>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-150 ease-in-out mb-4"
                  onClick={async () => {
                    try {
                      setStreamingStrategy('');
                      setStrategy('');
                      
                      cleanupEventSource();

                      const chartInstance = chartRef.current?.getEchartsInstance();
                      const option = chartInstance?.getOption();
                      const markLines = option?.series[0]?.markLine?.data || [];
                      
                      const sr_levels = markLines.map((line: any) => ({
                        price: Number(line[0].coord[1]),
                        type: line[0].name === 'Support' ? 'Support' : 'Resistance',
                        strength: Number(line[0].lineStyle.width),
                        start_time: option.xAxis[0].data[line[0].coord[0]],
                        break_time: line[1].coord ? option.xAxis[0].data[line[1].coord[0]] : null,
                        retest_times: [],
                        timeframe: '30m'
                      }));

                      const response = await fetch(`${API_BASE_URL}/market/strategy`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Accept': 'text/event-stream',
                        },
                        body: JSON.stringify({ 
                          contract: selectedContract,
                          sr_levels 
                        }),
                      });

                      if (!response.ok) {
                        throw new Error('Strategy request failed');
                      }

                      const reader = response.body?.getReader();
                      const decoder = new TextDecoder();

                      if (!reader) {
                        throw new Error('Failed to create stream reader');
                      }

                      let fullStrategy = '';
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                          break;
                        }

                        const text = decoder.decode(value);
                        const lines = text.split('\n');
                        
                        for (const line of lines) {
                          if (line.startsWith('data: ')) {
                            try {
                              const data = JSON.parse(line.slice(6));
                              if (data.type === 'content') {
                                fullStrategy += data.content;
                                setStreamingStrategy(fullStrategy);
                              } else if (data.type === 'done') {
                                setStrategy(fullStrategy);
                                reader.cancel();
                                break;
                              }
                            } catch (error) {
                              console.error('Error parsing SSE data:', error);
                            }
                          }
                        }
                      }
                    } catch (error) {
                      console.error('获取策略失败:', error);
                      setToast({
                        message: '获取策略失败，请稍后重试',
                        type: 'error'
                      });
                    }
                  }}
                >
                  立即获取
                </button>
              </div>
              {(streamingStrategy || strategy) && (
                <div className="prose max-w-none bg-gray-50 p-6 rounded-lg">
                  <style>{`
                    .prose h1 {
                      font-size: 1.5rem;
                      font-weight: 600;
                      margin-top: 1.5rem;
                      margin-bottom: 1rem;
                      color: #1a202c;
                    }
                    .prose h2 {
                      font-size: 1.25rem;
                      font-weight: 600;
                      margin-top: 1.25rem;
                      margin-bottom: 0.75rem;
                      color: #2d3748;
                    }
                    .prose h3 {
                      font-size: 1.125rem;
                      font-weight: 600;
                      margin-top: 1rem;
                      margin-bottom: 0.5rem;
                      color: #4a5568;
                    }
                    .prose p {
                      margin-top: 0.75rem;
                      margin-bottom: 0.75rem;
                      line-height: 1.75;
                      color: #4a5568;
                    }
                    .prose ul {
                      margin-top: 0.75rem;
                      margin-bottom: 0.75rem;
                      padding-left: 1.5rem;
                      list-style-type: disc;
                    }
                    .prose ol {
                      margin-top: 0.75rem;
                      margin-bottom: 0.75rem;
                      padding-left: 1.5rem;
                      list-style-type: decimal;
                    }
                    .prose li {
                      margin-top: 0.25rem;
                      margin-bottom: 0.25rem;
                      color: #4a5568;
                    }
                    .prose strong {
                      font-weight: 600;
                      color: #2d3748;
                    }
                    .prose em {
                      font-style: italic;
                      color: #4a5568;
                    }
                    .prose code {
                      background-color: #edf2f7;
                      padding: 0.2rem 0.4rem;
                      border-radius: 0.25rem;
                      font-family: monospace;
                      font-size: 0.875rem;
                      color: #2d3748;
                    }
                    .prose pre {
                      background-color: #2d3748;
                      color: #e2e8f0;
                      padding: 1rem;
                      border-radius: 0.5rem;
                      overflow-x: auto;
                      margin-top: 1rem;
                      margin-bottom: 1rem;
                    }
                    .prose pre code {
                      background-color: transparent;
                      padding: 0;
                      color: inherit;
                    }
                    .prose blockquote {
                      border-left: 4px solid #e2e8f0;
                      padding-left: 1rem;
                      margin-left: 0;
                      margin-right: 0;
                      font-style: italic;
                      color: #4a5568;
                    }
                    .prose hr {
                      border: 0;
                      border-top: 1px solid #e2e8f0;
                      margin-top: 2rem;
                      margin-bottom: 2rem;
                    }
                    .prose table {
                      width: 100%;
                      border-collapse: collapse;
                      margin-top: 1rem;
                      margin-bottom: 1rem;
                    }
                    .prose th {
                      background-color: #edf2f7;
                      padding: 0.75rem;
                      text-align: left;
                      font-weight: 600;
                      color: #2d3748;
                      border: 1px solid #e2e8f0;
                    }
                    .prose td {
                      padding: 0.75rem;
                      border: 1px solid #e2e8f0;
                      color: #4a5568;
                    }
                  `}</style>
                  <ReactMarkdown>{streamingStrategy || strategy}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
          
          <div className="fixed top-32 right-8">
            <Signallet srLevels={srLevels} selectedContract={selectedContract} />
          </div>
        </div>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </Layout>
  );
};

export default MarketView; 