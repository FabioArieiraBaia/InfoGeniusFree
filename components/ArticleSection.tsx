/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { GeneratedImage, UiLanguage } from '../types';
import { translations } from '../translations';
import { Printer, Copy, FileText } from 'lucide-react';

interface ArticleSectionProps {
  content?: string;
  image: GeneratedImage;
  lang: UiLanguage;
}

const ArticleSection: React.FC<ArticleSectionProps> = ({ content, image, lang }) => {
  if (!content) return null;
  const t = translations[lang];

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  // Simple formatter to handle bolding **text** and headers # or ##
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
        if (line.startsWith('# ')) {
            return <h1 key={i} className="text-2xl md:text-3xl font-bold font-serif-display mb-4 mt-8 text-slate-900 dark:text-white border-b-2 border-slate-100 dark:border-white/10 pb-2">{line.replace('# ', '')}</h1>
        }
        if (line.startsWith('## ')) {
            return <h2 key={i} className="text-xl md:text-2xl font-bold font-serif-display mb-3 mt-6 text-slate-800 dark:text-slate-100">{line.replace('## ', '')}</h2>
        }
        if (line.startsWith('### ')) {
            return <h3 key={i} className="text-lg md:text-xl font-bold font-serif-display mb-2 mt-4 text-cyan-700 dark:text-cyan-400">{line.replace('### ', '')}</h3>
        }
        if (line.trim().startsWith('- ')) {
             return <li key={i} className="ml-4 mb-2 text-slate-700 dark:text-slate-300 list-disc marker:text-cyan-500">{line.replace('- ', '')}</li>
        }
        if (line.trim() === '') {
            return <br key={i} />;
        }
        
        // Handle bolding **text**
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
            <p key={i} className="mb-3 text-slate-700 dark:text-slate-300 leading-relaxed text-justify">
                {parts.map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j} className="font-bold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                })}
            </p>
        );
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-12 mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      
      {/* Controls - Hidden in Print */}
      <div className="print:hidden flex items-center justify-between mb-6 border-t border-slate-200 dark:border-white/10 pt-8">
        <div className="flex items-center gap-3">
             <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm">
                <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">{t.article.label}</h3>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium transition-colors"
            >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.article.copy}</span>
            </button>
            <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-colors border border-indigo-200 dark:border-indigo-500/20"
            >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.article.print}</span>
            </button>
        </div>
      </div>

      {/* Content Area - Visible in Print */}
      <div className="article-content bg-white dark:bg-slate-900/60 p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 print:shadow-none print:border-none print:p-0 print:bg-white print:text-black">
         {/* Print Header */}
         <div className="hidden print:block mb-8 text-center pb-6 border-b border-gray-200">
            <h1 className="text-4xl font-serif-display font-bold mb-2 text-black">{t.article.reportTitle}</h1>
            <p className="text-sm text-gray-500 uppercase tracking-widest">InfoGenius Free • Fabio Arieira</p>
         </div>

         {/* Image for Print */}
         <div className="hidden print:block mb-8 break-inside-avoid">
            <img src={image.data} alt={image.prompt} className="w-full h-auto rounded-xl border border-gray-200" />
            <p className="text-xs text-center mt-2 italic text-gray-500">{image.prompt}</p>
         </div>

         <div className="prose dark:prose-invert max-w-none print:prose-black">
            {renderContent(content)}
         </div>

         <div className="hidden print:flex justify-between mt-12 pt-8 border-t border-gray-200 text-[10px] text-gray-400 font-mono uppercase tracking-widest">
            <span>{t.article.generatedBy}</span>
            <span>fabioarieira.com</span>
         </div>
      </div>
    </div>
  );
};

export default ArticleSection;