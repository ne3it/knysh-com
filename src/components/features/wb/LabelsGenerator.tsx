'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import { useLinkedForm, LABELS_LINKS } from '@/lib/hooks/useLinkedForm';
import type { Feature } from '@/types/section';
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from '@/lib/fonts';

interface FormState {
  productName: string;
  sku: string;
  barcode: string;
  manufacturer: string;
  importer: string;
  composition: string;
}

interface ToastState {
  show: boolean;
  type: 'success' | 'error';
  message: string;
}

export default function LabelsGenerator({ feature }: { feature: Feature }) {
  const defaultForm = useMemo<FormState>(
    () => ({
      productName: 'Платье женское базовое',
      sku: 'PL-0943-BL',
      barcode: '2037281940123',
      manufacturer: "ООО 'ТекстильПром', РФ, г. Иваново",
      importer: "ООО 'МаркетИмпорт', РБ, г. Минск, ул. Короля, 2",
      composition: '95% хлопок, 5% эластан. Бережная стирка при 30°C.',
    }),
    []
  );

  const { form, setForm } = useLinkedForm<FormState>(defaultForm, LABELS_LINKS);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, type: 'success', message: '' });
  const jsPDFRef = useRef<any>(null);
  const jsBarcodeRef = useRef<any>(null);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadLibraries = async () => {
    if (jsPDFRef.current && jsBarcodeRef.current) return;

    try {
      const [jsPDFModule, jsBarcodeModule] = await Promise.all([
        import('jspdf'),
        import('jsbarcode'),
      ]);
      jsPDFRef.current = jsPDFModule.default;
      jsBarcodeRef.current = jsBarcodeModule.default;
    } catch (error) {
      console.error('Failed to load libraries:', error);
      throw new Error('Не удалось загрузить библиотеки для генерации PDF');
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: 'success', message: '' }), 3000);
  };

  const generateBarcodeCanvas = (barcodeValue: string): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');

    const options = {
      format: 'CODE128',
      width: 2,
      height: 40,
      displayValue: true,
      fontSize: 12,
      margin: 5,
      background: '#ffffff',
      lineColor: '#000000',
    };

    if (jsBarcodeRef.current) {
      jsBarcodeRef.current(canvas, barcodeValue, options);
    }

    return canvas;
  };

  const handleGeneratePDF = async () => {
    setGenerating(true);

    try {
      await loadLibraries();

      const jsPDF = jsPDFRef.current;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [58, 40],
      });

      doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64);
      doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

      const pageWidth = 58;
      const pageHeight = 40;
      const margin = 2;

      doc.setFont('Roboto', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);

      doc.text('EAC', margin, 7);
      doc.setFont('Roboto', 'normal');
      doc.setFontSize(7);
      doc.text(`Арт: ${form.sku}`, margin + 12, 7);

      doc.setFontSize(5.5);
      doc.setFont('Roboto', 'normal');

      let yPos = 12;
      const lineHeight = 3;
      const maxWidth = pageWidth - margin * 2;

      const fields = [
        { label: 'Товар:', value: form.productName },
        { label: 'Состав:', value: form.composition },
        { label: 'Производитель:', value: form.manufacturer },
        { label: 'Импортер в РБ:', value: form.importer },
      ];

      fields.forEach((field) => {
        const fullText = `${field.label} ${field.value}`;
        const lines = doc.splitTextToSize(fullText, maxWidth);
        lines.forEach((line: string) => {
          if (yPos + lineHeight <= pageHeight - 15) {
            doc.text(line, margin, yPos);
            yPos += lineHeight;
          }
        });
        yPos += 1;
      });

      const barcodeCanvas = generateBarcodeCanvas(form.barcode);
      const barcodeImgData = barcodeCanvas.toDataURL('image/png');

      const barcodeWidth = 50;
      const barcodeHeight = 12;
      const barcodeX = (pageWidth - barcodeWidth) / 2;
      const barcodeY = pageHeight - barcodeHeight - 2;

      doc.addImage(barcodeImgData, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);

      const fileName = `etiqueta_${form.sku}_${Date.now()}.pdf`;
      doc.save(fileName);

      showToast('success', 'PDF этикетка успешно сгенерирована и скачана');
    } catch (error) {
      console.error('PDF generation error:', error);
      showToast('error', error instanceof Error ? error.message : 'Ошибка при генерации PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setForm(defaultForm);
  };

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Параметры этикетки</h3>
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Наименование товара</label>
                <input
                  type="text"
                  value={form.productName}
                  onChange={(e) => updateField('productName', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[#7b1fa2] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Артикул WB (SKU)</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => updateField('sku', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[#7b1fa2] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Штрихкод / Баркод товара</label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => updateField('barcode', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[#7b1fa2] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Производитель и страна происхождения</label>
                <input
                  type="text"
                  value={form.manufacturer}
                  onChange={(e) => updateField('manufacturer', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[#7b1fa2] focus:border-transparent"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Обязательный Импортер в РБ</label>
                <input
                  type="text"
                  value={form.importer}
                  onChange={(e) => updateField('importer', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[#7b1fa2] focus:border-transparent"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Состав и правила ухода на русском языке</label>
                <textarea
                  value={form.composition}
                  onChange={(e) => updateField('composition', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[#7b1fa2] focus:border-transparent resize-none"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleGeneratePDF}
                disabled={generating}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-colors',
                  generating
                    ? 'bg-[#7b1fa2]/50 cursor-not-allowed'
                    : 'bg-[#7b1fa2] hover:bg-[#7b1fa2]/90'
                )}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Генерируем...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Сгенерировать готовый PDF (58x40 мм)
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Сбросить
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Предпросмотр структуры этикетки</h3>
          <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 font-mono text-sm text-neutral-700 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-[#7b1fa2]">EAC</span>
              <span className="text-neutral-500">Арт: {form.sku}</span>
            </div>
            <div className="text-neutral-600">Товар: {form.productName}</div>
            <div className="text-neutral-600">Состав: {form.composition}</div>
            <div className="text-neutral-600">Производитель: {form.manufacturer}</div>
            <div className="text-neutral-600">Импортер в РБ: {form.importer}</div>
            <div className="flex justify-center pt-2 border-t border-neutral-200 mt-2">
              <span className="text-neutral-400">┌────────────────────┐</span>
            </div>
            <div className="flex justify-center">
              <span className="text-neutral-400">│  ШТРИХКОД (BARCODE)  │</span>
            </div>
            <div className="flex justify-center">
              <span className="text-neutral-400">{form.barcode}</span>
            </div>
            <div className="flex justify-center pb-2">
              <span className="text-neutral-400">└────────────────────┘</span>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-3 text-center">
            Размер этикетки: 58 × 40 мм (ландшафтная ориентация) · Формат: PDF · Штрихкод: CODE128
          </p>
        </div>

        {toast.show && (
          <div
            className={cn(
              'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-in',
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
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