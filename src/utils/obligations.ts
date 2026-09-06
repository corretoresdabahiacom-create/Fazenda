import { FarmTask, Expense, FixedExpense, FarmSettings, Animal, AnimalType, HealthEvent, CropPlan, AccountPayable, AccountReceivable, ReproductionEvent, ReproductionEventType, Pasture, AccountStatus } from '../types';
import { format } from 'date-fns';

export interface ObligationAlert {
  id: string; // unique identifier for the alert item
  type: 'task' | 'variable_expense' | 'fixed_expense' | 'animal_rent' | 'vaccine' | 'crop_planting' | 'crop_harvest' | 'account_payable' | 'account_receivable' | 'weaning' | 'pasture_rotation';
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD format
  daysRemaining: number;
  value?: number;
  originalId: string;
  originalItem: any;
}

// Parse string "YYYY-MM-DD" to local midnight Date
export function parseLocalISO(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Get modern local today Date at midnight
export function getLocalToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Calculate days difference
export function getDaysDiff(targetDate: Date, baseDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = targetDate.getTime() - baseDate.getTime();
  return Math.round(diffTime / oneDay);
}

// Get padded string for month/day
export function padZero(num: number): string {
  return String(num).padStart(2, '0');
}

export function computeObligations(
  tasks: FarmTask[],
  expenses: Expense[],
  fixedExpenses: FixedExpense[],
  settings: FarmSettings,
  animals: Animal[] = [],
  healthEvents: HealthEvent[] = [],
  cropPlans: CropPlan[] = [],
  accountsPayable: AccountPayable[] = [],
  accountsReceivable: AccountReceivable[] = [],
  reproductionEvents: ReproductionEvent[] = [],
  pastures: Pasture[] = []
): ObligationAlert[] {
  const alerts: ObligationAlert[] = [];
  const today = getLocalToday();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth(); // 0-11
  
  const concludedKeys = settings.concludedObligations || [];

  // 1. Process Tasks
  tasks.forEach(task => {
    // Only process incomplete tasks with a valid dueDate
    if (!task.completed && task.dueDate) {
      try {
        const dueDate = parseLocalISO(task.dueDate);
        const daysRemaining = getDaysDiff(dueDate, today);
        
        // Notify 3 days before, on the day, or past due
        if (daysRemaining <= 3) {
          alerts.push({
            id: `task-${task.id}`,
            type: 'task',
            title: `Tarefa Pendente: ${task.title}`,
            description: task.description || 'Sem descrição',
            dueDate: task.dueDate,
            daysRemaining,
            originalId: task.id,
            originalItem: task
          });
        }
      } catch (e) {
        console.error('Error parsing task date', e);
      }
    }
  });

  // 2. Process Variable Expenses
  expenses.forEach(exp => {
    // Only process unpaid expenses with a valid dueDate
    const isPaid = exp.status === 'paid';
    if (!isPaid && exp.dueDate) {
      try {
        const dueDate = parseLocalISO(exp.dueDate);
        const daysRemaining = getDaysDiff(dueDate, today);
        
        // Notify 3 days before, on the day, or past due
        if (daysRemaining <= 3) {
          alerts.push({
            id: `expense-${exp.id}`,
            type: 'variable_expense',
            title: `Despesa a Pagar: ${exp.description}`,
            description: `Categoria: ${exp.type}${exp.provider ? ` | Fornecedor: ${exp.provider}` : ''}`,
            dueDate: exp.dueDate,
            daysRemaining,
            value: exp.value,
            originalId: exp.id,
            originalItem: exp
          });
        }
      } catch (e) {
        console.error('Error parsing expense date', e);
      }
    }
  });

  // 3. Process Recurring Fixed Expenses
  // We check occurrences for:
  // - Previous Month (in case they didn't pay it yet and it is overdue)
  // - Current Month
  fixedExpenses.forEach(fixed => {
    if (!fixed.dueDate) return;
    
    const day = Number(fixed.dueDate);
    if (isNaN(day) || day < 1 || day > 31) return;

    // We check current month first
    const getMonthOccurrence = (year: number, monthZeroBased: number) => {
      // Handle months with fewer days (e.g., February 30th -> February 28th)
      const lastDayOfMonth = new Date(year, monthZeroBased + 1, 0).getDate();
      const targetDay = Math.min(day, lastDayOfMonth);
      const dueDateStr = `${year}-${padZero(monthZeroBased + 1)}-${padZero(targetDay)}`;
      return {
        dateStr: dueDateStr,
        date: new Date(year, monthZeroBased, targetDay),
        key: `${fixed.id}-${year}-${padZero(monthZeroBased + 1)}`
      };
    };

    // Current Month Occurrence
    const current = getMonthOccurrence(currentYear, currentMonthNum);
    // Previous Month Occurrence
    const prevMonthNum = currentMonthNum === 0 ? 11 : currentMonthNum - 1;
    const prevYear = currentMonthNum === 0 ? currentYear - 1 : currentYear;
    const previous = getMonthOccurrence(prevYear, prevMonthNum);

    // If previous month was not concluded, it acts as an overdue alert
    if (!concludedKeys.includes(previous.key)) {
      const daysDiffPrev = getDaysDiff(previous.date, today);
      // Since it's previous month, it is definitely overdue helper
      if (daysDiffPrev <= 3) {
        alerts.push({
          id: `fixed-prev-${fixed.id}`,
          type: 'fixed_expense',
          title: `Custo Fixo (Mês Ant.): ${fixed.description}`,
          description: `Referente a ${padZero(prevMonthNum + 1)}/${prevYear} (${fixed.expenseType})`,
          dueDate: previous.dateStr,
          daysRemaining: daysDiffPrev,
          value: fixed.value,
          originalId: fixed.id,
          originalItem: { ...fixed, monthKey: previous.key }
        });
      }
    }

    // Current month occurrence
    if (!concludedKeys.includes(current.key)) {
      const daysDiffCurr = getDaysDiff(current.date, today);
      if (daysDiffCurr <= 3) {
        alerts.push({
          id: `fixed-curr-${fixed.id}`,
          type: 'fixed_expense',
          title: `Custo Fixo: ${fixed.description}`,
          description: `Referente a ${padZero(currentMonthNum + 1)}/${currentYear} (${fixed.expenseType})`,
          dueDate: current.dateStr,
          daysRemaining: daysDiffCurr,
          value: fixed.value,
          originalId: fixed.id,
          originalItem: { ...fixed, monthKey: current.key }
        });
      }
    }
  });

  // 4. Processa Aluguel de Animais (vencimento mensal, mesmo padrão dos
  // Custos Fixos: verifica o mês atual e o anterior, caso ainda não tenha
  // sido marcado como pago).
  animals.forEach(animal => {
    if (animal.type !== AnimalType.RENT || !animal.rentDueDay) return;

    const day = animal.rentDueDay;
    if (isNaN(day) || day < 1 || day > 31) return;

    const getMonthOccurrence = (year: number, monthZeroBased: number) => {
      const lastDayOfMonth = new Date(year, monthZeroBased + 1, 0).getDate();
      const targetDay = Math.min(day, lastDayOfMonth);
      const dueDateStr = `${year}-${padZero(monthZeroBased + 1)}-${padZero(targetDay)}`;
      return {
        dateStr: dueDateStr,
        date: new Date(year, monthZeroBased, targetDay),
        key: `animal-rent-${animal.id}-${year}-${padZero(monthZeroBased + 1)}`
      };
    };

    const current = getMonthOccurrence(currentYear, currentMonthNum);
    const prevMonthNum = currentMonthNum === 0 ? 11 : currentMonthNum - 1;
    const prevYear = currentMonthNum === 0 ? currentYear - 1 : currentYear;
    const previous = getMonthOccurrence(prevYear, prevMonthNum);

    const monthlyValue = animal.rentValue && animal.quantity ? animal.rentValue * animal.quantity : animal.rentValue;

    // Mês anterior — se não foi pago, conta como atrasado.
    if (!concludedKeys.includes(previous.key)) {
      const daysDiffPrev = getDaysDiff(previous.date, today);
      if (daysDiffPrev <= 3) {
        alerts.push({
          id: `animal-rent-prev-${animal.id}`,
          type: 'animal_rent',
          title: `Aluguel (Mês Ant.): ${animal.lotName || 'Lote'}`,
          description: `Referente a ${padZero(prevMonthNum + 1)}/${prevYear}${animal.ownerName ? ` | ${animal.ownerName}` : ''}`,
          dueDate: previous.dateStr,
          daysRemaining: daysDiffPrev,
          value: monthlyValue,
          originalId: animal.id,
          originalItem: { ...animal, monthKey: previous.key }
        });
      }
    }

    // Mês atual — só aparece "vencendo hoje" a partir das 8h da manhã;
    // antes disso, ainda conta como "1 dia restante" (aviso, não urgente).
    if (!concludedKeys.includes(current.key)) {
      let daysDiffCurr = getDaysDiff(current.date, today);
      if (daysDiffCurr === 0 && new Date().getHours() < 8) {
        daysDiffCurr = 1;
      }
      if (daysDiffCurr <= 3) {
        alerts.push({
          id: `animal-rent-curr-${animal.id}`,
          type: 'animal_rent',
          title: `Aluguel: ${animal.lotName || 'Lote'}`,
          description: `Referente a ${padZero(currentMonthNum + 1)}/${currentYear}${animal.ownerName ? ` | ${animal.ownerName}` : ''}`,
          dueDate: current.dateStr,
          daysRemaining: daysDiffCurr,
          value: monthlyValue,
          originalId: animal.id,
          originalItem: { ...animal, monthKey: current.key }
        });
      }
    }
  });

  // 5. Vacinas / Vermífugos (reforço/vencimento)
  healthEvents.forEach(h => {
    if (!h.nextDoseDate) return;
    const dueDate = parseLocalISO(h.nextDoseDate);
    const daysRemaining = getDaysDiff(dueDate, today);
    if (daysRemaining <= 3 && !concludedKeys.includes(`vaccine-${h.id}`)) {
      alerts.push({
        id: `vaccine-${h.id}`,
        type: 'vaccine',
        title: `${h.type}: ${h.productName}`,
        description: `Animal ${h.animalEarTag}${h.veterinarian ? ` | Vet: ${h.veterinarian}` : ''}`,
        dueDate: h.nextDoseDate,
        daysRemaining,
        originalId: h.id,
        originalItem: h
      });
    }
  });

  // 6. Plantio e Colheita (Planejamento Agrícola)
  cropPlans.forEach(c => {
    if (c.plantingDateEstimate && !concludedKeys.includes(`crop-plant-${c.id}`)) {
      const dueDate = parseLocalISO(c.plantingDateEstimate);
      const daysRemaining = getDaysDiff(dueDate, today);
      if (daysRemaining <= 3) {
        alerts.push({
          id: `crop-plant-${c.id}`,
          type: 'crop_planting',
          title: `Plantio: ${c.cultura}`,
          description: c.safra ? `Safra ${c.safra}` : 'Plantio planejado',
          dueDate: c.plantingDateEstimate,
          daysRemaining,
          originalId: c.id,
          originalItem: c
        });
      }
    }
    if (c.harvestDateEstimate && !concludedKeys.includes(`crop-harvest-${c.id}`)) {
      const dueDate = parseLocalISO(c.harvestDateEstimate);
      const daysRemaining = getDaysDiff(dueDate, today);
      if (daysRemaining <= 3) {
        alerts.push({
          id: `crop-harvest-${c.id}`,
          type: 'crop_harvest',
          title: `Colheita: ${c.cultura}`,
          description: c.safra ? `Safra ${c.safra}` : 'Colheita planejada',
          dueDate: c.harvestDateEstimate,
          daysRemaining,
          originalId: c.id,
          originalItem: c
        });
      }
    }
  });

  // 7. Financeiro — Contas a Pagar e a Receber (duplicata, boleto, pagamentos)
  accountsPayable.forEach(a => {
    if (!a.dueDate || a.status === AccountStatus.PAGO) return;
    if (concludedKeys.includes(`account-payable-${a.id}`)) return;
    const dueDate = parseLocalISO(a.dueDate);
    const daysRemaining = getDaysDiff(dueDate, today);
    if (daysRemaining <= 3) {
      alerts.push({
        id: `account-payable-${a.id}`,
        type: 'account_payable',
        title: `A Pagar: ${a.description}`,
        description: 'Financeiro',
        dueDate: a.dueDate,
        daysRemaining,
        value: a.value,
        originalId: a.id,
        originalItem: a
      });
    }
  });

  accountsReceivable.forEach(a => {
    if (!a.dueDate || a.status === AccountStatus.PAGO) return;
    if (concludedKeys.includes(`account-receivable-${a.id}`)) return;
    const dueDate = parseLocalISO(a.dueDate);
    const daysRemaining = getDaysDiff(dueDate, today);
    if (daysRemaining <= 3) {
      alerts.push({
        id: `account-receivable-${a.id}`,
        type: 'account_receivable',
        title: `A Receber: ${a.description}`,
        description: 'Financeiro',
        dueDate: a.dueDate,
        daysRemaining,
        value: a.value,
        originalId: a.id,
        originalItem: a
      });
    }
  });

  // 8. Apartação/Desmama — calculada automaticamente a partir do Parto
  // (não precisa cadastrar de novo: assim que um Parto é registrado em
  // Pecuária Profissional > Reprodução, a previsão de desmama já é
  // estimada em ~210 dias, padrão comum para bovinos de corte).
  const DIAS_ATE_DESMAMA = 210;
  reproductionEvents.forEach(r => {
    if (r.type !== ReproductionEventType.PARTO || !r.date) return;
    if (concludedKeys.includes(`weaning-${r.id}`)) return;
    const birthDate = parseLocalISO(r.date);
    const weaningDate = new Date(birthDate);
    weaningDate.setDate(weaningDate.getDate() + DIAS_ATE_DESMAMA);
    const daysRemaining = getDaysDiff(weaningDate, today);
    if (daysRemaining <= 3) {
      alerts.push({
        id: `weaning-${r.id}`,
        type: 'weaning',
        title: `Apartar/Desmamar: ${r.offspringEarTag || 'cria de ' + r.animalEarTag}`,
        description: `Nascido em ${format(birthDate, 'dd/MM/yyyy')} — previsão de desmama (~${DIAS_ATE_DESMAMA} dias)`,
        dueDate: `${weaningDate.getFullYear()}-${padZero(weaningDate.getMonth() + 1)}-${padZero(weaningDate.getDate())}`,
        daysRemaining,
        originalId: r.id,
        originalItem: r
      });
    }
  });

  // 9. Remanejo de Pasto
  pastures.forEach(p => {
    if (!p.nextRotationDate || concludedKeys.includes(`pasture-rotation-${p.id}`)) return;
    const dueDate = parseLocalISO(p.nextRotationDate);
    const daysRemaining = getDaysDiff(dueDate, today);
    if (daysRemaining <= 3) {
      alerts.push({
        id: `pasture-rotation-${p.id}`,
        type: 'pasture_rotation',
        title: `Remanejo de Pasto: ${p.name}`,
        description: `Pasto nº ${p.number}`,
        dueDate: p.nextRotationDate,
        daysRemaining,
        originalId: p.id,
        originalItem: p
      });
    }
  });

  // Sort alerts: most overdue first (lowest daysremaining), then nearest due date
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
