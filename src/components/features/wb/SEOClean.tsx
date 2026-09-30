'use client';

import React, { useState, useRef } from 'react';
import { Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

const WB_CHAR_LIMIT = 5000;

interface CleanOptions {
  removeHiddenChars: boolean;
  collapseSpaces: boolean;
  removeDuplicates: boolean;
}

interface ToastState {
  show: boolean;
  type: 'success' | 'error';
  message: string;
}

const DEFAULT_OPTIONS: CleanOptions = {
  removeHiddenChars: true,
  collapseSpaces: true,
  removeDuplicates: false,
};

const SEO_PURPLE = '#7b1fa2';

function removeHiddenCharacters(text: string): string {
  return text.replace(
    /[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u2028\u2029\u202F\u205F\u3000\u2060\u2061-\u2064\u2066-\u2069\uFFFC\uFFFD]/g,
    ''
  );
}

function collapseWhitespace(text: string): string {
  let result = text.replace(/[ \t]+/g, ' ');
  result = result
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

function deduplicateKeywords(text: string, maxFrequency: number = 3): string {
  const paragraphs = text.split(/\n{2,}/);

  return paragraphs
    .map((paragraph) => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      const result: string[] = [];
      const wordFreq: Map<string, number> = new Map();
      let prevNormalized = '';

      for (const word of words) {
        const normalized = word
          .replace(/[.,!?;:"'()«»—–-]+/g, '')
          .toLowerCase()
          .trim();

        if (!normalized) {
          result.push(word);
          continue;
        }

        if (normalized === prevNormalized) {
          continue;
        }

        const freq = (wordFreq.get(normalized) || 0) + 1;
        wordFreq.set(normalized, freq);

        if (freq > maxFrequency) {
          prevNormalized = normalized;
          continue;
        }

        prevNormalized = normalized;
        result.push(word);
      }

      return result.join(' ');
    })
    .filter((p) => p.length > 0)
    .join('\n\n');
}

export default function SEOClean({ feature }: { feature: Feature }) {
  const [text, setText] = useState('');
  const [options, setOptions] = useState<CleanOptions>(DEFAULT_OPTIONS);
  const [toast, setToast] = useState<ToastState>({ show: false, type: 'success', message: '' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isCharLimitExceeded = charCount > WB_CHAR_LIMIT;

  const updateOption = (field: keyof CleanOptions, value: boolean) => {
    setOptions((prev) => ({ ...prev, [field]: value }));
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: 'success', message: '' }), 3000);
  };

  const handleClean = async () => {
    if (!text.trim()) {
      showToast('error', 'Введите текст для очистки');
      return;
    }

    let cleaned = text;

    if (options.removeHiddenChars) {
      cleaned = removeHiddenCharacters(cleaned);
    }
    if (options.collapseSpaces) {
      cleaned = collapseWhitespace(cleaned);
    }
    if (options.removeDuplicates) {
      cleaned = deduplicateKeywords(cleaned);
    }

    setText(cleaned);

    try {
      await navigator.clipboard.writeText(cleaned);
      showToast('success', 'Текст успешно очищен и скопирован!');
    } catch {
      textareaRef.current?.select();
      document.execCommand('copy');
      showToast('success', 'Текст успешно очищен и скопирован!');
    }
  };

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Source Text Input */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">Исходный текст</h3>
          <p className="text-xs text-neutral-500 mb-3">
            Вставьте текст описания карточки товара — инструмент подскажет, как улучшить SEO
          </p>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Вставьте сюда описание карточки товара от конкурента или из ChatGPT..."
            rows={10}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-y"
          />
        </div>

        {/* Options and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Options Panel */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Опции очистки</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.removeHiddenChars}
                  onChange={(e) => updateOption('removeHiddenChars', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-300 accent-[var(--primary)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-neutral-700 leading-relaxed">
                  Удалить скрытые спецсимволы и невидимые пробелы
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.collapseSpaces}
                  onChange={(e) => updateOption('collapseSpaces', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-300 accent-[var(--primary)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-neutral-700 leading-relaxed">
                  Схлопнуть лишние пробелы и пустые строки
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.removeDuplicates}
                  onChange={(e) => updateOption('removeDuplicates', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-300 accent-[var(--primary)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-neutral-700 leading-relaxed">
                  Очистить от дубликатов слов / спама
                </span>
              </label>
            </div>
          </div>

          {/* Statistics Panel */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Статистика текста</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-neutral-500 mb-1">Символов</p>
                <p
                  className={cn(
                    'text-2xl font-semibold',
                    isCharLimitExceeded ? 'text-red-600' : 'text-neutral-900'
                  )}
                >
                  {charCount} / {WB_CHAR_LIMIT}
                </p>
                {isCharLimitExceeded && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠ Превышен лимит WB (5000 символов)
                  </p>
                )}
              </div>
              <div className="border-t border-neutral-200 pt-3">
                <p className="text-sm text-neutral-500 mb-1">Слов</p>
                <p className="text-2xl font-semibold text-neutral-900">{wordCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleClean}
          disabled={!text.trim()}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-colors',
            text.trim()
              ? `bg-[${SEO_PURPLE}] hover:opacity-90`
              : 'bg-neutral-300 cursor-not-allowed'
          )}
        >
          <Sparkles className="w-4 h-4" />
          Очистить и скопировать результат
        </button>

        {/* Toast Notification */}
        {toast.show && (
          <div
            className={cn(
              'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-in',
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            )}
            role="alert"
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}
      </div>
    </SectionContentWrapper>
  );
}
