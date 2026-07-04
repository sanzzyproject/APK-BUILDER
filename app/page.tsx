'use client';
import { useState, useRef, useEffect } from 'react';
import { Terminal, Github, Smartphone, ArrowRight, ArrowLeft, Play, CheckCircle2, CircleDashed, Link as LinkIcon, FileCode, Check, Upload, History, Sun, Moon, Globe, Search, MoreVertical, Plus, Download, X, Edit2, Settings } from 'lucide-react';
import Image from 'next/image';
import { addAppHistory, getAppHistory, updateAppHistory, AppHistory, saveSetting, getSetting } from '@/lib/db';

const NinjaBLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 200 200" className={className}>
    <path d="M 65 85 L 100 50 H 140 C 180 50, 180 95, 150 100 C 180 105, 180 150, 140 150 H 75 L 110 115 V 85 Z" fill="currentColor" />
    <path d="M 40 85 H 125 C 145 85, 145 115, 125 115 H 40 Z" fill="black" />
    <circle cx="90" cy="100" r="9" fill="currentColor" />
    <circle cx="120" cy="100" r="9" fill="currentColor" />
  </svg>
);

export default function BuilderApp() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [step, setStep] = useState(1);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  // App Edit State
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editAppName, setEditAppName] = useState('');
  const [editIconBase64, setEditIconBase64] = useState('');
  
  // App Form State
  const [appName, setAppName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [url, setUrl] = useState('');
  const [iconBase64, setIconBase64] = useState('');
  
  // GitHub Form State
  const [githubUsername, setGithubUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [repoName, setRepoName] = useState('');
  
  // Build State
  const [logs, setLogs] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildDone, setBuildDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [history, setHistory] = useState<AppHistory[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    getAppHistory().then(setHistory);
    
    // Load settings
    getSetting('githubUsername').then(val => { if (val) setGithubUsername(val) });
    getSetting('githubToken').then(val => { if (val) setGithubToken(val) });
    
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
    }
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#000000';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8f9fa';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditIconBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditApp = async (id: string) => {
    try {
      await updateAppHistory(id, { appName: editAppName, iconBase64: editIconBase64 });
      setEditingAppId(null);
      getAppHistory().then(setHistory);
    } catch(err) {
      console.error(err);
    }
  };

  const filteredHistory = history.filter(app => app.appName.toLowerCase().includes(searchQuery.toLowerCase()) || app.repoName.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleBuild = async () => {
    setIsBuilding(true);
    setStep(3);
    setLogs(['> Initializing Build Environment...']);
    setBuildDone(false);
    
    try {
        const response = await fetch('/api/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appName: appName || 'My Awesome App',
                packageName: packageName || 'com.my.app',
                url: url || 'https://example.com',
                githubUsername,
                githubToken,
                repoName: repoName || 'my-apk-repo',
                iconBase64
            })
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const parsed = JSON.parse(line.slice(6));
                        if (parsed.message) {
                            setLogs(prev => [...prev, parsed.message]);
                        }
                        if (parsed.done) {
                            setBuildDone(true);
                            setIsBuilding(false);
                            if (parsed.downloadUrl) {
                                setDownloadUrl(parsed.downloadUrl);
                                const newApp: AppHistory = {
                                  id: Date.now().toString(),
                                  appName: appName || 'My Awesome App',
                                  packageName: packageName || 'com.my.app',
                                  repoName: repoName || 'my-apk-repo',
                                  downloadUrl: parsed.downloadUrl,
                                  createdAt: Date.now(),
                                  iconBase64
                                };
                                addAppHistory(newApp).then(() => {
                                  getAppHistory().then(setHistory);
                                });
                                // Automatically trigger download
                                window.location.href = parsed.downloadUrl;
                            }
                        }
                        if (parsed.error) {
                            setIsBuilding(false);
                        }
                    } catch(e) {}
                }
            }
        }
    } catch(err: any) {
        setLogs(prev => [...prev, `ERROR: ${err.message}`]);
        setIsBuilding(false);
    }
  };

  if (showBuilder) {
    return (
      <main className={`min-h-screen ${theme === 'dark' ? 'bg-[#000000] text-white' : 'bg-[#fafafa] text-black'} font-sans p-4 md:p-8 transition-colors duration-300`}>
          <div className="max-w-4xl mx-auto pt-4 md:pt-8">
              {/* Header */}
              <div className="mb-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setShowBuilder(false)} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-[#111] text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-black'}`}>
                         <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div>
                          <h1 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Create New App</h1>
                          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Transform your web project into a native Android app.</p>
                      </div>
                  </div>
              </div>

              {/* Layout splits into two cols on md */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Left Sidebar Steps */}
                  <div className="md:col-span-1 space-y-8 relative hidden md:block mt-2">
                      <div className={`absolute top-0 bottom-0 left-3.5 w-px ${theme === 'dark' ? 'bg-[#222]' : 'bg-gray-200'} -z-10`} />
                      {[
                        { num: 1, label: 'App Details', desc: 'Configure application metadata' },
                        { num: 2, label: 'GitHub Setup', desc: 'Connect to GitHub Actions' },
                        { num: 3, label: 'Build Process', desc: 'Compile and download APK' }
                      ].map(s => (
                          <div key={s.num} className={`flex items-start gap-4 ${step > s.num ? 'opacity-50' : step < s.num ? 'opacity-40' : 'opacity-100'} transition-opacity`}>
                              <div className={`w-7 h-7 shrink-0 mt-0.5 rounded-full flex items-center justify-center text-xs font-medium border ${step >= s.num ? (theme === 'dark' ? 'bg-white text-black border-white' : 'bg-black text-white border-black') : (theme === 'dark' ? 'bg-[#000] text-gray-500 border-[#333]' : 'bg-[#fafafa] text-gray-400 border-gray-200')} transition-colors`}>
                                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                              </div>
                              <div>
                                  <div className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{s.label}</div>
                                  <div className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{s.desc}</div>
                              </div>
                          </div>
                      ))}
                  </div>

                  {/* Main Content Area */}
                  <div className={`md:col-span-2 rounded-2xl border ${theme === 'dark' ? 'bg-[#0a0a0a] border-[#222]' : 'bg-white border-gray-200'} shadow-sm overflow-hidden flex flex-col`}>
                      <div className="p-6 md:p-8 flex-1">
                          {step === 1 && (
                              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                  <div>
                                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>App Name</label>
                                      <input 
                                          type="text" 
                                          className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
                                          placeholder="My Awesome App"
                                          value={appName}
                                          onChange={(e) => setAppName(e.target.value)}
                                      />
                                  </div>
                                  <div>
                                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Package Name</label>
                                      <input 
                                          type="text" 
                                          className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
                                          placeholder="com.my.app"
                                          value={packageName}
                                          onChange={(e) => setPackageName(e.target.value)}
                                      />
                                  </div>
                                  <div>
                                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>App Icon (Optional)</label>
                                      <div className="flex items-center gap-4">
                                          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0 ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                                              {iconBase64 ? (
                                                  <img src={iconBase64} alt="Icon Preview" className="w-full h-full object-cover" />
                                              ) : (
                                                  <Smartphone className={`w-6 h-6 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                                              )}
                                          </div>
                                          <div className="flex-1">
                                              <label className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-xl cursor-pointer transition-colors ${theme === 'dark' ? 'bg-[#111] border-[#333] text-gray-300 hover:bg-[#222]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                                  <Upload className="w-4 h-4" /> Upload Icon
                                                  <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} />
                                              </label>
                                              <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>PNG or JPG, will be converted to Android icon.</p>
                                          </div>
                                      </div>
                                  </div>
                                  <div>
                                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Target URL</label>
                                      <input 
                                          type="url" 
                                          className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
                                          placeholder="https://your-website.com"
                                          value={url}
                                          onChange={(e) => setUrl(e.target.value)}
                                      />
                                      <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>The app will open this URL in a WebView.</p>
                                  </div>
                              </div>
                          )}
                          
                          {step === 2 && (
                              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                  <div>
                                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>GitHub Username</label>
                                      <div className="relative">
                                          <Github className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                                          <input 
                                              type="text" 
                                              className={`w-full pl-11 pr-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
                                              placeholder="octocat"
                                              value={githubUsername}
                                              onChange={(e) => setGithubUsername(e.target.value)}
                                          />
                                      </div>
                                  </div>
                                  <div>
                                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Personal Access Token</label>
                                      <input 
                                          type="password" 
                                          className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
                                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                          value={githubToken}
                                          onChange={(e) => setGithubToken(e.target.value)}
                                      />
                                      <div className={`p-4 rounded-xl border mt-3 flex items-start gap-3 ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-100'}`}>
                                          <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                          <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                              Requires <span className={`font-semibold px-1 py-0.5 rounded ${theme === 'dark' ? 'bg-[#222] text-gray-300' : 'bg-gray-200 text-black'}`}>repo</span> and <span className={`font-semibold px-1 py-0.5 rounded ${theme === 'dark' ? 'bg-[#222] text-gray-300' : 'bg-gray-200 text-black'}`}>workflow</span> permissions. Token is sent directly to GitHub API.
                                          </p>
                                      </div>
                                  </div>
                                  <div>
                                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Repository Name</label>
                                      <input 
                                          type="text" 
                                          className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
                                          placeholder="my-apk-repo"
                                          value={repoName}
                                          onChange={(e) => setRepoName(e.target.value)}
                                      />
                                      <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>A new private repository will be created if it doesn't exist.</p>
                                  </div>
                              </div>
                          )}

                          {step === 3 && (
                              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                  <div className="bg-[#0a0a0a] rounded-2xl p-5 font-mono text-[12px] h-80 overflow-y-auto text-gray-300 shadow-inner border border-[#222]">
                                      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#222] sticky top-0 bg-[#0a0a0a] z-10">
                                          <div className="flex gap-1.5">
                                              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                                              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                                              <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                                          </div>
                                          <span className="font-medium text-gray-500 tracking-wider text-[10px] uppercase flex items-center gap-2 ml-2">
                                              <Terminal className="w-3 h-3" /> TERMINAL
                                          </span>
                                      </div>
                                      
                                      <div className="space-y-2 pb-4">
                                          {logs.map((log, i) => (
                                              <div key={i} className={`flex gap-3 leading-relaxed ${log.includes('ERROR') ? 'text-red-400' : log.includes('✓') ? 'text-green-400' : log.includes('>') ? 'text-blue-300' : 'text-gray-300'}`}>
                                                  <span className="text-gray-600 select-none font-bold shrink-0">›</span> <span className="break-words">{log}</span>
                                              </div>
                                          ))}
                                          {isBuilding && (
                                              <div className="flex items-center gap-3 text-gray-400 mt-4 py-1">
                                                  <span className="text-gray-600 font-bold">›</span> <CircleDashed className="w-4 h-4 animate-spin" /> <span className="animate-pulse">Processing...</span>
                                              </div>
                                          )}
                                          <div ref={logsEndRef} />
                                      </div>
                                  </div>
                                  
                                  {buildDone && (
                                      <div className={`p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-in fade-in slide-in-from-bottom-2 ${theme === 'dark' ? 'bg-[#002f1a] border border-[#004f2d]' : 'bg-green-50 border border-green-100'}`}>
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-[#004f2d]' : 'bg-green-100'}`}>
                                              <CheckCircle2 className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                                          </div>
                                          <div className="flex-1">
                                              <h4 className={`font-semibold ${theme === 'dark' ? 'text-green-400' : 'text-green-900'}`}>Process Complete</h4>
                                              <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-green-500' : 'text-green-700'}`}>
                                                  {downloadUrl ? 'APK successfully built and ready for download.' : 'Repository configured. Please check your GitHub Actions.'}
                                              </p>
                                          </div>
                                          
                                          {downloadUrl ? (
                                            <a 
                                              href={downloadUrl}
                                              className={`inline-flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap w-full sm:w-auto mt-2 sm:mt-0 shadow-sm ${theme === 'dark' ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                            >
                                                Download APK <Download className="w-4 h-4" />
                                            </a>
                                          ) : (
                                            <a 
                                              href={`https://github.com/${githubUsername}/${repoName}/actions`}
                                              target="_blank"
                                              rel="noreferrer"
                                              className={`inline-flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap w-full sm:w-auto mt-2 sm:mt-0 shadow-sm ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-black'}`}
                                            >
                                                View Actions <ArrowRight className="w-4 h-4" />
                                            </a>
                                          )}
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                      
                      {/* Footer Actions */}
                      <div className={`p-4 md:px-8 border-t flex justify-between items-center bg-transparent ${theme === 'dark' ? 'border-[#222]' : 'border-gray-200'}`}>
                          {step > 1 && step < 3 ? (
                              <button 
                                  onClick={() => setStep(step - 1)}
                                  className={`px-5 py-2.5 text-sm font-medium border rounded-xl flex items-center gap-2 transition-colors ${theme === 'dark' ? 'bg-[#111] border-[#333] text-gray-300 hover:bg-[#222]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                              >
                                  <ArrowLeft className="w-4 h-4" /> Back
                              </button>
                          ) : <div />}
                          
                          {step === 1 ? (
                              <button 
                                  onClick={() => setStep(2)}
                                  className={`px-6 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 ml-auto transition-all shadow-sm ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
                              >
                                  Next <ArrowRight className="w-4 h-4" />
                              </button>
                          ) : step === 2 ? (
                              <button 
                                  onClick={() => {
                                      saveSetting('githubUsername', githubUsername);
                                      saveSetting('githubToken', githubToken);
                                      handleBuild();
                                  }}
                                  disabled={!githubUsername || !githubToken || !repoName}
                                  className={`px-6 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 ml-auto transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
                              >
                                  <Play className="w-4 h-4" /> Start Build
                              </button>
                          ) : buildDone ? (
                              <button 
                                  onClick={() => {
                                      setStep(1);
                                      setLogs([]);
                                      setBuildDone(false);
                                      setDownloadUrl('');
                                      setShowBuilder(false);
                                  }}
                                  disabled={isBuilding}
                                  className={`px-5 py-2.5 text-sm font-medium border rounded-xl flex items-center gap-2 ml-auto transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-[#111] border-[#333] text-gray-300 hover:bg-[#222]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                              >
                                  Close <X className="w-4 h-4" />
                              </button>
                          ) : null}
                      </div>
                  </div>
              </div>
          </div>
      </main>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#000000] text-white' : 'bg-[#f8f9fa] text-gray-900'} font-sans pb-24 transition-colors duration-300`}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-6 pb-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'} rounded-xl flex items-center justify-center shadow-sm transition-colors`}>
                <NinjaBLogo className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">My Apps</h1>
        </div>
        <div className={`flex items-center gap-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
           <button onClick={() => setShowSettings(true)} className={`hover:${theme === 'dark' ? 'text-white' : 'text-black'} transition-colors`}>
               <Settings className="w-5 h-5" />
           </button>
           <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className={`hover:${theme === 'dark' ? 'text-white' : 'text-black'} transition-colors`}>
               {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
           <button onClick={() => setShowSearch(!showSearch)} className={`hover:${theme === 'dark' ? 'text-white' : 'text-black'} transition-colors`}>
               <Search className="w-5 h-5" />
           </button>
        </div>
      </header>

      {showSearch && (
          <div className="px-4 max-w-5xl mx-auto mb-6 animate-in fade-in slide-in-from-top-2">
              <div className="relative">
                  <Search className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input 
                      type="text" 
                      placeholder="Search apps..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl border-none focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/10 placeholder:text-gray-600' : 'bg-white text-gray-900 focus:ring-black/5 placeholder:text-gray-400'} shadow-sm transition-colors`}
                  />
              </div>
          </div>
      )}

      {/* Categories */}
      <div className="flex items-center gap-3 px-4 mb-8 overflow-x-auto no-scrollbar max-w-5xl mx-auto">
        <button className={`px-5 py-2 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'} rounded-full text-sm font-medium whitespace-nowrap shadow-sm transition-colors`}>All</button>
        <button className={`px-5 py-2 ${theme === 'dark' ? 'bg-[#111] text-gray-300 border-[#222] hover:bg-[#222]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'} rounded-full text-sm font-medium whitespace-nowrap border transition-colors`}>Uncategorized</button>
        <button className={`px-5 py-2 ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'} text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors`}>
            <Plus className="w-4 h-4"/> Add Category
        </button>
      </div>

      {/* Grid */}
      <div className="px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {filteredHistory.length > 0 ? filteredHistory.map(app => (
           <div key={app.id} className={`p-4 rounded-3xl border ${theme === 'dark' ? 'border-[#222] bg-[#0a0a0a] shadow-[0_2px_15px_rgba(255,255,255,0.02)] hover:shadow-[0_4px_25px_rgba(255,255,255,0.04)]' : 'border-gray-100 bg-white shadow-[0_2px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.04)]'} flex items-center gap-4 transition-all relative group`}>
              
              {editingAppId === app.id ? (
                 <div className="flex-1 min-w-0 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                       <label className={`w-14 h-14 rounded-2xl ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'} flex items-center justify-center overflow-hidden shrink-0 border cursor-pointer hover:opacity-80 transition-opacity`}>
                          {editIconBase64 ? (
                              <img src={editIconBase64} alt={app.appName} className="w-full h-full object-cover"/>
                          ) : app.iconBase64 ? (
                              <img src={app.iconBase64} alt={app.appName} className="w-full h-full object-cover"/>
                          ) : (
                              <Upload className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                          )}
                          <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleEditIconUpload} />
                       </label>
                       <div className="flex-1">
                          <input 
                              type="text" 
                              value={editAppName}
                              onChange={(e) => setEditAppName(e.target.value)}
                              className={`w-full px-3 py-1.5 text-sm rounded-lg border-none focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20' : 'bg-gray-100 text-gray-900 focus:ring-black/10'}`}
                              placeholder="App Name"
                          />
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => handleEditApp(app.id)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'} transition-colors`}>Save</button>
                       <button onClick={() => setEditingAppId(null)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg ${theme === 'dark' ? 'bg-[#222] text-white hover:bg-[#333]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'} transition-colors`}>Cancel</button>
                    </div>
                 </div>
              ) : (
                 <>
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-2xl ${theme === 'dark' ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-100'} flex items-center justify-center overflow-hidden shrink-0 border`}>
                       {app.iconBase64 ? (
                           <img src={app.iconBase64} alt={app.appName} className="w-full h-full object-cover"/>
                       ) : (
                           <NinjaBLogo className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`} />
                       )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                       <h3 className={`font-semibold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{app.appName}</h3>
                       <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} truncate mb-1.5`}>{app.repoName}</p>
                       <div className={`inline-flex items-center gap-1 px-2 py-0.5 ${theme === 'dark' ? 'bg-[#111] border-[#222] text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'} border rounded-md text-[10px] font-medium`}>
                          <Globe className="w-3 h-3" /> Web
                       </div>
                    </div>
                    {/* Action */}
                    <div className="shrink-0 flex flex-col items-end justify-between self-stretch py-0.5">
                       <button 
                           onClick={() => {
                               setEditingAppId(app.id);
                               setEditAppName(app.appName);
                               setEditIconBase64(app.iconBase64 || '');
                           }}
                           className={`opacity-0 group-hover:opacity-100 ${theme === 'dark' ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'} transition-all`}
                       >
                           <Edit2 className="w-4 h-4" />
                       </button>
                       {app.downloadUrl && (
                           <a href={app.downloadUrl} className={`w-7 h-7 rounded-full ${theme === 'dark' ? 'bg-[#111] hover:bg-[#222] border-[#333]' : 'bg-gray-50 hover:bg-gray-100 border-gray-100'} flex items-center justify-center border transition-colors`}>
                              <Download className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} />
                           </a>
                       )}
                    </div>
                 </>
              )}
           </div>
        )) : (
           <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
              <div className={`w-20 h-20 ${theme === 'dark' ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-100'} rounded-3xl flex items-center justify-center mb-4 border`}>
                 <Terminal className={`w-8 h-8 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
              </div>
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-1`}>No Apps Yet</h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} max-w-sm`}>Tap the Create App button below to build your first Android application.</p>
           </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t ${theme === 'dark' ? 'from-[#000000] via-[#000000]' : 'from-[#f8f9fa] via-[#f8f9fa]'} to-transparent flex justify-center pb-8 pointer-events-none`}>
         <button onClick={() => setShowBuilder(true)} className={`pointer-events-auto flex items-center gap-2 px-6 py-3.5 ${theme === 'dark' ? 'bg-white text-black border-transparent hover:bg-gray-200' : 'bg-white border-gray-100 hover:border-gray-200 text-black'} font-semibold rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all transform hover:-translate-y-0.5`}>
            <Plus className="w-5 h-5" /> Create App
         </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
           <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl ${theme === 'dark' ? 'bg-[#0a0a0a] border border-[#222]' : 'bg-white border border-gray-100'} relative animate-in zoom-in-95 duration-200`}>
              <button onClick={() => setShowSettings(false)} className={`absolute top-4 right-4 p-2 rounded-full ${theme === 'dark' ? 'hover:bg-[#222] text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-black'} transition-colors`}>
                  <X className="w-5 h-5" />
              </button>
              <h2 className={`text-xl font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
              <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Save your GitHub credentials to build apps.</p>
              
              <div className="space-y-4 mb-6">
                 <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>GitHub Username</label>
                    <input 
                        type="text" 
                        value={githubUsername}
                        onChange={(e) => setGithubUsername(e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
                        placeholder="octocat"
                    />
                 </div>
                 <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Personal Access Token</label>
                    <input 
                        type="password" 
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    />
                 </div>
              </div>
              
              <button 
                  onClick={() => {
                      saveSetting('githubUsername', githubUsername);
                      saveSetting('githubToken', githubToken);
                      setShowSettings(false);
                  }}
                  className={`w-full py-3 rounded-xl font-medium transition-colors ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
              >
                  Save Credentials
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
