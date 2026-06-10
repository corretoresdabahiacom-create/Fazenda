/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { 
  Download, Filter, FileText, Printer, ChevronDown, Beef, Calendar, User, Tag, Scale, 
  Hash, Users, Briefcase, TrendingUp, Coins, ShoppingCart, Landmark, ArrowRightLeft, 
  Warehouse, PieChart, ShieldAlert, BadgeInfo, HelpCircle, FileCheck
} from 'lucide-react';
import { EmployeePayment, Expense, Animal, TransactionHistory, Employee, Pasture, AnimalType } from '../types';
import { EXPENSE_TYPES, EMPLOYEE_ROLES, ANIMAL_CATEGORIES, ANIMAL_TYPES, PASTURE_TYPES } from '../constants';
import { format, differenceInDays, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';
import { jsPDF } from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Props {
  payments: EmployeePayment[];
  expenses: Expense[];
  animals: Animal[];
  transactions: TransactionHistory[];
  pastures: Pasture[];
}

export default function Reports({ payments, expenses, animals, transactions, pastures }: Props) {
  const { employees, fixedExpenses, inventory, settings } = useFirebase();

  // Primary active reports page tab
  const [activeTab, setActiveTab ] = useState<'financial' | 'employees' | 'livestock' | 'commercial'>('financial');

  const [reportType, setReportType] = useState<'monthly' | 'daily' | 'custom'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().substring(0, 10)); // YYYY-MM-DD
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().substring(0, 10));

  // Individual worker selector filter
  const [focusedEmployeeId, setFocusedEmployeeId] = useState<string>('ALL');

  // Dates parsing for ledger
  const dateInterval = useMemo(() => {
    let start: Date;
    let end: Date;

    if (reportType === 'monthly') {
      start = startOfMonth(parseISO(`${selectedMonth}-01`));
      end = endOfMonth(start);
    } else if (reportType === 'daily') {
      const d = parseISO(selectedDate);
      start = new Date(d.setHours(0,0,0,0));
      end = new Date(d.setHours(23,59,59,999));
    } else {
      start = new Date(parseISO(startDate).setHours(0,0,0,0));
      end = new Date(parseISO(endDate).setHours(23,59,59,999));
    }
    return { start, end };
  }, [reportType, selectedMonth, selectedDate, startDate, endDate]);

  // General Financial results computing
  const reportData = useMemo(() => {
    const { start, end } = dateInterval;

    const filteredExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });

    const filteredPayments = payments.filter(p => {
      const d = new Date(p.date);
      return d >= start && d <= end;
    });

    const totalExp = filteredExpenses.reduce((acc, e) => acc + e.value, 0);
    const totalPay = filteredPayments.reduce((acc, p) => acc + p.totalValue, 0);

    return {
      expenses: filteredExpenses,
      payments: filteredPayments,
      total: totalExp + totalPay,
      countExp: filteredExpenses.length,
      countPay: filteredPayments.length
    };
  }, [dateInterval, expenses, payments]);

  // Active cattle list inside filters
  const activeAndSoldAnimals = useMemo(() => {
    return animals.map(a => {
      const stayDays = differenceInDays(
        a.isSold && a.saleDetails ? new Date(a.saleDetails.saleDate) : new Date(),
        new Date(a.entryDate)
      );
      const entryYear = new Date(a.entryDate).getFullYear();
      return {
        ...a,
        stayDays,
        stayMonths: Math.max(1, Math.round(stayDays / 30)),
        entryYear
      };
    });
  }, [animals]);

  // Category and Breed statistics calculators
  const cattleAnalyticsGrouped = useMemo(() => {
    const breedBreakdown: Record<string, { count: number, heads: number, costs: number }> = {};
    const categoryBreakdown: Record<string, { count: number, heads: number, costs: number }> = {};

    animals.forEach(a => {
      const breed = a.breed || 'Nelore Indefinido';
      const cat = a.category || 'Bois Gordos';

      if (!breedBreakdown[breed]) breedBreakdown[breed] = { count: 0, heads: 0, costs: 0 };
      breedBreakdown[breed].count += 1;
      breedBreakdown[breed].heads += a.quantity || 0;
      breedBreakdown[breed].costs += (a.purchasePrice || 0) * (a.quantity || 0);

      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, heads: 0, costs: 0 };
      categoryBreakdown[cat].count += 1;
      categoryBreakdown[cat].heads += a.quantity || 0;
      categoryBreakdown[cat].costs += (a.purchasePrice || 0) * (a.quantity || 0);
    });

    return {
      breeds: Object.entries(breedBreakdown).map(([name, data]) => ({ name, ...data })),
      categories: Object.entries(categoryBreakdown).map(([name, data]) => ({ name, ...data })),
    };
  }, [animals]);

  // Employee Payroll Analysis
  const employeePaymentsBreakdown = useMemo(() => {
    const roleSalarySum: Record<string, number> = {};
    const individualExpensesSum: Record<string, { total: number, paymentsCount: number }> = {};

    employees.forEach(emp => {
      individualExpensesSum[emp.id] = { total: 0, paymentsCount: 0 };
    });

    payments.forEach(p => {
      const role = p.role || 'Geral/Outros';
      roleSalarySum[role] = (roleSalarySum[role] || 0) + (p.totalValue || 0);

      // find employee by name to sum up
      const matchedEmp = employees.find(e => e.name.toLowerCase() === p.employeeName.toLowerCase());
      if (matchedEmp) {
        individualExpensesSum[matchedEmp.id].total += p.totalValue || 0;
        individualExpensesSum[matchedEmp.id].paymentsCount += 1;
      }
    });

    return {
      roles: Object.entries(roleSalarySum).map(([role, val]) => ({ role, value: val })),
      individuals: employees.map(emp => ({
        emp,
        stats: individualExpensesSum[emp.id] || { total: 0, paymentsCount: 0 }
      }))
    };
  }, [employees, payments]);

  // Trading Analysis (Comercialização & Custos de Compra vs Venda)
  const tradingAnalysis = useMemo(() => {
    let ownPurchaseInvested = 0;
    let soldHeadCounts = 0;
    
    // Sales cumulative fees definition
    let totalFreight = 0;
    let totalFunrural = 0;
    let totalTaxes = 0;
    let totalOtherExpenses = 0;

    let ownSoldGrossRevenue = 0;
    let ownSoldPurchaseCost = 0;
    let ownSoldOverheads = 0;
    let ownSoldNetProfits = 0;

    let rentRevenue = 0;
    let rentNetProfits = 0;

    let meiaRevenue = 0;
    let meiaNetProfits = 0;

    animals.forEach(a => {
      // 1. Purchase investments tracking of active own animals
      if (a.type === AnimalType.OWN && !a.isSold) {
        ownPurchaseInvested += (a.purchasePrice || 0) * (a.quantity || 0);
      }

      // ACCRUED ACTIVE RENT CALCULATION
      if (a.type === AnimalType.RENT && !a.isSold) {
        const days = Math.max(1, differenceInDays(new Date(), new Date(a.entryDate)));
        const months = days / 30;
        const accrued = (a.rentValue || 0) * a.quantity * months;
        rentRevenue += accrued;
        rentNetProfits += accrued; // no sales cost for active animal groups
      }

      // 2. Closed sales calculations
      if (a.isSold && a.saleDetails) {
        soldHeadCounts += a.quantity || 0;
        totalFreight += a.saleDetails.shippingCost || 0;
        totalFunrural += a.saleDetails.funruralCost || 0;
        totalTaxes += a.saleDetails.taxesCost || 0;
        totalOtherExpenses += a.saleDetails.otherSaleCosts || 0;

        const salesOverheads = (a.saleDetails.shippingCost || 0) + 
                               (a.saleDetails.funruralCost || 0) + 
                               (a.saleDetails.taxesCost || 0) + 
                               (a.saleDetails.otherSaleCosts || 0);

        if (a.type === AnimalType.OWN) {
          ownSoldGrossRevenue += a.saleDetails.totalSaleValue || 0;
          ownSoldPurchaseCost += (a.purchasePrice || 0) * (a.quantity || 0);
          ownSoldOverheads += salesOverheads;
          ownSoldNetProfits += a.saleDetails.netProfit || 0;
        } else if (a.type === AnimalType.RENT) {
          rentRevenue += a.saleDetails.totalSaleValue || 0;
          rentNetProfits += a.saleDetails.netProfit || 0;
        } else if (a.type === AnimalType.PARTIAL) {
          meiaRevenue += a.saleDetails.totalSaleValue || 0;
          meiaNetProfits += a.saleDetails.netProfit || 0;
        }
      }
    });

    const ownSoldGrossProfit = Math.max(0, ownSoldGrossRevenue - ownSoldPurchaseCost);
    const totalSalesOverheads = totalFreight + totalFunrural + totalTaxes + totalOtherExpenses;

    // "lucro bruto total referente ao ciclo"
    const lucroBrutoTotal = ownSoldGrossProfit + rentRevenue + meiaRevenue;

    // "lucro líquido 2 referente as receita de animais de Meia e Aluguel, discriminados separados e unificados"
    const lucroLiquido2_Aluguel = rentNetProfits;
    const lucroLiquido2_Meia = meiaNetProfits;
    const lucroLiquido2 = rentNetProfits + meiaNetProfits;

    // "O lucro líquido1 só incide sobre o que foi gerado com os animais Próprios. Os custos da fazenda só incidem sobre os próprios."
    // reportData.total is farm general expenses + employee payroll during the interval
    const farmGeneralCosts = reportData.total;
    const lucroLiquido1 = ownSoldNetProfits - farmGeneralCosts;

    // "Crie o lucro bruto total e lucro líquido"
    const lucroLiquidoTotal = lucroLiquido1 + lucroLiquido2;

    return {
      ownPurchaseInvested,
      soldHeadCounts,
      totalFreight,
      totalFunrural,
      totalTaxes,
      totalOtherExpenses,
      totalSalesOverheads,
      
      ownSoldGrossRevenue,
      ownSoldPurchaseCost,
      ownSoldGrossProfit,
      ownSoldNetProfits,

      rentRevenue,
      rentNetProfits,
      meiaRevenue,
      meiaNetProfits,

      lucroBrutoTotal,
      lucroLiquido2_Aluguel,
      lucroLiquido2_Meia,
      lucroLiquido2,
      lucroLiquido1,
      lucroLiquidoTotal,
      farmGeneralCosts
    };
  }, [animals, reportData]);

  // Inventory/Store stock report computing
  const stockInventoryReport = useMemo(() => {
    let totalStockValue = 0;
    const categoryAllocation: Record<string, { heads: number, val: number }> = {};
    const supplierAllocation: Record<string, number> = {};

    inventory.forEach(item => {
      const value = (item.quantity || 0) * (item.price || 0);
      totalStockValue += value;

      const cat = item.category || 'Geral';
      if (!categoryAllocation[cat]) categoryAllocation[cat] = { heads: 0, val: 0 };
      categoryAllocation[cat].heads += item.quantity || 0;
      categoryAllocation[cat].val += value;

      // store name tracker
      const shopName = item.shopName || 'Não Informada';
      supplierAllocation[shopName] = (supplierAllocation[shopName] || 0) + value;
    });

    return {
      totalStockValue,
      categories: Object.entries(categoryAllocation).map(([name, data]) => ({ name, ...data })),
      suppliers: Object.entries(supplierAllocation).map(([name, value]) => ({ name, value }))
    };
  }, [inventory]);

  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Theme setup colors
    const darkForest = [45, 76, 54]; // #2d4c38 primary
    const textGray = [60,60,60];
    
    let y = 15;
    const pageHeight = 297;
    
    const checkNewPage = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 20) {
        doc.addPage();
        y = 15;
        // Minor Header line on subsequent pages
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("FAZENDA ONLINE • RELATÓRIO OPERACIONAL CONSOLIDADO", 15, y);
        doc.setDrawColor(220, 220, 220);
        doc.line(15, y + 2, 195, y + 2);
        y += 10;
      }
    };

    // 1. HEADER BANNER
    doc.setFillColor(34, 53, 39); // deep forest
    doc.rect(15, y, 180, 25, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("RELATÓRIO CONSOLIDADO DE GESTÃO AGROPECUÁRIA", 22, y + 9);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(230, 243, 234);
    doc.text(`Fazenda: ${settings?.farmName || "Fazenda Online"}  •  Cidade: ${settings?.city || "Sede Rural"}`, 22, y + 16);
    doc.text(`Período de Análise: ${format(dateInterval.start, 'dd/MM/yyyy')} a ${format(dateInterval.end, 'dd/MM/yyyy')}`, 22, y + 21);
    
    y += 33;

    // 2. SUMMARY DASHBOARD (METRICS PANEL)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(34, 53, 39);
    doc.text("RESUMO EXECUTIVO DO NEGÓCIO - DASHBOARD", 15, y);
    doc.line(15, y + 2, 195, y + 2);
    y += 8;

    doc.setFillColor(245, 247, 244);
    doc.rect(15, y, 180, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text("CONTROLE DO REBANHO", 20, y + 6);
    doc.text("COMPLEMENTOS COMERCIAIS", 80, y + 6);
    doc.text("BALANÇO GERAL FINANCEIRO", 140, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(34, 53, 39);
    const totalHeadsInPasto = animals.reduce((sum, a) => sum + (a.isSold ? 0 : a.quantity), 0);
    doc.text(`${totalHeadsInPasto} Cabeças Ativas`, 20, y + 13);
    doc.text(`R$ ${tradingAnalysis.lucroBrutoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} Gross`, 80, y + 13);
    
    const profitColor = tradingAnalysis.lucroLiquidoTotal >= 0 ? [22, 101, 52] : [153, 27, 27];
    doc.setTextColor(profitColor[0], profitColor[1], profitColor[2]);
    doc.text(`R$ ${tradingAnalysis.lucroLiquidoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, y + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`${animals.filter(a => !a.isSold).length} Lotes nos Pastos`, 20, y + 19);
    doc.text(`${tradingAnalysis.soldHeadCounts} Cab. Comercializadas`, 80, y + 19);
    doc.text(`Lucro Líquido Realizadoizado`, 140, y + 19);

    y += 32;

    // 3. FINANCIAL ANALYSIS DETAIL
    checkNewPage(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(34, 53, 39);
    doc.text("1. INFORME FINANCEIRO E FLUXO DE CAIXA OPERACIONAL", 15, y);
    doc.line(15, y + 2, 110, y + 2);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text("Lucro Líquido 1 (Somente Gado Próprio, Descontando Despesas):", 15, y);
    doc.setTextColor(tradingAnalysis.lucroLiquido1 >= 0 ? 30 : 150, tradingAnalysis.lucroLiquido1 >= 0 ? 100 : 30, 30);
    doc.text(`R$ ${tradingAnalysis.lucroLiquido1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 145, y);
    y += 6;

    doc.setTextColor(40, 40, 40);
    doc.text("Lucro Líquido 2 (Parceria Rural Meia-Meia & Estadias de Aluguel):", 15, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 53, 39);
    doc.text(`R$ ${tradingAnalysis.lucroLiquido2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 145, y);
    y += 5.5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("  - Subtotal Receita Parceria (Meia):", 20, y);
    doc.text(`R$ ${tradingAnalysis.lucroLiquido2_Meia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 145, y);
    y += 5;

    doc.text("  - Subtotal Receita Aluguel (Pastagem):", 20, y);
    doc.text(`R$ ${tradingAnalysis.lucroLiquido2_Aluguel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 145, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("Custos Gerais Fechados do Intervalo (Contas + Salários):", 15, y);
    doc.setTextColor(180, 40, 40);
    doc.text(`R$ ${reportData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 145, y);
    
    y += 11;

    // 4. LIVESTOCK AND ZOOTECHNICAL AUDITING
    checkNewPage(65);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(34, 53, 39);
    doc.text("2. DIAGNÓSTICO ZOOTÉCNICO E CENSO DO REBANHO", 15, y);
    doc.line(15, y + 2, 110, y + 2);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text("Carga de Gado Ativo Filtrada por Categoria:", 15, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    cattleAnalyticsGrouped.categories.forEach(cat => {
      doc.text(`• ${cat.name}:`, 20, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${cat.heads} Cabeças  (divididos em ${cat.count} lotes cadastrados)`, 80, y);
      doc.setFont("helvetica", "normal");
      y += 5;
    });

    y += 4;
    checkNewPage(50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text("Divisão e Investimento por Raça dos Animais:", 15, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    cattleAnalyticsGrouped.breeds.forEach(br => {
      doc.text(`• Raça / Cruzamento: ${br.name}:`, 20, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${br.heads} Cabeças  • Compra Estimada: R$ ${br.costs.toLocaleString('pt-BR')}`, 80, y);
      doc.setFont("helvetica", "normal");
      y += 5;
    });

    // 5. DETAILED ANIMAL LOTS TABLE
    y += 6;
    checkNewPage(55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(34, 53, 39);
    doc.text("ANEXO: LISTAGEM COMPLETA DOS LOTES DO REBANHO", 15, y);
    doc.line(15, y + 1.5, 195, y + 1.5);
    y += 7;

    // Table Headers
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text("Lote / Identificador", 16, y);
    doc.text("Regime", 55, y);
    doc.text("Categoria", 85, y);
    doc.text("Cab.", 115, y);
    doc.text("Pasto", 128, y);
    doc.text("Data Entrada", 155, y);
    doc.text("Peso Médio", 178, y);

    doc.setDrawColor(200, 200, 200);
    doc.line(15, y + 1.8, 195, y + 1.8);
    y += 6;

    // Table Rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);

    animals.forEach(anim => {
      checkNewPage(8);
      const pastureObject = pastures.find(p => p.id === anim.currentPastureId);
      const pastureStr = anim.isSold ? "Vendido" : (pastureObject ? pastureObject.name : "N/D");
      
      doc.text(`${anim.lotName}`, 16, y);
      doc.text(`${anim.type}`, 55, y);
      doc.text(`${anim.category}`, 85, y);
      doc.text(`${anim.quantity}`, 115, y);
      doc.text(`${pastureStr}`, 128, y);
      doc.text(anim.entryDate ? format(new Date(anim.entryDate), 'dd/MM/yyyy') : 'N/D', 155, y);
      doc.text(`${anim.averageWeight} kg`, 178, y);
      
      y += 4.5;
    });

    // Footer signature notice
    y += 6;
    checkNewPage(20);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text("* Documento Oficial Automatizado gerado em conformidade com as diretivas zootécnicas locais.", 15, y);
    doc.text(`Identificador do Relatório: UID_${Math.random().toString(36).substring(2,8).toUpperCase()}  -  Sede Central`, 15, y + 4);

    doc.save(`Fazenda_PDF_Relatorio_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Month-over-month expenses comparison (fixed vs variable)
  const monthlyComparisonData = useMemo(() => {
    const data: Record<string, { monthLabel: string; monthKey: string; variable: number; fixed: number }> = {};
    const totalFixed = fixedExpenses?.reduce((sum, f) => sum + (f.value || 0), 0) || 0;
    const today = new Date();
    
    // Generate the last 6 months dynamically to ensure the chart is populated
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = format(d, 'yyyy-MM');
      const monthLabel = format(d, 'MMM/yy', { locale: ptBR });
      data[monthKey] = {
        monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        monthKey,
        variable: 0,
        fixed: totalFixed
      };
    }
    
    // Add standard variable expenses into their respective months
    expenses?.forEach(e => {
      if (!e.date) return;
      try {
        const d = new Date(e.date);
        const monthKey = format(d, 'yyyy-MM');
        if (data[monthKey]) {
          data[monthKey].variable += e.value || 0;
        } else {
          const diffMs = today.getTime() - d.getTime();
          const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.4);
          if (diffMonths >= 0 && diffMonths <= 12) {
            const monthLabel = format(d, 'MMM/yy', { locale: ptBR });
            data[monthKey] = {
              monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
              monthKey,
              variable: e.value || 0,
              fixed: totalFixed
            };
          }
        }
      } catch (err) {
        console.error("Error formatting date in monthlyComparisonData", err);
      }
    });

    return Object.keys(data)
      .sort((a, b) => a.localeCompare(b))
      .map(key => data[key]);
  }, [expenses, fixedExpenses]);

  return (
    <div className="space-y-8">
      {/* Upper Report Deck Navigation with PDF export */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <div className="flex bg-white dark:bg-zinc-900 dark:border-zinc-800 p-1 rounded-2xl border border-[#e5e0d8] shadow-sm w-fit min-w-max">
            <button 
              onClick={() => setActiveTab('financial')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${
                activeTab === 'financial' ? 'bg-[#3d5a45] text-white shadow-sm' : 'text-[#8d8a86] hover:bg-[#fcfaf7]'
              }`}
            >
              <Coins size={15} /> 1. Fluxo Financeiro (Geral)
            </button>
            
            <button 
              onClick={() => setActiveTab('employees')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${
                activeTab === 'employees' ? 'bg-[#3d5a45] text-white shadow-sm' : 'text-[#8d8a86] hover:bg-[#fcfaf7]'
              }`}
            >
              <Users size={15} /> 2. Despesas de Funcionários
            </button>

            <button 
              onClick={() => setActiveTab('livestock')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${
                activeTab === 'livestock' ? 'bg-[#3d5a45] text-white shadow-sm' : 'text-[#8d8a86] hover:bg-[#fcfaf7]'
              }`}
            >
              <Beef size={15} /> 3. Estatísticas de Animais
            </button>

            <button 
              onClick={() => setActiveTab('commercial')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${
                activeTab === 'commercial' ? 'bg-[#3d5a45] text-white shadow-sm' : 'text-[#8d8a86] hover:bg-[#fcfaf7]'
              }`}
            >
              <Warehouse size={15} /> 4. Comercialização & Estoque
            </button>
          </div>
        </div>
        
        <button
          onClick={handleExportPDF}
          className="px-5 py-3 bg-rose-600 dark:bg-rose-700 hover:bg-rose-700 dark:hover:bg-rose-800 text-white rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none w-full lg:w-auto"
        >
          <Printer size={15} /> Exportar Relatório PDF
        </button>
      </div>

      {/* Control Area: Shared date criteria filter (only applies to Financial Flow logs rendering) */}
      {activeTab === 'financial' && (
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-5 rounded-3xl border border-[#e5e0d8] shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 bg-[#fcfaf7] p-0.5 rounded-xl border">
            <button
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${reportType === 'monthly' ? 'bg-[#3d5a45] text-white' : 'text-[#8d8a86]'}`}
            >
              Mês Completo
            </button>
            <button
              onClick={() => setReportType('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${reportType === 'daily' ? 'bg-[#3d5a45] text-white' : 'text-[#8d8a86]'}`}
            >
              Resumo Diário
            </button>
            <button
              onClick={() => setReportType('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${reportType === 'custom' ? 'bg-[#3d5a45] text-white' : 'text-[#8d8a86]'}`}
            >
              Personalizado
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {reportType === 'monthly' && (
              <input 
                type="month" 
                className="px-4 py-2 bg-[#fcfaf7] border border-[#e5e0d8] rounded-xl font-bold text-xs text-[#3d5a45] focus:outline-none"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            )}
            {reportType === 'daily' && (
              <input 
                type="date" 
                className="px-4 py-2 bg-[#fcfaf7] border border-[#e5e0d8] rounded-xl font-bold text-xs text-[#3d5a45] focus:outline-none"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            )}
            {reportType === 'custom' && (
              <div className="flex items-center gap-2 text-xs">
                <input 
                  type="date" 
                  className="px-3 py-1.5 bg-[#fcfaf7] border rounded-xl font-bold"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="font-bold text-[#8d8a86]">até</span>
                <input 
                  type="date" 
                  className="px-3 py-1.5 bg-[#fcfaf7] border rounded-xl font-bold"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}


      {/* TAB CONTENTS RENDER DECKS */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: GENERAL FINANCIAL FLOW REPORT */}
        {activeTab === 'financial' && (
          <motion.div 
            key="financial"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-[#e5e0d8] shadow-sm">
                <div className="flex justify-between items-baseline mb-6">
                  <h3 className="font-serif italic text-lg font-bold text-[#3d5a45]">Balancete Geral de Caixa</h3>
                  <span className="text-[10px] font-black uppercase text-[#8d8a86] tracking-widest">
                    Período: {reportType === 'monthly' ? format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: ptBR }) : reportType === 'daily' ? format(parseISO(selectedDate), 'dd/MM/yyyy') : 'Customizado'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-[#8d8a86] block">Total Desembolsos Caixa</span>
                    <span className="text-2xl font-black text-red-650">R$ {reportData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[10px] text-red-850 font-semibold block mt-1">{reportData.countExp + reportData.countPay} notas lançadas</span>
                  </div>
                  <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-[#8d8a86] block">Custo rateado por cabeça ativa</span>
                    <span className="text-2xl font-black text-emerald-800">
                      R$ {animals.length > 0 ? (reportData.total / animals.reduce((a,c) => a + (c.isSold ? 0 : c.quantity), 0)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : 0}
                    </span>
                    <span className="text-[10px] text-emerald-800 font-semibold block mt-1">Dividido por {animals.reduce((a,c) => a + (c.isSold ? 0 : c.quantity), 0)} cabeças ativas</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <h4 className="text-xs font-black uppercase text-slate-800 pb-1.5 border-b">Detalhamento dos Custos no Período</h4>
                  {[...reportData.expenses, ...reportData.payments]
                    .sort((a,b) => ('value' in b ? b.value : b.totalValue) - ('value' in a ? a.value : a.totalValue))
                    .map((item, idx) => {
                      const isExpense = 'value' in item;
                      const value = isExpense ? item.value : item.totalValue;
                      const title = isExpense ? item.description : `Salário p/ ${item.employeeName}`;
                      const tag = isExpense ? item.type : item.paymentType;
                      
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs py-2 px-1 border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                          <div>
                            <span className="font-extrabold text-slate-800 block">{title}</span>
                            <span className="text-[9px] text-[#8d8a86] uppercase font-bold">{tag} • {format(new Date(item.date), 'dd/MM/yyyy')}</span>
                          </div>
                          <span className="font-black text-red-600">- R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })}
                  
                  {[...reportData.expenses, ...reportData.payments].length === 0 && (
                    <div className="text-center py-10 text-xs italic text-[#8d8a86] bg-[#fcfaf7] border rounded-2xl">
                      Nenhuma saída documentada no período filtrado.
                    </div>
                  )}
                </div>
              </div>

              {/* Month-by-month Fixed vs Variable Expenses comparative bar chart */}
              <div className="bg-white p-8 rounded-3xl border border-[#e5e0d8] shadow-sm space-y-4">
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="font-serif italic text-lg font-bold text-[#3d5a45] dark:text-[#5fa875]">Comparativo Trimestral de Custos</h3>
                  <span className="text-[10px] font-black uppercase text-[#8d8a86] tracking-widest">
                    Previsibilidade (Fixo vs Variável)
                  </span>
                </div>
                <p className="text-xs text-[#8d8a86] mb-4">
                  Visualização da previsibilidade financeira. Despesas fixas recorrentes comparadas aos desembolsos variáveis de consumo e serviços lançados em cada período.
                </p>
                <div className="h-64 w-full text-xs font-semibold pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-10" />
                      <XAxis 
                        dataKey="monthLabel" 
                        tick={{ fill: '#888888', fontSize: 10 }}
                        axisLine={{ stroke: '#e5e7eb', className: 'dark:opacity-10' }}
                      />
                      <YAxis 
                        tick={{ fill: '#888888', fontSize: 10 }}
                        axisLine={{ stroke: '#e5e7eb', className: 'dark:opacity-10' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          borderColor: '#3D5A45', 
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: '#1f2937'
                        }}
                        formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Bar dataKey="fixed" name="Custos Fixos Comitantes" fill="#3D5A45" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="variable" name="Custos Variáveis Lançados" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quick status dashboard item */}
            <div className="space-y-6">
              <div className="bg-[#3d5a45] p-6 rounded-3xl text-white space-y-4">
                <span className="text-xs font-bold opacity-75 uppercase block select-none">Investimento Ativo no pasto</span>
                <div className="text-3xl font-black">
                  R$ {animals.reduce((a,c) => a + (c.isSold ? 0 : (c.purchasePrice || 0) * c.quantity), 0).toLocaleString('pt-BR')}
                </div>
                <div className="text-xs opacity-80 leading-relaxed font-medium">Representa o patrimônio vivo e estático investido nas cabeças de gado de posse própria que estão engordando na fazenda hoje.</div>
              </div>

              {/* Demonstrativo Geral de Caixa & Lucros */}
              <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm space-y-5">
                <div className="border-b pb-3">
                  <h4 className="font-serif italic text-[#3d5a45] font-black text-sm block">Demonstrativo de Resultados</h4>
                  <p className="text-[10px] text-neutral-500 font-semibold leading-relaxed">
                    Balançantes de Lucro discriminados por categoria de posse.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-neutral-700">LUCRO BRUTO TOTAL:</span>
                    <span className="font-black text-sm text-slate-800">
                      R$ {tradingAnalysis.lucroBrutoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-dashed">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-bold text-[#2d2a26]">
                        Rendimento Próprios (LL1):
                      </span>
                      <span className="font-black text-sm text-[#3d5a45]">
                        R$ {tradingAnalysis.lucroLiquido1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#8d8a86] block leading-none">
                      (Vendas Próprias menos custos operacionais da fazenda: -R$ {tradingAnalysis.farmGeneralCosts.toLocaleString()})
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-dashed space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-[#2d2a26]">
                        Rendimento Meia/Aluguel (LL2):
                      </span>
                      <span className="font-black text-sm text-[#3d5a45]">
                        R$ {tradingAnalysis.lucroLiquido2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#8d8a86] block mb-2 leading-none">
                      (Itemizado abaixo e unificado no LL2)
                    </span>
                    <div className="grid grid-cols-2 gap-2 bg-[#fcfaf7] p-2 rounded-xl text-[10px] font-semibold border">
                      <div>
                        <span className="text-[#8d8a86] uppercase text-[8px] block">Aluguel LL2:</span>
                        <span className="font-bold text-slate-800">
                          R$ {tradingAnalysis.lucroLiquido2_Aluguel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8d8a86] uppercase text-[8px] block">Parceria Meia LL2:</span>
                        <span className="font-bold text-slate-800">
                          R$ {tradingAnalysis.lucroLiquido2_Meia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t-2 border-[#3d5a45] bg-emerald-50/20 p-3 rounded-2xl flex justify-between items-baseline">
                    <span className="text-xs font-black text-emerald-900">LUCRO LÍQUIDO FINAL:</span>
                    <span className="font-black text-lg text-emerald-800">
                      R$ {tradingAnalysis.lucroLiquidoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50/50 p-5 rounded-3xl border border-orange-100 space-y-3">
                <span className="text-xs font-black text-orange-850 uppercase block flex items-center gap-1.5"><BadgeInfo size={14} /> Dicas de Caixa</span>
                <p className="text-[11px] text-orange-950 font-medium leading-relaxed leading-relaxed">Procure manter o custo operacional médio abaixo da proporção mensal ideal. Monitore as pesagens e o ganho médio diário (GMD) do gado para garantir que a taxa de conversão nutricional cubra o caixa!</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: WORKFORCE PAYROLL/EMPLOYEE STATUS REPORT */}
        {activeTab === 'employees' && (
          <motion.div 
            key="employees"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Quick Payroll role stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {employeeRolesBreakdownList(employeePaymentsBreakdown.roles)}
            </div>

            <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm space-y-5">
              <div className="flex justify-between items-center pb-3 border-b">
                <div>
                  <h3 className="font-serif italic text-lg font-bold text-[#3d5a45]">Acompanhamento e Custos de Pessoal</h3>
                  <p className="text-xs text-[#8d8a86]">Exibe datas importantes, contratos ativos, férias e total acumulado pago a cada colaborador.</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#8d8a86] uppercase">Filtrar Colaborador:</span>
                  <select 
                    className="px-3 py-1.5 border rounded-xl text-xs bg-white font-bold text-slate-800 focus:outline-none"
                    value={focusedEmployeeId}
                    onChange={(e) => setFocusedEmployeeId(e.target.value)}
                  >
                    <option value="ALL">Todos os Funcionários</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#f0f0f0] text-[#8d8a86] font-black uppercase tracking-wider text-[10px]">
                      <th className="pb-3 pr-2">Colaborador / Cargo</th>
                      <th className="pb-3 pr-2">Admissão</th>
                      <th className="pb-3 pr-2">Status</th>
                      <th className="pb-3 pr-2">Próximas Férias</th>
                      <th className="pb-3 pr-2">Aviso Prévio</th>
                      <th className="pb-3 text-right">Desembolso Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeePaymentsBreakdown.individuals
                      .filter(row => focusedEmployeeId === 'ALL' || row.emp.id === focusedEmployeeId)
                      .map(({ emp, stats }) => (
                        <tr key={emp.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                          <td className="py-3">
                            <span className="font-black text-slate-800 block text-sm">{emp.name}</span>
                            <span className="text-[10px] text-[#8d8a86] font-extrabold uppercase flex items-center gap-1 mt-0.5"><Briefcase size={10} /> {emp.role}</span>
                          </td>
                          <td className="py-3 font-semibold text-slate-700">
                            {emp.admissionDate ? format(new Date(emp.admissionDate), 'dd/MM/yyyy') : 'N/A'}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                              emp.status === 'active' ? 'bg-green-150 text-green-800' :
                              emp.status === 'vacation' ? 'bg-sky-100 text-sky-800' :
                              emp.status === 'notice' ? 'bg-orange-100 text-orange-850' : 'bg-red-100 text-red-800'
                            }`}>
                              {emp.status === 'active' ? 'Ativo' : emp.status === 'vacation' ? 'Férias' : emp.status === 'notice' ? 'Aviso Prévio' : 'Desligado'}
                            </span>
                          </td>
                          <td className="py-3 font-semibold text-amber-900">
                            {emp.vacationDate ? format(new Date(emp.vacationDate), 'dd/MM/yyyy') : (
                              <span className="text-[#8d8a86] italic font-normal">Não Agendadas</span>
                            )}
                          </td>
                          <td className="py-3 font-medium text-orange-950">
                            {emp.noticeDate ? format(new Date(emp.noticeDate), 'dd/MM/yyyy') : (
                              <span className="text-[#8d8a86] italic font-normal">Nenhum</span>
                            )}
                          </td>
                          <td className="py-3 text-right font-black text-[#3d5a45] text-sm">
                            R$ {stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            <span className="text-[10px] text-[#8d8a86] font-normal block">{stats.paymentsCount} lançamentos</span>
                          </td>
                        </tr>
                      ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 italic text-[#8d8a86]">Nenhum colaborador registrado no cadastro de funcionários.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 3: HERD & ANIMAL PERFORMANCE REPORTS */}
        {activeTab === 'livestock' && (
          <motion.div 
            key="livestock"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6 animate-fade-in"
          >
            {/* Herd classifications summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm">
                <h4 className="font-serif italic text-base font-bold text-[#3d5a45] mb-4">Lotação Total por Categoria</h4>
                <div className="space-y-2">
                  {cattleAnalyticsGrouped.categories.map(cat => (
                    <div key={cat.name} className="flex justify-between items-center text-xs py-1.5 border-b border-neutral-50">
                      <span className="font-bold text-slate-800 uppercase">{cat.name}</span>
                      <span className="font-extrabold text-[#3d5a45]">{cat.heads} cabeças <span className="text-[10px] text-[#8d8a86] font-normal">({cat.count} lotes)</span></span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm">
                <h4 className="font-serif italic text-base font-bold text-[#3d5a45] mb-4">Distribuição do Custo de Compra por Raça</h4>
                <div className="space-y-2">
                  {cattleAnalyticsGrouped.breeds.map(b => (
                    <div key={b.name} className="flex justify-between items-center text-xs py-1.5 border-b border-neutral-50">
                      <span className="font-bold text-slate-800">{b.name}</span>
                      <span className="font-bold text-slate-800">{b.heads} cab. • <span className="font-black text-red-600">R$ {b.costs.toLocaleString()}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Individual lot comprehensive listing */}
            <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm space-y-4">
              <div>
                <h3 className="font-serif italic text-base font-bold text-[#3d5a45]">Inventário Individual de Lotes de Gado</h3>
                <p className="text-xs text-[#8d8a86]">Rastreabilidade detalhada: tipo de posse, ano/data de entrada, peso de nascimento/entrada, peso de comercialização/saída, e tempo total de pastoreamento.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#f0f0f0] text-[#8d8a86] font-black uppercase tracking-wider text-[10px]">
                      <th className="pb-3 pr-2">Lote / Registro</th>
                      <th className="pb-3 pr-2">Tipo / Categoria</th>
                      <th className="pb-3 pr-2">Data Entrada</th>
                      <th className="pb-3 pr-2">Ano Entrada</th>
                      <th className="pb-3 pr-2 text-center">Tempo Fazenda</th>
                      <th className="pb-3 pr-2 text-right">Peso Entrada</th>
                      <th className="pb-3 text-right">Peso Saída Venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAndSoldAnimals.map((a) => (
                      <tr key={a.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                        <td className="py-3">
                          <span className="font-extrabold text-slate-800 block text-sm">{a.lotName}</span>
                          <span className="text-[10px] text-[#8d8a86] font-bold uppercase">{a.breed || 'Sem Raça'} • {a.quantity} cabeças</span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            a.isSold ? 'bg-red-50 text-red-650' : 'bg-green-50 text-green-700'
                          }`}>
                            {a.isSold ? 'Vendido' : a.type}
                          </span>
                          <div className="text-[10px] text-slate-700 font-semibold uppercase mt-0.5">{a.category}</div>
                        </td>
                        <td className="py-3 font-semibold text-slate-700">
                          {format(new Date(a.entryDate), 'dd/MM/yyyy')}
                        </td>
                        <td className="py-3 font-bold text-[#3d5a45] text-center">
                          {a.entryYear}
                        </td>
                        <td className="py-3 text-center text-slate-800 font-bold">
                          {a.stayMonths} meses <span className="text-[10px] text-[#8d8a86] font-normal">({a.stayDays} dias)</span>
                        </td>
                        <td className="py-3 text-right font-bold text-slate-800">
                          {a.averageWeight} kg
                        </td>
                        <td className="py-3 text-right font-black text-emerald-800">
                          {a.isSold && a.saleDetails ? (
                            <span>{a.saleDetails.averageWeight} kg</span>
                          ) : (
                            <span className="text-[#8d8a86] italic font-normal">Ainda no pasto</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 4: COMMERCIAL TRADING OVERHEADS & INVENTORY METRICS */}
        {activeTab === 'commercial' && (
          <motion.div 
            key="commercial"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Purchase vs Sales Overheads cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-5 rounded-3xl border border-[#e5e0d8] shadow-sm flex items-center gap-4">
                <div className="p-4 bg-emerald-50 rounded-full text-emerald-800">
                  <Coins size={28} />
                </div>
                <div>
                  <span className="text-[10px] text-[#8d8a86] uppercase font-black tracking-wider block">Lucro Bruto Total</span>
                  <span className="text-xl font-black text-emerald-800">R$ {tradingAnalysis.lucroBrutoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-[#8d8a86] block mt-0.5">Ciclo total faturado acumulado</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-[#e5e0d8] shadow-sm flex items-center gap-4">
                <div className="p-4 bg-blue-50 rounded-full text-blue-800">
                  <TrendingUp size={28} />
                </div>
                <div>
                  <span className="text-[10px] text-[#8d8a86] uppercase font-black tracking-wider block">Lucro Líquido 1</span>
                  <span className="text-xl font-black text-blue-800">R$ {tradingAnalysis.lucroLiquido1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-[#8d8a86] block mt-0.5">Animais Próprios (com custos fazenda)</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-[#e5e0d8] shadow-sm flex items-center gap-4">
                <div className="p-4 bg-purple-50 rounded-full text-purple-800">
                  <Users size={28} />
                </div>
                <div>
                  <span className="text-[10px] text-[#8d8a86] uppercase font-black tracking-wider block">Lucro Líquido 2 (Aluguel/Meia)</span>
                  <span className="text-xl font-black text-purple-800">R$ {tradingAnalysis.lucroLiquido2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-[#8d8a86] block mt-0.5">Soma de Aluguel + Parceria de Meia</span>
                </div>
              </div>
            </div>

            {/* In-depth Sales expenses breakdown list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm space-y-4">
                <h4 className="font-serif italic text-base font-bold text-[#3d5a45] border-b pb-2">Rateio dos Custos na Venda de Gado</h4>
                
                <div className="space-y-3 font-semibold text-xs text-slate-800">
                  <div className="flex justify-between items-center py-1.5 border-b">
                    <span>Custo Logístico (Frete Transportadora):</span>
                    <span className="font-extrabold text-orange-650">R$ {tradingAnalysis.totalFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b">
                    <span>Funrural Retido (Previdência Rural):</span>
                    <span className="font-extrabold text-orange-650">R$ {tradingAnalysis.totalFunrural.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b">
                    <span>Encargos / Emissão GTA / Impostos:</span>
                    <span className="font-extrabold text-orange-650">R$ {tradingAnalysis.totalTaxes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b">
                    <span>Outros Desembolsos Eventuais de Comércio:</span>
                    <span className="font-extrabold text-orange-650">R$ {tradingAnalysis.totalOtherExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-neutral-50 px-3 rounded-xl">
                    <span className="font-bold">Total Despesas Logística & Comercialização:</span>
                    <span className="font-black text-red-650">R$ {tradingAnalysis.totalSalesOverheads.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Warehouse stock metrics */}
              <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm space-y-4">
                <h4 className="font-serif italic text-base font-bold text-[#3d5a45] border-b pb-2">Patrimônio em Estoque / Depósito (Estoque)</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#e5e0d8]">
                    <span className="text-[9px] uppercase font-bold text-[#8d8a86] block">Ativos em Depósito</span>
                    <span className="font-black text-slate-800 text-lg">R$ {stockInventoryReport.totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#e5e0d8]">
                    <span className="text-[9px] uppercase font-bold text-[#8d8a86] block">Categorias de Insumo</span>
                    <span className="font-black text-slate-800 text-lg">{stockInventoryReport.categories.length} cadastradas</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-[#8d8a86] block">Balanço do Estoque por Categoria</span>
                  {stockInventoryReport.categories.map(cat => (
                    <div key={cat.name} className="flex justify-between items-center text-xs py-1 border-b border-neutral-50">
                      <span className="font-extrabold text-slate-700">{cat.name}</span>
                      <span className="font-black text-[#3d5a45]">R$ {cat.val.toLocaleString()} <span className="text-[10px] text-[#8d8a86] font-normal">({cat.heads} itens)</span></span>
                    </div>
                  ))}

                  {stockInventoryReport.categories.length === 0 && (
                    <div className="text-center text-xs italic text-[#8d8a86] py-4">Nenhum suprimento no depósito.</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// Private widgets helper
function employeeRolesBreakdownList(roles: { role: string, value: number }[]) {
  // list roles
  return EMPLOYEE_ROLES.map((role) => {
    const payment = roles.find(r => r.role === role)?.value || 0;
    return (
      <div key={role} className="bg-white p-4.5 rounded-3xl border border-[#e5e0d8] shadow-sm select-none">
        <span className="text-[9px] font-black text-[#8d8a86] uppercase block leading-none mb-1">{role}</span>
        <span className="text-base font-black text-slate-800 block">R$ {payment.toLocaleString('pt-BR')}</span>
        <span className="text-[9px] font-semibold text-[#3d5a45] uppercase block mt-0.5">Custo De Folha</span>
      </div>
    );
  });
}
