/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, X, FileText, Download, AlertTriangle, Upload } from 'lucide-react';
import { FarmDocument, DocumentCategory } from '../types';
import { format, differenceInCalendarDays } from 'date-fns';
import { compressImageIfNeeded } from '../lib/imageCompression';

interface Props {
  documents: FarmDocument[];
  saveDocument: (d: FarmDocument, file: File | null) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export default function Documentos({ documents, saveDocument, deleteDocument }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<FarmDocument>>({ category: DocumentCategory.CAR });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setForm({ category: DocumentCategory.CAR });
    setFile(null);
    setError(null);
    setIsOpen(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);
    if (picked) {
      const compressed = await compressImageIfNeeded(picked);
      setFile(compressed);
    } else {
      setFile(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const item: FarmDocument = {
      id: `doc_${Date.now()}`,
      category: form.category ?? DocumentCategory.CAR,
      title: form.title || (form.category ?? 'Documento'),
      issueDate: form.issueDate,
      expirationDate: form.expirationDate,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    setUploading(true);
    try {
      await saveDocument(item, file);
      setIsOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o documento. Tente um arquivo menor.');
    } finally {
      setUploading(false);
    }
  }

  const today = new Date();
  const expiringSoon = documents.filter(d => {
    if (!d.expirationDate) return false;
    return differenceInCalendarDays(new Date(d.expirationDate), today) <= 30;
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-theme-primary">Documentos</h1>
        <p className="text-sm text-theme-secondary">CAR, CCIR, ITR, contratos, licenças ambientais, receituários agronômicos.</p>
      </div>

      {expiringSoon.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl p-3">
          <p className="text-xs font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} /> Vencendo em até 30 dias
          </p>
          {expiringSoon.map(d => (
            <p key={d.id} className="text-xs text-orange-700 dark:text-orange-300">{d.title}: vence em {format(new Date(d.expirationDate!), 'dd/MM/yyyy')}</p>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Documento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map((d) => (
          <div key={d.id} className="bg-theme-card rounded-2xl border border-theme p-4 space-y-1 shadow-theme text-theme-primary">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-theme-secondary">{d.category}</span>
                <h3 className="font-bold text-theme-primary">{d.title}</h3>
              </div>
              <FileText size={18} className="text-theme-secondary shrink-0" />
            </div>
            {d.expirationDate && <p className="text-xs text-theme-secondary">Validade: {format(new Date(d.expirationDate), 'dd/MM/yyyy')}</p>}
            {d.fileName && <p className="text-xs text-theme-secondary truncate">{d.fileName}</p>}
            <div className="flex gap-3 pt-2">
              {d.fileUrl && (
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1">
                  <Download size={12} /> Abrir arquivo
                </a>
              )}
              <button onClick={() => confirm('Excluir este documento (e o arquivo, se houver)?') && deleteDocument(d.id)} className="text-xs font-semibold text-red-400 ml-auto flex items-center gap-1">
                <Trash2 size={12} /> Excluir
              </button>
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-sm text-theme-secondary col-span-full text-center py-8">Nenhum documento cadastrado ainda.</p>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-theme-card rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto shadow-theme">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-theme-primary">Novo Documento</h2>
              <button onClick={() => setIsOpen(false)}><X size={20} className="text-theme-secondary" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Categoria</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as DocumentCategory })} className={inputCls}>
                  {Object.values(DocumentCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Título</label>
                <input value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="Ex: CAR Fazenda Terra Rica" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-theme-secondary">Data de emissão</label>
                  <input type="date" value={form.issueDate ?? ''} onChange={e => setForm({ ...form, issueDate: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-theme-secondary">Validade</label>
                  <input type="date" value={form.expirationDate ?? ''} onChange={e => setForm({ ...form, expirationDate: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-theme-secondary flex items-center gap-1.5">
                  <Upload size={12} /> Arquivo (PDF ou imagem, opcional — máx. ~700KB)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                  className="w-full text-sm mt-1"
                />
                {file && (
                  <p className="text-xs text-theme-secondary mt-1">
                    {file.name} ({(file.size / 1024).toFixed(0)}KB){file.size > 650_000 && ' — pode ser grande demais'}
                  </p>
                )}
                <p className="text-[11px] text-theme-secondary mt-1">
                  Fotos são comprimidas automaticamente. PDFs grandes podem não caber — nesse caso, tente uma versão menor ou tire uma foto do documento em vez de anexar o PDF original.
                </p>
              </div>
              {error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-2">{error}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={uploading} className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-60">
                  {uploading ? 'Enviando...' : 'Salvar'}
                </button>
                <button type="button" onClick={() => setIsOpen(false)} className="flex-1 border border-theme py-2.5 rounded-xl font-semibold text-sm text-theme-secondary bg-theme-card text-theme-primary">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full border border-theme rounded-xl px-3 py-2 text-sm bg-theme-card text-theme-primary placeholder:text-theme-secondary";
