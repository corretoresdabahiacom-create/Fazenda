/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Search, Edit3, Trash2, Package, Archive, X, ArrowLeft, 
  Store, Phone, User, History, CheckCircle, Clock, ShieldAlert, FileText, ShoppingCart
} from 'lucide-react';
import { InventoryItem } from '../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  inventory: InventoryItem[];
  onAdd: (item: InventoryItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function Inventory({ inventory, onAdd, onDelete }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Expanded search/view logs state for selected item
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<InventoryItem | null>(null);

  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    category: 'Supply',
    name: '',
    quantity: 0,
    unit: 'un',
    unitPrice: 0,
    totalPrice: 0,
    storeName: '',
    contactPhone: '',
    responsiblePerson: '',
  });

  const filteredInventory = inventory.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.storeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.responsiblePerson || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = formData.quantity || 0;
    const unitPrice = formData.unitPrice || 0;

    // Build or append to history
    let history = editingItem?.history || [];
    const changeDate = new Date().toISOString();
    
    if (editingItem) {
      if (editingItem.quantity !== qty) {
        history = [
          ...history,
          {
            date: changeDate,
            changeType: 'adjustment',
            quantity: qty - editingItem.quantity,
          }
        ];
      } else {
        history = [
          ...history,
          {
            date: changeDate,
            changeType: 'edit',
            quantity: 0,
          }
        ];
      }
    } else {
      history = [
        {
          date: changeDate,
          changeType: 'add',
          quantity: qty,
        }
      ];
    }

    const newItem: InventoryItem = {
      id: editingItem?.id || Date.now().toString(),
      name: formData.name || '',
      category: formData.category || 'Supply',
      quantity: qty,
      unit: formData.unit || 'un',
      unitPrice: unitPrice,
      totalPrice: qty * unitPrice,
      lastUpdated: changeDate,
      storeName: formData.storeName || undefined,
      contactPhone: formData.contactPhone || undefined,
      responsiblePerson: formData.responsiblePerson || undefined,
      history
    };

    await onAdd(newItem);
    setIsFormOpen(false);
    setEditingItem(null);
    setFormData({ 
      category: 'Supply', 
      name: '', 
      quantity: 0, 
      unit: 'un', 
      unitPrice: 0, 
      totalPrice: 0,
      storeName: '',
      contactPhone: '',
      responsiblePerson: '',
    });
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData(item);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta ficha de estoque?')) {
      await onDelete(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Search bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar estoque por item, fornecedor..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#e5e0d8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d5a45]/20 font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
            setEditingItem(null);
            setFormData({
              category: 'Supply',
              name: '',
              quantity: 0,
              unit: 'un',
              unitPrice: 0,
              totalPrice: 0,
              storeName: '',
              contactPhone: '',
              responsiblePerson: '',
            });
            setIsFormOpen(true);
          }}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#3d5a45] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#2d4233] transition-colors shadow-sm text-sm"
        >
          <Plus size={20} />
          Adicionar Item de Estoque
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredInventory.map((item) => (
            <motion.div 
              key={item.id}
              layout
              className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm flex flex-col justify-between hover:border-[#3d5a45]/40 transition-all group relative overflow-hidden"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                    item.category === 'Supply' 
                      ? 'bg-blue-50 border-blue-100 text-blue-700' 
                      : 'bg-orange-50 border-orange-100 text-orange-700'
                  }`}>
                    {item.category === 'Supply' ? '📦 Suprimento' : '⚙️ Equipamento'}
                  </span>
                  
                  <div className="flex items-center gap-1 group-hover:opacity-100 opacity-80 transition-opacity">
                    <button 
                      onClick={() => setSelectedItemForHistory(item)}
                      className="p-1.5 hover:bg-neutral-100 text-[#6d6a66] rounded-lg"
                      title="Histórico de alterações"
                    >
                      <History size={16} />
                    </button>
                    <button 
                      onClick={() => handleEdit(item)} 
                      className="p-1.5 hover:bg-neutral-100 text-neutral-600 rounded-lg"
                      title="Editar"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)} 
                      className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-black text-[#2d2a26]">{item.name}</h3>
                  
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-[#3d5a45]">{item.quantity}</span>
                    <span className="text-xs font-bold text-[#8d8a86] uppercase">{item.unit}</span>
                  </div>

                  {item.unitPrice && item.unitPrice > 0 ? (
                    <p className="text-[10px] text-[#8d8a86] font-bold mt-1 uppercase">Valor Unitário: <span className="text-[#3d5a45]">R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> (Total: R$ {item.totalPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</p>
                  ) : null}

                  {/* Store and contact detail section */}
                  {(item.storeName || item.contactPhone || item.responsiblePerson) && (
                    <div className="mt-4 pt-3.5 border-t border-[#f2ece4] space-y-2 text-xs font-medium text-[#6d6a66]">
                      {item.storeName && (
                        <div className="flex items-center gap-1.5">
                          <Store size={14} className="text-[#8d8a86]" />
                          <span>Adquirido em: <span className="font-bold text-[#2d2a26]">{item.storeName}</span></span>
                        </div>
                      )}
                      {item.contactPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={14} className="text-[#8d8a86]" />
                          <span>Telefone loja: <span className="font-bold text-[#2d2a26]">{item.contactPhone}</span></span>
                        </div>
                      )}
                      {item.responsiblePerson && (
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-[#8d8a86]" />
                          <span>Responsável: <span className="font-bold text-[#2d2a26]">{item.responsiblePerson}</span></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#f2ece4] flex justify-between items-center text-[10px] text-[#8d8a86] font-bold uppercase">
                <span>Última Entrada</span>
                <span>{format(new Date(item.lastUpdated), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            </motion.div>
          ))}

          {filteredInventory.length === 0 && (
            <div className="col-span-full py-16 text-center text-[#8d8a86] italic bg-[#fcfaf7] rounded-3xl border border-[#e5e0d8]">
              Nenhum item em estoque correspondente aos filtros.
            </div>
          )}
        </div>

        {/* Right side change history analyzer */}
        <div className="xl:col-span-1">
          {selectedItemForHistory ? (
            <div className="bg-white border border-[#e5e0d8] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-black text-[#8d8a86] uppercase">Linha do Tempo</h4>
                  <h3 className="text-base font-black text-[#2d2a26] pr-4">{selectedItemForHistory.name}</h3>
                </div>
                <button 
                  onClick={() => setSelectedItemForHistory(null)}
                  className="p-1 hover:bg-[#e5e0d8] rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 pt-2 border-t border-[#f0f0f0] overflow-y-auto max-h-[420px] pr-1">
                {selectedItemForHistory.history && selectedItemForHistory.history.length > 0 ? (
                  selectedItemForHistory.history.map((log, idx) => (
                    <div key={idx} className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                          {idx + 1}
                        </div>
                        {idx !== selectedItemForHistory.history!.length - 1 && (
                          <div className="w-0.5 h-full bg-neutral-200 mt-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="font-bold text-[#2d2a26]">
                          {log.changeType === 'add' ? '🆕 Registro Inicial' : log.changeType === 'edit' ? '✏️ Dados Modificados' : '📊 Ajuste de Quantidade'}
                        </div>
                        <p className="text-[#8d8a86] font-medium">{format(new Date(log.date), 'dd/MM/yyyy HH:mm')}</p>
                        {log.quantity !== 0 && (
                          <p className="font-bold text-[#3d5a45] mt-1">
                            Ajuste: {log.quantity > 0 ? '+' : ''}{log.quantity} {selectedItemForHistory.unit}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[#8d8a86] italic text-center py-6">
                    Mapeando histórico acumulável a partir deste momento.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#fcfaf7] border border-dashed border-[#e5e0d8] rounded-3xl p-6.5 text-center text-[#8d8a86] italic text-xs">
              💡 Clique no ícone de relógio (<History size={13} className="inline mx-0.5" />) em qualquer item do estoque para inspecionar seu histórico e rastreabilidade de compras ou suprimentos.
            </div>
          )}
        </div>
      </div>

      {/* Item Setup Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#e5e0d8] flex items-center justify-between bg-[#fcfaf7]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 -ml-2 text-[#6d6a66] hover:text-[#3d5a45] hover:bg-[#f5f2ed] rounded-full transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-base font-black flex items-center gap-2">
                  <Package size={18} className="text-[#3d5a45]" />
                  {editingItem ? 'Editar Item de Estoque' : 'Novo Lançamento de Estoque'}
                </h3>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-[#e5e0d8] rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              <div>
                <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1.5 block">Categoria do Item</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, category: 'Supply'})}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
                      formData.category === 'Supply' ? 'bg-blue-600 text-white shadow-md' : 'bg-[#fcfaf7] border border-[#e5e0d8] text-[#8d8a86]'
                    }`}
                  >
                    Suprimento (Sal, Ração, etc)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, category: 'Equipment'})}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
                      formData.category === 'Equipment' ? 'bg-orange-600 text-white shadow-md' : 'bg-[#fcfaf7] border border-[#e5e0d8] text-[#8d8a86]'
                    }`}
                  >
                    Equipamento (Cerca, Trator, etc)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Nome do Item</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 bg-white border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-bold"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Sal Proteinado, Vacina Aftosa, Arame Farpado..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Quantidade</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-black"
                    value={formData.quantity || ''}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      setFormData({
                        ...formData, 
                        quantity: qty,
                        totalPrice: qty * (formData.unitPrice || 0)
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Unidade de Medida</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-medium"
                    value={formData.unit || ''}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    placeholder="Ex: sacos, kg, litros, rolos..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Preço Unitário (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-bold text-emerald-700"
                    value={formData.unitPrice || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormData({
                        ...formData, 
                        unitPrice: val,
                        totalPrice: (formData.quantity || 0) * val
                      });
                    }}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Estimado Total</label>
                  <div className="w-full px-4 py-2.5 bg-[#fcfaf7] border border-[#e5e0d8] rounded-xl font-black text-[#3d5a45]">
                    R$ {((formData.quantity || 0) * (formData.unitPrice || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Advanced Tracking Custom fields */}
              <div className="pt-2 border-t border-[#f2ece4] space-y-3">
                <h4 className="text-xs font-black text-[#5d5a56] uppercase flex items-center gap-1">
                  <ShoppingCart size={13} className="text-[#3d5a45]" /> Dados do Fornecedor & Rastreabilidade
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Nome Comercial da Loja</label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={16} />
                      <input 
                        type="text" 
                        className="w-full pl-10 pr-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-medium"
                        value={formData.storeName || ''}
                        onChange={(e) => setFormData({...formData, storeName: e.target.value})}
                        placeholder="Ex: Agropecuária Alvorada..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Contato de Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={16} />
                      <input 
                        type="tel" 
                        className="w-full pl-10 pr-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-medium"
                        value={formData.contactPhone || ''}
                        onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                        placeholder="Ex: (34) 99999-9999"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Responsável Compra</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={16} />
                      <input 
                        type="text" 
                        className="w-full pl-10 pr-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-medium"
                        value={formData.responsiblePerson || ''}
                        onChange={(e) => setFormData({...formData, responsiblePerson: e.target.value})}
                        placeholder="Ex: Sr. Francisco Vaqueiro..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 px-6 py-2.5 rounded-xl border border-[#e5e0d8] font-bold text-[#6d6a66] hover:bg-[#fcfaf7] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-2.5 rounded-xl bg-[#3d5a45] font-bold text-white hover:bg-[#2d4233] transition-colors shadow-md"
                >
                  Salvar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
