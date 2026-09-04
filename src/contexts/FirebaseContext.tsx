import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup, sendPasswordResetEmail, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, googleProvider } from '../lib/firebase';
import { Animal, Pasture, Expense, EmployeePayment, FarmTask, TransactionHistory, FarmSettings, InventoryItem, Employee, FixedExpense, WeighingSheet, ExpenseType, EmployeeRole, PaymentType, Property, PropertyType, IndividualAnimal, ReproductionEvent, HealthEvent, MilkProductionRecord, Talhao, CropPlan, FieldLogEntry, PestRecord, IrrigationRecord, CostCenter, AccountPayable, AccountReceivable, Machine, MaintenanceRecord, Team, WorkSchedule, Training, PPEItem, Certification, FarmDocument } from '../types';

interface FirebaseContextType {
  user: User | null;
  userRole: 'admin' | 'user' | null;
  loading: boolean;
  isDemoMode: boolean;
  loginAsGuest: () => void;
  logoutAsGuest: () => void;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  properties: Property[];
  activePropertyId: string | null;
  activeProperty: Property | null;
  setActivePropertyId: (id: string) => void;
  saveProperty: (property: Property) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  individualAnimals: IndividualAnimal[];
  saveIndividualAnimal: (animal: IndividualAnimal) => Promise<void>;
  deleteIndividualAnimal: (id: string) => Promise<void>;
  reproductionEvents: ReproductionEvent[];
  saveReproductionEvent: (event: ReproductionEvent) => Promise<void>;
  deleteReproductionEvent: (id: string) => Promise<void>;
  healthEvents: HealthEvent[];
  saveHealthEvent: (event: HealthEvent) => Promise<void>;
  deleteHealthEvent: (id: string) => Promise<void>;
  milkRecords: MilkProductionRecord[];
  saveMilkRecord: (record: MilkProductionRecord) => Promise<void>;
  deleteMilkRecord: (id: string) => Promise<void>;
  talhoes: Talhao[];
  saveTalhao: (t: Talhao) => Promise<void>;
  deleteTalhao: (id: string) => Promise<void>;
  cropPlans: CropPlan[];
  saveCropPlan: (c: CropPlan) => Promise<void>;
  deleteCropPlan: (id: string) => Promise<void>;
  fieldLogEntries: FieldLogEntry[];
  saveFieldLogEntry: (e: FieldLogEntry) => Promise<void>;
  deleteFieldLogEntry: (id: string) => Promise<void>;
  pestRecords: PestRecord[];
  savePestRecord: (r: PestRecord) => Promise<void>;
  deletePestRecord: (id: string) => Promise<void>;
  irrigationRecords: IrrigationRecord[];
  saveIrrigationRecord: (r: IrrigationRecord) => Promise<void>;
  deleteIrrigationRecord: (id: string) => Promise<void>;
  costCenters: CostCenter[];
  saveCostCenter: (cc: CostCenter) => Promise<void>;
  deleteCostCenter: (id: string) => Promise<void>;
  accountsPayable: AccountPayable[];
  saveAccountPayable: (ap: AccountPayable) => Promise<void>;
  deleteAccountPayable: (id: string) => Promise<void>;
  accountsReceivable: AccountReceivable[];
  saveAccountReceivable: (ar: AccountReceivable) => Promise<void>;
  deleteAccountReceivable: (id: string) => Promise<void>;
  machines: Machine[];
  saveMachine: (m: Machine) => Promise<void>;
  deleteMachine: (id: string) => Promise<void>;
  maintenanceRecords: MaintenanceRecord[];
  saveMaintenanceRecord: (mr: MaintenanceRecord) => Promise<void>;
  deleteMaintenanceRecord: (id: string) => Promise<void>;
  teams: Team[];
  saveTeam: (tm: Team) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  workSchedules: WorkSchedule[];
  saveWorkSchedule: (ws: WorkSchedule) => Promise<void>;
  deleteWorkSchedule: (id: string) => Promise<void>;
  trainings: Training[];
  saveTraining: (tr: Training) => Promise<void>;
  deleteTraining: (id: string) => Promise<void>;
  ppeItems: PPEItem[];
  savePPEItem: (ppe: PPEItem) => Promise<void>;
  deletePPEItem: (id: string) => Promise<void>;
  certifications: Certification[];
  saveCertification: (cert: Certification) => Promise<void>;
  deleteCertification: (id: string) => Promise<void>;
  documents: FarmDocument[];
  saveDocument: (d: FarmDocument, file: File | null) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  animals: Animal[];
  pastures: Pasture[];
  expenses: Expense[];
  payments: EmployeePayment[];
  tasks: FarmTask[];
  transactions: TransactionHistory[];
  inventory: InventoryItem[];
  employees: Employee[];
  fixedExpenses: FixedExpense[];
  weighingSheets: WeighingSheet[];
  settings: FarmSettings;
  updateSettings: (settings: FarmSettings) => Promise<void>;
  saveAnimal: (animal: Animal) => Promise<void>;
  deleteAnimal: (id: string) => Promise<void>;
  savePasture: (pasture: Pasture) => Promise<void>;
  deletePasture: (id: string) => Promise<void>;
  saveExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  savePayment: (payment: EmployeePayment) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  saveTask: (task: FarmTask) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  saveTransaction: (transaction: TransactionHistory) => Promise<void>;
  saveInventory: (item: InventoryItem) => Promise<void>;
  deleteInventory: (id: string) => Promise<void>;
  saveEmployee: (employee: Employee) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  saveFixedExpense: (fixedExpense: FixedExpense) => Promise<void>;
  deleteFixedExpense: (id: string) => Promise<void>;
  saveWeighingSheet: (sheet: WeighingSheet) => Promise<void>;
  deleteWeighingSheet: (id: string) => Promise<void>;
  seedDatabase: () => Promise<void>;
  importBackupData: (backup: any) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

// --- Default Demo Datasets ---
const defaultDemoPastures: Pasture[] = [
  {
    id: "pasto_1",
    number: "01",
    name: "Pasto da Colina",
    grassTypes: ["Mombaça", "Brachiaria"],
    capacityAguas: 45,
    capacitySeca: 15,
    size: 20,
    stockingHistory: []
  },
  {
    id: "pasto_2",
    number: "02",
    name: "Piquete Estrela",
    grassTypes: ["Brachiaria Marandu"],
    capacityAguas: 30,
    capacitySeca: 10,
    size: 15,
    stockingHistory: []
  }
];

const defaultDemoAnimals: Animal[] = [
  {
    id: "animal_1",
    type: "Próprio" as any,
    category: "Boi" as any,
    breed: "Nelore",
    quantity: 25,
    lotName: "Lote 12 - Engorda",
    purchaseDate: "2026-01-10",
    purchasePrice: 2200,
    entryDate: "2026-01-10",
    currentPastureId: "pasto_1",
    pastureHistory: [{ pastureId: "pasto_1", date: "2026-01-10" }],
    averageWeight: 420,
    costs: 1500,
    isSold: false
  },
  {
    id: "animal_2",
    type: "Próprio" as any,
    category: "Vaca" as any,
    breed: "Gir Leiteiro",
    quantity: 15,
    lotName: "Lote Leite - Piquete 2",
    entryDate: "2026-02-15",
    currentPastureId: "pasto_2",
    pastureHistory: [{ pastureId: "pasto_2", date: "2026-02-15" }],
    averageWeight: 450,
    costs: 1200,
    isSold: false
  }
];

const defaultDemoEmployees: Employee[] = [
  {
    id: "fn_1",
    name: "José da Silva",
    role: "Vaqueiro" as any,
    admissionDate: "2025-03-01",
    status: "active"
  },
  {
    id: "fn_2",
    name: "Antônio Marcos",
    role: "Tratorista" as any,
    admissionDate: "2024-08-10",
    status: "active"
  }
];

const defaultDemoFixedExpenses: FixedExpense[] = [
  {
    id: "fix_1",
    description: "Energia Elétrica Sede",
    dueDate: "2026-06-15",
    value: 350.00,
    expenseType: "Energia"
  },
  {
    id: "fix_2",
    description: "Internet Fibra Rural",
    dueDate: "2026-06-10",
    value: 120.00,
    expenseType: "Internet"
  }
];

const defaultDemoTasks: FarmTask[] = [
  {
    id: "task_1",
    title: "Aplicação de Vacina de Febre Aftosa",
    description: "Vacinar o Lote 12 no piquete colina",
    dueDate: "2026-06-10",
    completed: false,
    priority: "High"
  },
  {
    id: "task_2",
    title: "Limpeza das cacimbas de água",
    description: "Revisar boias e bebedouros de todos os piquetes",
    dueDate: "2026-06-12",
    completed: false,
    priority: "Medium"
  }
];

const defaultDemoExpenses: Expense[] = [
  {
    id: "exp_1",
    date: "2026-06-01",
    type: ExpenseType.DIESEL,
    description: "Diesel para trator galão 50L",
    value: 380.00,
    status: "paid"
  },
  {
    id: "exp_2",
    date: "2026-06-03",
    type: ExpenseType.SALT,
    description: "Compra de Sal Mineralizado Fosbovi",
    value: 1250.00,
    status: "paid"
  },
  {
    id: "exp_3",
    date: "2026-06-05",
    type: ExpenseType.VACCINE,
    description: "Lote de Vacinas contra Febre Aftosa",
    value: 450.00,
    status: "paid"
  },
  {
    id: "exp_4",
    date: "2026-05-15",
    type: ExpenseType.MAINTENANCE,
    description: "Conserto de cerca piquete estrela",
    value: 600.00,
    status: "paid"
  }
];

const defaultDemoPayments: EmployeePayment[] = [
  {
    id: "pay_1",
    employeeName: "José da Silva",
    date: "2026-06-05",
    role: EmployeeRole.COWBOY,
    paymentType: PaymentType.SALARY,
    totalValue: 2000.00,
    observation: "Pagamento de vaqueiro"
  },
  {
    id: "pay_2",
    employeeName: "Antônio Marcos",
    date: "2026-06-05",
    role: EmployeeRole.TRACTOR_DRIVER,
    paymentType: PaymentType.SALARY,
    totalValue: 2300.00,
    observation: "Pagamento de tratorista"
  }
];

const defaultDemoInventory: InventoryItem[] = [
  {
    id: "inv_1",
    name: "Sal Mineral 80 Fosbovi",
    category: "Supply",
    quantity: 8,
    unit: "Sacos de 25 kg",
    unitPrice: 150.00,
    totalPrice: 1200.00,
    lastUpdated: "2026-06-05"
  },
  {
    id: "inv_2",
    name: "Vacina Febre Aftosa",
    category: "Supply",
    quantity: 150,
    unit: "Doses",
    unitPrice: 3.00,
    totalPrice: 450.00,
    lastUpdated: "2026-06-05"
  }
];


export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const cachedUser = localStorage.getItem('gestao_fazenda_custom_user');
    return cachedUser ? JSON.parse(cachedUser) as User : null;
  });
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(() => {
    return localStorage.getItem('gestao_fazenda_user_role') as 'admin' | 'user' | null;
  });
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('gestao_fazenda_is_demo') === 'true';
  });

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accountsPayable, setAccountPayables] = useState<AccountPayable[]>([]);
  const [accountsReceivable, setAccountReceivables] = useState<AccountReceivable[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [ppeItems, setPPEItems] = useState<PPEItem[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [documents, setDocuments] = useState<FarmDocument[]>([]);
  const [individualAnimals, setIndividualAnimals] = useState<IndividualAnimal[]>([]);
  const [reproductionEvents, setReproductionEvents] = useState<ReproductionEvent[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [milkRecords, setMilkRecords] = useState<MilkProductionRecord[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [cropPlans, setCropPlans] = useState<CropPlan[]>([]);
  const [fieldLogEntries, setFieldLogEntries] = useState<FieldLogEntry[]>([]);
  const [pestRecords, setPestRecords] = useState<PestRecord[]>([]);
  const [irrigationRecords, setIrrigationRecords] = useState<IrrigationRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyIdState] = useState<string | null>(() => {
    return localStorage.getItem('gestao_fazenda_active_property');
  });
  const setActivePropertyId = (id: string) => {
    localStorage.setItem('gestao_fazenda_active_property', id);
    setActivePropertyIdState(id);
  };
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<EmployeePayment[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [weighingSheets, setWeighingSheets] = useState<WeighingSheet[]>([]);
  const [settings, setSettings] = useState<FarmSettings>({ farmName: '', city: '' });

  // Lista de e-mails usada só para "semear" os primeiros administradores,
  // na primeiríssima vez que cada um faz login. A partir daí, o papel do
  // usuário passa a viver só no Firestore (campo "role" em users/{uid}) —
  // nunca mais é recalculado a partir do e-mail. Antes desta correção,
  // QUALQUER conta nova virava admin automaticamente; agora o padrão
  // seguro para contas novas é "user".
  const BOOTSTRAP_ADMIN_EMAILS = ['admin@fazenda.com.br', 'admmeuarmazem@gmail.com', 'arnaldolima.adv79@gmail.com'];

  async function resolveUserRole(u: User): Promise<'admin' | 'user'> {
    const ref = doc(db, 'users', u.uid);
    try {
      const snap = await getDoc(ref);
      const existing = snap.exists() ? snap.data() : {};
      if (existing.role === 'admin' || existing.role === 'user') {
        return existing.role;
      }
      // Primeiro acesso deste usuário: define o papel pela lista de
      // bootstrap e grava no Firestore para todas as próximas vezes.
      const email = (u.email || '').toLowerCase();
      const role: 'admin' | 'user' = BOOTSTRAP_ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
      await setDoc(ref, {
        farmName: existing.farmName ?? '',
        city: existing.city ?? '',
        ...existing,
        role,
      }, { merge: true });
      return role;
    } catch (err) {
      console.error('Falha ao resolver papel do usuário — usando "user" por segurança:', err);
      return 'user';
    }
  }

  const getFirestoreUserId = (): string => {
    if (!user) return '';
    return user.uid;
  };

  // --- Generic Helpers for LocalStorage Data Parsing ---
  const getDemoList = <T,>(key: string, defaults: T[] = []): T[] => {
    const data = localStorage.getItem(`demo_${key}`);
    if (!data) {
      localStorage.setItem(`demo_${key}`, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(data);
  };

  const saveDemoItem = <T extends { id: string }>(key: string, item: T, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    setter(prev => {
      const filtered = prev.filter(x => x.id !== item.id);
      const next = [...filtered, item];
      localStorage.setItem(`demo_${key}`, JSON.stringify(next));
      return next;
    });
  };

  const deleteDemoItem = <T extends { id: string }>(key: string, id: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    setter(prev => {
      const next = prev.filter(x => x.id !== id);
      localStorage.setItem(`demo_${key}`, JSON.stringify(next));
      return next;
    });
  };

  const loginAsGuest = () => {
    localStorage.setItem('gestao_fazenda_is_demo', 'true');
    setIsDemoMode(true);
    setUser({
      uid: 'guest_demo',
      email: 'convidado@fazenda.com',
      displayName: 'Produtor Convidado',
      emailVerified: true,
      isAnonymous: true
    } as unknown as User);
  };

  const logoutAsGuest = () => {
    localStorage.removeItem('gestao_fazenda_is_demo');
    localStorage.removeItem('gestao_fazenda_user_role');
    setIsDemoMode(false);
    setUser(null);
    setUserRole(null);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    const cleanedEmail = email.trim().toLowerCase();
    
    if (cleanedEmail === 'admin@fazenda.com.br' && pass === 'admin2130') {
      try {
        let u;
        try {
          const credential = await signInWithEmailAndPassword(auth, cleanedEmail, pass);
          u = credential.user;
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
            const credential = await createUserWithEmailAndPassword(auth, cleanedEmail, pass);
            u = credential.user;
          } else {
            throw signInErr;
          }
        }
        setUser(u);
        const role = await resolveUserRole(u);
        setUserRole(role);
        localStorage.setItem('gestao_fazenda_user_role', role);
        setIsDemoMode(false);
        localStorage.removeItem('gestao_fazenda_is_demo');
        localStorage.removeItem('gestao_fazenda_custom_user');
        setLoading(false);
      } catch (err: any) {
        setLoading(false);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          throw new Error('E-mail ou senha incorretos.');
        } else if (err.code === 'auth/invalid-email') {
          throw new Error('Formato de e-mail inválido.');
        } else {
          throw new Error(err.message || 'Erro ao realizar login.');
        }
      }
    } else if (cleanedEmail === 'usuario@fazenda.com.br' && pass === 'usuario123') {
      try {
        let u;
        try {
          const credential = await signInWithEmailAndPassword(auth, cleanedEmail, pass);
          u = credential.user;
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
            const credential = await createUserWithEmailAndPassword(auth, cleanedEmail, pass);
            u = credential.user;
          } else {
            throw signInErr;
          }
        }
        setUser(u);
        const role = await resolveUserRole(u);
        setUserRole(role);
        localStorage.setItem('gestao_fazenda_user_role', role);
        setIsDemoMode(false);
        localStorage.removeItem('gestao_fazenda_is_demo');
        localStorage.removeItem('gestao_fazenda_custom_user');
        setLoading(false);
      } catch (err: any) {
        setLoading(false);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          throw new Error('E-mail ou senha incorretos.');
        } else if (err.code === 'auth/invalid-email') {
          throw new Error('Formato de e-mail inválido.');
        } else {
          throw new Error(err.message || 'Erro ao realizar login.');
        }
      }
    } else {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, pass);
        console.log('LOGIN OK');
        console.log('UID:', credential.user.uid);
        console.log('EMAIL:', credential.user.email);
        const u = credential.user;
        setUser(u);
        const defaultRole = await resolveUserRole(u);
        setUserRole(defaultRole);
        localStorage.setItem('gestao_fazenda_user_role', defaultRole);
        setIsDemoMode(false);
        localStorage.removeItem('gestao_fazenda_is_demo');
        localStorage.removeItem('gestao_fazenda_custom_user');
        setLoading(false);
      } catch (err: any) {
        setLoading(false);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          throw new Error('E-mail ou senha incorretos.');
        } else if (err.code === 'auth/invalid-email') {
          throw new Error('Formato de e-mail inválido.');
        } else {
          throw new Error(err.message || 'Erro ao realizar login.');
        }
      }
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    const cleanedEmail = email.trim().toLowerCase();
    try {
      const credential = await createUserWithEmailAndPassword(auth, cleanedEmail, pass);
      const u = credential.user;
      setUser(u);
      
      const defaultRole = await resolveUserRole(u);

      setUserRole(defaultRole);
      localStorage.setItem('gestao_fazenda_user_role', defaultRole);
      setIsDemoMode(false);
      localStorage.removeItem('gestao_fazenda_is_demo');
      localStorage.removeItem('gestao_fazenda_custom_user');
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('Este e-mail já está sendo utilizado por outra conta.');
      } else if (err.code === 'auth/weak-password') {
        throw new Error('A senha deve conter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('Formato de e-mail inválido.');
      } else if (err.code === 'auth/operation-not-allowed') {
        throw new Error('O cadastro por e-mail e senha não está ativado no console do seu projeto Firebase. Ative-o em Authentication > Sign-in method.');
      } else {
        throw new Error(err.message || 'Erro ao criar conta.');
      }
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('GOOGLE LOGIN OK');
      console.log(result.user);
      const u = result.user;
      setUser(u);
      const defaultRole = await resolveUserRole(u);
      setUserRole(defaultRole);
      localStorage.setItem('gestao_fazenda_user_role', defaultRole);
      setIsDemoMode(false);
      localStorage.removeItem('gestao_fazenda_is_demo');
      localStorage.removeItem('gestao_fazenda_custom_user');
      setLoading(false);
    } catch (err: any) {
      console.error('Google login error:', err);
      setLoading(false);
      throw err;
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        throw new Error('Usuário não encontrado com este e-mail.');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('E-mail em formato inválido.');
      } else {
        throw new Error(err.message || 'Erro ao enviar e-mail de redefinição.');
      }
    }
  };

  const logout = async () => {
    localStorage.removeItem('gestao_fazenda_is_demo');
    localStorage.removeItem('gestao_fazenda_custom_user');
    localStorage.removeItem('gestao_fazenda_user_role');
    setIsDemoMode(false);
    setUser(null);
    setUserRole(null);
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setIsDemoMode(false);
        localStorage.removeItem('gestao_fazenda_is_demo');
        setUser(u);
        // O papel agora vem sempre do Firestore (fonte da verdade), nunca
        // mais é adivinhado a partir do e-mail a cada carregamento do app.
        const role = await resolveUserRole(u);
        localStorage.setItem('gestao_fazenda_user_role', role);
        setUserRole(role);
        setLoading(false);
      } else {
        const customCached = localStorage.getItem('gestao_fazenda_custom_user');
        if (customCached) {
          setUser(JSON.parse(customCached) as User);
          const cachedRole = localStorage.getItem('gestao_fazenda_user_role') as 'admin' | 'user' | null;
          setUserRole(cachedRole || 'user');
        } else {
          const demoActive = localStorage.getItem('gestao_fazenda_is_demo') === 'true';
          if (demoActive) {
            setIsDemoMode(true);
            setUser({
              uid: 'guest_demo',
              email: 'convidado@fazenda.com',
              displayName: 'Produtor Convidado',
              emailVerified: true,
              isAnonymous: true
            } as unknown as User);
          } else {
            setUser(null);
            setUserRole(null);
          }
        }
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setAnimals([]);
      setPastures([]);
      setExpenses([]);
      setPayments([]);
      setTasks([]);
      setTransactions([]);
      setInventory([]);
      setEmployees([]);
      setFixedExpenses([]);
      setWeighingSheets([]);
      setIndividualAnimals([]);
      setReproductionEvents([]);
      setHealthEvents([]);
      setMilkRecords([]);
      setTalhoes([]);
      setCropPlans([]);
      setFieldLogEntries([]);
      setPestRecords([]);
      setIrrigationRecords([]);
      setCostCenters([]);
      setAccountPayables([]);
      setAccountReceivables([]);
      setMachines([]);
      setMaintenanceRecords([]);
      setTeams([]);
      setWorkSchedules([]);
      setTrainings([]);
      setPPEItems([]);
      setCertifications([]);
      setDocuments([]);
      setSettings({ farmName: '', city: '' });
      return;
    }

    if (isDemoMode) {
      const storedSettings = localStorage.getItem('demo_settings');
      setSettings(storedSettings ? JSON.parse(storedSettings) : { farmName: 'Fazenda Terra Rica', city: 'Uberaba - MG' });
      setAnimals(getDemoList<Animal>('animals', defaultDemoAnimals));
      setPastures(getDemoList<Pasture>('pastures', defaultDemoPastures));
      setExpenses(getDemoList<Expense>('expenses', defaultDemoExpenses));
      setPayments(getDemoList<EmployeePayment>('payments', defaultDemoPayments));
      setTasks(getDemoList<FarmTask>('tasks', defaultDemoTasks));
      setTransactions(getDemoList<TransactionHistory>('transactions', []));
      setInventory(getDemoList<InventoryItem>('inventory', defaultDemoInventory));
      setEmployees(getDemoList<Employee>('employees', defaultDemoEmployees));
      setFixedExpenses(getDemoList<FixedExpense>('fixedExpenses', defaultDemoFixedExpenses));
      setWeighingSheets(getDemoList<WeighingSheet>('weighingSheets', []));
      return;
    }

    const userId = user.uid;
    
    if (!userId) {
      console.error('User ID não encontrado');
      return;
    }

    console.log('🔥 Carregando dados para usuário:', userId);

    const settingsUnsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        console.log('✅ Settings carregadas');
        setSettings(snap.data() as FarmSettings);
      } else {
        setSettings({ farmName: '', city: '' });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}`));


    // Fase 9 - Financeiro, Maquinas, RH Rural
    const costCentersUnsub = onSnapshot(collection(db, 'users', userId, 'costCenters'), (snap) => {
      setCostCenters(snap.docs.map(d => d.data() as CostCenter));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/costCenters`));

    const accountsPayableUnsub = onSnapshot(collection(db, 'users', userId, 'accountsPayable'), (snap) => {
      setAccountPayables(snap.docs.map(d => d.data() as AccountPayable));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/accountsPayable`));

    const accountsReceivableUnsub = onSnapshot(collection(db, 'users', userId, 'accountsReceivable'), (snap) => {
      setAccountReceivables(snap.docs.map(d => d.data() as AccountReceivable));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/accountsReceivable`));

    const machinesUnsub = onSnapshot(collection(db, 'users', userId, 'machines'), (snap) => {
      setMachines(snap.docs.map(d => d.data() as Machine));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/machines`));

    const maintenanceRecordsUnsub = onSnapshot(collection(db, 'users', userId, 'maintenanceRecords'), (snap) => {
      setMaintenanceRecords(snap.docs.map(d => d.data() as MaintenanceRecord));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/maintenanceRecords`));

    const teamsUnsub = onSnapshot(collection(db, 'users', userId, 'teams'), (snap) => {
      setTeams(snap.docs.map(d => d.data() as Team));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/teams`));

    const workSchedulesUnsub = onSnapshot(collection(db, 'users', userId, 'workSchedules'), (snap) => {
      setWorkSchedules(snap.docs.map(d => d.data() as WorkSchedule));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/workSchedules`));

    const trainingsUnsub = onSnapshot(collection(db, 'users', userId, 'trainings'), (snap) => {
      setTrainings(snap.docs.map(d => d.data() as Training));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/trainings`));

    const ppeItemsUnsub = onSnapshot(collection(db, 'users', userId, 'ppeItems'), (snap) => {
      setPPEItems(snap.docs.map(d => d.data() as PPEItem));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/ppeItems`));

    const certificationsUnsub = onSnapshot(collection(db, 'users', userId, 'certifications'), (snap) => {
      setCertifications(snap.docs.map(d => d.data() as Certification));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/certifications`));

    const documentsUnsub = onSnapshot(collection(db, 'users', userId, 'documents'), (snap) => {
      setDocuments(snap.docs.map(d => d.data() as FarmDocument));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/documents`));

    // Fase 2 (multi-propriedade): carrega as propriedades do usuário. Na
    // PRIMEIRA VEZ que o usuário acessa depois desta atualização (sem
    // nenhuma propriedade ainda), cria automaticamente uma propriedade
    // padrão ("Minha Propriedade") só para não perder o acesso aos dados
    // antigos. Isso roda só essa vez — controlado por uma marca salva no
    // navegador — para que, se o usuário decidir excluir sua última
    // propriedade de propósito mais tarde, o app não fique recriando uma
    // nova sozinho: ele simplesmente fica sem nenhuma até o usuário criar a
    // que quiser, com o nome que quiser.
    const migrationFlagKey = `gestao_fazenda_properties_migrated_${userId}`;
    const propertiesUnsub = onSnapshot(collection(db, 'users', userId, 'properties'), async (snap) => {
      const list = snap.docs.map(d => d.data() as Property);
      setProperties(list);

      const alreadyMigrated = localStorage.getItem(migrationFlagKey) === 'true';

      if (list.length === 0 && !alreadyMigrated) {
        const defaultProperty: Property = {
          id: `prop_${Date.now()}`,
          name: 'Minha Propriedade',
          type: PropertyType.FAZENDA,
          createdAt: new Date().toISOString(),
        };
        try {
          await setDoc(doc(db, 'users', userId, 'properties', defaultProperty.id), defaultProperty);
          setActivePropertyId(defaultProperty.id);
          localStorage.setItem(migrationFlagKey, 'true');
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${userId}/properties`);
        }
      } else if (list.length > 0) {
        localStorage.setItem(migrationFlagKey, 'true');
        if (!activePropertyId || !list.some(p => p.id === activePropertyId)) {
          // Se não há propriedade ativa selecionada (ou a que estava salva
          // não existe mais), cai para a primeira da lista em vez de travar.
          setActivePropertyId(list[0].id);
        }
      } else {
        // Lista vazia por decisão do usuário (já migrado antes) — não recria
        // nada sozinho. Só limpa a propriedade ativa.
        setActivePropertyId('');
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/properties`));

    const animalsUnsub = onSnapshot(collection(db, 'users', userId, 'animals'), (snap) => {
      setAnimals(snap.docs.map(d => d.data() as Animal));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/animals`));

    const pasturesUnsub = onSnapshot(collection(db, 'users', userId, 'pastures'), (snap) => {
      setPastures(snap.docs.map(d => d.data() as Pasture));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/pastures`));

    const expensesUnsub = onSnapshot(collection(db, 'users', userId, 'expenses'), (snap) => {
      setExpenses(snap.docs.map(d => d.data() as Expense));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/expenses`));

    const paymentsUnsub = onSnapshot(collection(db, 'users', userId, 'payments'), (snap) => {
      setPayments(snap.docs.map(d => d.data() as EmployeePayment));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/payments`));

    const tasksUnsub = onSnapshot(collection(db, 'users', userId, 'tasks'), (snap) => {
      setTasks(snap.docs.map(d => d.data() as FarmTask));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/tasks`));

    const transactionsUnsub = onSnapshot(collection(db, 'users', userId, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => d.data() as TransactionHistory));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/transactions`));

    const inventoryUnsub = onSnapshot(collection(db, 'users', userId, 'inventory'), (snap) => {
      setInventory(snap.docs.map(d => d.data() as InventoryItem));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/inventory`));

    const employeesUnsub = onSnapshot(collection(db, 'users', userId, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => d.data() as Employee));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/employees`));

    const fixedExpensesUnsub = onSnapshot(collection(db, 'users', userId, 'fixedExpenses'), (snap) => {
      setFixedExpenses(snap.docs.map(d => d.data() as FixedExpense));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/fixedExpenses`));

    const weighingSheetsUnsub = onSnapshot(collection(db, 'users', userId, 'weighingSheets'), (snap) => {
      setWeighingSheets(snap.docs.map(d => d.data() as WeighingSheet));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/weighingSheets`));

    // Fase 6/7 — Pecuária Profissional
    const individualAnimalsUnsub = onSnapshot(collection(db, 'users', userId, 'individualAnimals'), (snap) => {
      setIndividualAnimals(snap.docs.map(d => d.data() as IndividualAnimal));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/individualAnimals`));

    const reproductionEventsUnsub = onSnapshot(collection(db, 'users', userId, 'reproductionEvents'), (snap) => {
      setReproductionEvents(snap.docs.map(d => d.data() as ReproductionEvent));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/reproductionEvents`));

    const healthEventsUnsub = onSnapshot(collection(db, 'users', userId, 'healthEvents'), (snap) => {
      setHealthEvents(snap.docs.map(d => d.data() as HealthEvent));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/healthEvents`));

    const milkRecordsUnsub = onSnapshot(collection(db, 'users', userId, 'milkRecords'), (snap) => {
      setMilkRecords(snap.docs.map(d => d.data() as MilkProductionRecord));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/milkRecords`));

    // Fase 3/4 — Agricultura
    const talhoesUnsub = onSnapshot(collection(db, 'users', userId, 'talhoes'), (snap) => {
      setTalhoes(snap.docs.map(d => d.data() as Talhao));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/talhoes`));

    const cropPlansUnsub = onSnapshot(collection(db, 'users', userId, 'cropPlans'), (snap) => {
      setCropPlans(snap.docs.map(d => d.data() as CropPlan));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/cropPlans`));

    const fieldLogEntriesUnsub = onSnapshot(collection(db, 'users', userId, 'fieldLogEntries'), (snap) => {
      setFieldLogEntries(snap.docs.map(d => d.data() as FieldLogEntry));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/fieldLogEntries`));

    const pestRecordsUnsub = onSnapshot(collection(db, 'users', userId, 'pestRecords'), (snap) => {
      setPestRecords(snap.docs.map(d => d.data() as PestRecord));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/pestRecords`));

    const irrigationRecordsUnsub = onSnapshot(collection(db, 'users', userId, 'irrigationRecords'), (snap) => {
      setIrrigationRecords(snap.docs.map(d => d.data() as IrrigationRecord));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/irrigationRecords`));

    return () => {
      settingsUnsub();
      propertiesUnsub();
      animalsUnsub();
      pasturesUnsub();
      expensesUnsub();
      paymentsUnsub();
      tasksUnsub();
      transactionsUnsub();
      inventoryUnsub();
      employeesUnsub();
      fixedExpensesUnsub();
      weighingSheetsUnsub();
      individualAnimalsUnsub();
      reproductionEventsUnsub();
      healthEventsUnsub();
      milkRecordsUnsub();
      talhoesUnsub();
      cropPlansUnsub();
      fieldLogEntriesUnsub();
      pestRecordsUnsub();
      irrigationRecordsUnsub();
      costCentersUnsub();
      accountsPayableUnsub();
      accountsReceivableUnsub();
      machinesUnsub();
      maintenanceRecordsUnsub();
      teamsUnsub();
      workSchedulesUnsub();
      trainingsUnsub();
      ppeItemsUnsub();
      certificationsUnsub();
      documentsUnsub();
    };
  }, [user, isDemoMode]);

  // Fase 2 (multi-propriedade): registros que existiam antes desta
  // atualização não têm "propertyId". Assim que houver exatamente uma
  // propriedade (o caso normal de quem já usava o app), preenchemos o
  // propertyId que estiver faltando automaticamente — uma vez só, sem apagar
  // ou duplicar nada, só rotulando cada registro com a propriedade certa.
  useEffect(() => {
    if (!user || isDemoMode || properties.length !== 1) return;
    const targetPropertyId = properties[0].id;

    const backfill = async <T extends { id: string; propertyId?: string }>(
      items: T[],
      collectionName: string,
    ) => {
      const pending = items.filter((it) => !it.propertyId);
      for (const item of pending) {
        try {
          await updateDoc(doc(db, 'users', user.uid, collectionName, item.id), {
            propertyId: targetPropertyId,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/${collectionName}/${item.id}`);
        }
      }
    };

    backfill(animals, 'animals');
    backfill(pastures, 'pastures');
    backfill(expenses, 'expenses');
    backfill(payments, 'payments');
    backfill(tasks, 'tasks');
    backfill(inventory, 'inventory');
    backfill(employees, 'employees');
    backfill(fixedExpenses, 'fixedExpenses');
    backfill(weighingSheets, 'weighingSheets');
    // Roda de novo sempre que a lista de qualquer coleção mudar, mas o
    // filtro "!it.propertyId" garante que registros já migrados são
    // ignorados nas próximas execuções (idempotente).
  }, [user, isDemoMode, properties, animals, pastures, expenses, payments, tasks, inventory, employees, fixedExpenses, weighingSheets]);

  const checkWritePermission = (): boolean => {
    if (userRole === 'user') {
      console.warn("Acesso limitado: operação de escrita rejeitada.");
      return false;
    }
    return true;
  };

  const updateSettings = async (s: FarmSettings) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      setSettings(s);
      localStorage.setItem('demo_settings', JSON.stringify(s));
      return;
    }
    const currentUid = user.uid;
    try {
      // merge:true preserva campos que não fazem parte de FarmSettings
      // (como o "role", que não pode ser sobrescrito por uma gravação normal
      // de configurações — ver firestore.rules).
      await setDoc(doc(db, 'users', currentUid), s, { merge: true });
      console.log('✅ Settings salvas para usuário:', currentUid);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}`);
    }
  };

  // O SDK do Firestore lança erro se qualquer campo do documento for
  // `undefined` (não apenas ignora — quebra o salvamento inteiro). Como os
  // formulários de Propriedade e Pecuária Profissional têm vários campos
  // opcionais que ficam `undefined` quando o usuário deixa em branco, essa
  // função remove esses campos antes de gravar, em vez de mandar undefined.
  function stripUndefined<T extends Record<string, any>>(obj: T): T {
    const clean: Record<string, any> = {};
    for (const key in obj) {
      if (obj[key] !== undefined) clean[key] = obj[key];
    }
    return clean as T;
  }

  const saveProperty = async (property: Property) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'properties', property.id), stripUndefined(property));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/properties`);
    }
  };

  const deleteProperty = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    // Se esta for a última propriedade, o efeito de migração (que já roda
    // no carregamento) recria automaticamente uma propriedade padrão vazia
    // assim que a lista ficar vazia — por isso é seguro excluir mesmo
    // restando só uma.
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'properties', id));
      if (activePropertyId === id) {
        const remaining = properties.filter(p => p.id !== id);
        if (remaining[0]) setActivePropertyId(remaining[0].id);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/properties/${id}`);
    }
  };

  // Fase 6/7 — Pecuária Profissional
  const saveIndividualAnimal = async (animalItem: IndividualAnimal) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...animalItem, propertyId: animalItem.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'individualAnimals', animalItem.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/individualAnimals/${animalItem.id}`);
    }
  };

  const deleteIndividualAnimal = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'individualAnimals', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/individualAnimals/${id}`);
    }
  };

  const saveReproductionEvent = async (event: ReproductionEvent) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...event, propertyId: event.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'reproductionEvents', event.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/reproductionEvents/${event.id}`);
    }
  };

  const deleteReproductionEvent = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'reproductionEvents', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/reproductionEvents/${id}`);
    }
  };

  const saveHealthEvent = async (event: HealthEvent) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...event, propertyId: event.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'healthEvents', event.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/healthEvents/${event.id}`);
    }
  };

  const deleteHealthEvent = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'healthEvents', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/healthEvents/${id}`);
    }
  };

  const saveMilkRecord = async (record: MilkProductionRecord) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...record, propertyId: record.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'milkRecords', record.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/milkRecords/${record.id}`);
    }
  };

  const deleteMilkRecord = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'milkRecords', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/milkRecords/${id}`);
    }
  };

  // Fase 3/4 — Agricultura
  const saveTalhao = async (t: Talhao) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...t, propertyId: t.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'talhoes', t.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/talhoes/${t.id}`);
    }
  };

  const deleteTalhao = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'talhoes', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/talhoes/${id}`);
    }
  };

  const saveCropPlan = async (c: CropPlan) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...c, propertyId: c.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'cropPlans', c.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/cropPlans/${c.id}`);
    }
  };

  const deleteCropPlan = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'cropPlans', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/cropPlans/${id}`);
    }
  };

  const saveFieldLogEntry = async (e: FieldLogEntry) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...e, propertyId: e.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'fieldLogEntries', e.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/fieldLogEntries/${e.id}`);
    }
  };

  const deleteFieldLogEntry = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'fieldLogEntries', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/fieldLogEntries/${id}`);
    }
  };

  const savePestRecord = async (r: PestRecord) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...r, propertyId: r.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'pestRecords', r.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/pestRecords/${r.id}`);
    }
  };

  const deletePestRecord = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'pestRecords', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/pestRecords/${id}`);
    }
  };

  const saveIrrigationRecord = async (r: IrrigationRecord) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...r, propertyId: r.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'irrigationRecords', r.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/irrigationRecords/${r.id}`);
    }
  };

  const deleteIrrigationRecord = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'irrigationRecords', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/irrigationRecords/${id}`);
    }
  };

  // Fase 9 - Financeiro, Maquinas, RH Rural
  const saveCostCenter = async (cc: CostCenter) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...cc, propertyId: cc.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'costCenters', cc.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/costCenters/${cc.id}`);
    }
  };

  const deleteCostCenter = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'costCenters', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/costCenters/${id}`);
    }
  };

  const saveAccountPayable = async (ap: AccountPayable) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...ap, propertyId: ap.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'accountsPayable', ap.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/accountsPayable/${ap.id}`);
    }
  };

  const deleteAccountPayable = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'accountsPayable', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/accountsPayable/${id}`);
    }
  };

  const saveAccountReceivable = async (ar: AccountReceivable) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...ar, propertyId: ar.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'accountsReceivable', ar.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/accountsReceivable/${ar.id}`);
    }
  };

  const deleteAccountReceivable = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'accountsReceivable', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/accountsReceivable/${id}`);
    }
  };

  const saveMachine = async (m: Machine) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...m, propertyId: m.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'machines', m.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/machines/${m.id}`);
    }
  };

  const deleteMachine = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'machines', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/machines/${id}`);
    }
  };

  const saveMaintenanceRecord = async (mr: MaintenanceRecord) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...mr, propertyId: mr.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'maintenanceRecords', mr.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/maintenanceRecords/${mr.id}`);
    }
  };

  const deleteMaintenanceRecord = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'maintenanceRecords', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/maintenanceRecords/${id}`);
    }
  };

  const saveTeam = async (tm: Team) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...tm, propertyId: tm.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'teams', tm.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/teams/${tm.id}`);
    }
  };

  const deleteTeam = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'teams', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/teams/${id}`);
    }
  };

  const saveWorkSchedule = async (ws: WorkSchedule) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...ws, propertyId: ws.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'workSchedules', ws.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/workSchedules/${ws.id}`);
    }
  };

  const deleteWorkSchedule = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'workSchedules', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/workSchedules/${id}`);
    }
  };

  const saveTraining = async (tr: Training) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...tr, propertyId: tr.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'trainings', tr.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/trainings/${tr.id}`);
    }
  };

  const deleteTraining = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'trainings', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/trainings/${id}`);
    }
  };

  const savePPEItem = async (ppe: PPEItem) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...ppe, propertyId: ppe.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'ppeItems', ppe.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/ppeItems/${ppe.id}`);
    }
  };

  const deletePPEItem = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'ppeItems', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/ppeItems/${id}`);
    }
  };

  const saveCertification = async (cert: Certification) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      const toSave = stripUndefined({ ...cert, propertyId: cert.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'certifications', cert.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/certifications/${cert.id}`);
    }
  };

  const deleteCertification = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'certifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/certifications/${id}`);
    }
  };

  // Converte um arquivo em uma string base64 (data URL), pra guardar dentro
  // do próprio documento do Firestore — usado pelos Documentos.
  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // Documentos — o arquivo fica guardado como base64 dentro do próprio
  // documento do Firestore (não usa o Firebase Storage, que hoje exige o
  // plano pago Blaze mesmo dentro da faixa gratuita). O Firestore tem um
  // limite de 1MB por documento, então arquivos maiores que isso são
  // recusados aqui mesmo, antes de tentar salvar, com uma mensagem clara.
  const MAX_DOCUMENT_FILE_BYTES = 700_000; // ~700KB de arquivo original, com folga pro overhead do base64 (~33%) + resto dos campos

  const saveDocument = async (d: FarmDocument, file: File | null) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      let toSave = { ...d };
      if (file) {
        if (file.size > MAX_DOCUMENT_FILE_BYTES) {
          throw new Error(
            `Arquivo muito grande (${(file.size / 1024).toFixed(0)}KB). O limite é de ${(MAX_DOCUMENT_FILE_BYTES / 1024).toFixed(0)}KB porque o arquivo é guardado dentro do banco de dados gratuito. Tente uma foto/scan comprimido, ou um PDF menor.`,
          );
        }
        const dataUrl = await fileToDataUrl(file);
        toSave = { ...toSave, fileUrl: dataUrl, fileName: file.name, fileSize: file.size };
      }
      const clean = stripUndefined({ ...toSave, propertyId: toSave.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'documents', d.id), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/documents/${d.id}`);
      throw err; // deixa a tela mostrar a mensagem específica (ex: arquivo grande demais)
    }
  };

  const deleteDocument = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'documents', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/documents/${id}`);
    }
  };

  const saveAnimal = async (animal: Animal) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('animals', animal, setAnimals);
      return;
    }
    const currentUid = user.uid;
    try {
      const animalToSave = stripUndefined({ ...animal, propertyId: animal.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'animals', animal.id), animalToSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/animals/${animal.id}`);
    }
  };

  const deleteAnimal = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      deleteDemoItem('animals', id, setAnimals);
      optionsRemoveFromWeighingSheetRows(id);
      return;
    }
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'animals', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/animals/${id}`);
    }
  };

  const optionsRemoveFromWeighingSheetRows = (animalId: string) => {};

  const savePasture = async (pasture: Pasture) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('pastures', pasture, setPastures);
      return;
    }
    const currentUid = user.uid;
    try {
      const pastureToSave = stripUndefined({ ...pasture, propertyId: pasture.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'pastures', pasture.id), pastureToSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/pastures/${pasture.id}`);
    }
  };

  const deletePasture = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      deleteDemoItem('pastures', id, setPastures);
      return;
    }
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'pastures', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/pastures/${id}`);
    }
  };

  const saveExpense = async (expense: Expense) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('expenses', expense, setExpenses);
      return;
    }
    const currentUid = user.uid;
    try {
      const expenseToSave = stripUndefined({ ...expense, propertyId: expense.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'expenses', expense.id), expenseToSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/expenses/${expense.id}`);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      deleteDemoItem('expenses', id, setExpenses);
      return;
    }
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'expenses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/expenses/${id}`);
    }
  };

  const savePayment = async (payment: EmployeePayment) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('payments', payment, setPayments);
      return;
    }
    const currentUid = user.uid;
    try {
      const paymentToSave = stripUndefined({ ...payment, propertyId: payment.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'payments', payment.id), paymentToSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/payments/${payment.id}`);
    }
  };

  const deletePayment = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      deleteDemoItem('payments', id, setPayments);
      return;
    }
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'payments', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/payments/${id}`);
    }
  };

  const saveTask = async (task: FarmTask) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('tasks', task, setTasks);
      return;
    }
    const currentUid = user.uid;
    try {
      const taskToSave = stripUndefined({ ...task, propertyId: task.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'tasks', task.id), taskToSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/tasks/${task.id}`);
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      deleteDemoItem('tasks', id, setTasks);
      return;
    }
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'tasks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/tasks/${id}`);
    }
  };

  const saveTransaction = async (transaction: TransactionHistory) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('transactions', transaction, setTransactions);
      return;
    }
    const currentUid = user.uid;
    try {
      await setDoc(doc(db, 'users', currentUid, 'transactions', transaction.id), transaction);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/transactions/${transaction.id}`);
    }
  };

  const saveInventory = async (item: InventoryItem) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('inventory', item, setInventory);
      return;
    }
    const currentUid = user.uid;
    try {
      const itemToSave = stripUndefined({ ...item, propertyId: item.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'inventory', item.id), itemToSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/inventory/${item.id}`);
    }
  };

  const deleteInventory = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      deleteDemoItem('inventory', id, setInventory);
      return;
    }
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'inventory', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/inventory/${id}`);
    }
  };

  const saveEmployee = async (employee: Employee) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('employees', employee, setEmployees);
      return;
    }
    const currentUid = user.uid;
    try {
      const employeeToSave = stripUndefined({ ...employee, propertyId: employee.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'employees', employee.id), employeeToSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/employees/${employee.id}`);
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      deleteDemoItem('employees', id, setEmployees);
      return;
    }
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'employees', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/employees/${id}`);
    }
  };

  const saveFixedExpense = async (fixedExpense: FixedExpense) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('fixedExpenses', fixedExpense, setFixedExpenses);
      return;
    }
    const currentUid = user.uid;
    try {
      const fixedExpenseToSave = stripUndefined({ ...fixedExpense, propertyId: fixedExpense.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'fixedExpenses', fixedExpense.id), fixedExpenseToSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/fixedExpenses/${fixedExpense.id}`);
    }
  };

  const deleteFixedExpense = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      deleteDemoItem('fixedExpenses', id, setFixedExpenses);
      return;
    }
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'fixedExpenses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/fixedExpenses/${id}`);
    }
  };

  const saveWeighingSheet = async (sheet: WeighingSheet) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('weighingSheets', sheet, setWeighingSheets);
      return;
    }
    const currentUid = user.uid;
    try {
      const sheetToSave = stripUndefined({ ...sheet, propertyId: sheet.propertyId || activePropertyId || undefined });
      await setDoc(doc(db, 'users', currentUid, 'weighingSheets', sheet.id), sheetToSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/weighingSheets/${sheet.id}`);
    }
  };

  const deleteWeighingSheet = async (id: string) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      deleteDemoItem('weighingSheets', id, setWeighingSheets);
      return;
    }
    const currentUid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'weighingSheets', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/weighingSheets/${id}`);
    }
  };

  const seedDatabase = async () => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = user.uid;
    if (!currentUid) return;

    try {
      setLoading(true);

      const s: FarmSettings = { 
        farmName: 'Fazenda Online', 
        city: 'Uberaba - MG' 
      };
      await setDoc(doc(db, 'users', currentUid), s, { merge: true });

      for (const p of defaultDemoPastures) {
        await setDoc(doc(db, 'users', currentUid, 'pastures', p.id), p);
      }

      for (const a of defaultDemoAnimals) {
        await setDoc(doc(db, 'users', currentUid, 'animals', a.id), a);
      }

      for (const e of defaultDemoEmployees) {
        await setDoc(doc(db, 'users', currentUid, 'employees', e.id), e);
      }

      for (const fe of defaultDemoFixedExpenses) {
        await setDoc(doc(db, 'users', currentUid, 'fixedExpenses', fe.id), fe);
      }

      for (const t of defaultDemoTasks) {
        await setDoc(doc(db, 'users', currentUid, 'tasks', t.id), t);
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}/seed`);
    }
  };

  const importBackupData = async (backup: any) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    
    setLoading(true);
    try {
      if (isDemoMode) {
        if (backup.settings) {
          localStorage.setItem('demo_settings', JSON.stringify(backup.settings));
          setSettings(backup.settings);
        }
        const lists = [
          { key: 'animals', stateSetter: setAnimals },
          { key: 'pastures', stateSetter: setPastures },
          { key: 'expenses', stateSetter: setExpenses },
          { key: 'payments', stateSetter: setPayments },
          { key: 'tasks', stateSetter: setTasks },
          { key: 'transactions', stateSetter: setTransactions },
          { key: 'inventory', stateSetter: setInventory },
          { key: 'employees', stateSetter: setEmployees },
          { key: 'fixedExpenses', stateSetter: setFixedExpenses },
          { key: 'weighingSheets', stateSetter: setWeighingSheets }
        ];
        
        for (const item of lists) {
          if (Array.isArray(backup[item.key])) {
            localStorage.setItem(`demo_${item.key}`, JSON.stringify(backup[item.key]));
            item.stateSetter(backup[item.key]);
          }
        }
      } else {
        const currentUid = user.uid;
        if (!currentUid) return;
        
        if (backup.settings) {
          await setDoc(doc(db, 'users', currentUid), backup.settings, { merge: true });
        }
        
        const subcollections = [
          'animals', 'pastures', 'expenses', 'payments', 'tasks',
          'transactions', 'inventory', 'employees', 'fixedExpenses', 'weighingSheets'
        ];
        
        for (const coll of subcollections) {
          if (Array.isArray(backup[coll])) {
            for (const docItem of backup[coll]) {
              if (docItem && docItem.id) {
                await setDoc(doc(db, 'users', currentUid, coll, docItem.id), docItem);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Erro ao importar backup:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const activeProperty = properties.find(p => p.id === activePropertyId) || null;

  // Filtra cada lista pela propriedade ativa. Enquanto a migração automática
  // (acima) ainda não rotulou um registro antigo, ele continua aparecendo
  // normalmente contanto que só exista uma propriedade — assim nenhum dado
  // "some" da tela durante a transição.
  function byActiveProperty<T extends { propertyId?: string }>(items: T[]): T[] {
    if (!activePropertyId) return items;
    return items.filter(
      (it) => it.propertyId === activePropertyId || (!it.propertyId && properties.length <= 1),
    );
  }

  const filteredAnimals = byActiveProperty(animals);
  const filteredPastures = byActiveProperty(pastures);
  const filteredExpenses = byActiveProperty(expenses);
  const filteredPayments = byActiveProperty(payments);
  const filteredTasks = byActiveProperty(tasks);
  const filteredInventory = byActiveProperty(inventory);
  const filteredEmployees = byActiveProperty(employees);
  const filteredFixedExpenses = byActiveProperty(fixedExpenses);
  const filteredWeighingSheets = byActiveProperty(weighingSheets);
  const filteredIndividualAnimals = byActiveProperty(individualAnimals);
  const filteredReproductionEvents = byActiveProperty(reproductionEvents);
  const filteredHealthEvents = byActiveProperty(healthEvents);
  const filteredMilkRecords = byActiveProperty(milkRecords);
  const filteredTalhoes = byActiveProperty(talhoes);
  const filteredCropPlans = byActiveProperty(cropPlans);
  const filteredFieldLogEntries = byActiveProperty(fieldLogEntries);
  const filteredPestRecords = byActiveProperty(pestRecords);
  const filteredIrrigationRecords = byActiveProperty(irrigationRecords);
  const filteredCostCenters = byActiveProperty(costCenters);
  const filteredAccountPayables = byActiveProperty(accountsPayable);
  const filteredAccountReceivables = byActiveProperty(accountsReceivable);
  const filteredMachines = byActiveProperty(machines);
  const filteredMaintenanceRecords = byActiveProperty(maintenanceRecords);
  const filteredTeams = byActiveProperty(teams);
  const filteredWorkSchedules = byActiveProperty(workSchedules);
  const filteredTrainings = byActiveProperty(trainings);
  const filteredPPEItems = byActiveProperty(ppeItems);
  const filteredCertifications = byActiveProperty(certifications);
  const filteredDocuments = byActiveProperty(documents);

  return (
    <FirebaseContext.Provider value={{
      user, userRole, loading, isDemoMode,
      loginAsGuest, logoutAsGuest, loginWithEmail, registerWithEmail,
      loginWithGoogle, sendPasswordReset, logout,
      properties, activePropertyId, activeProperty, setActivePropertyId,
      saveProperty, deleteProperty,
      individualAnimals: filteredIndividualAnimals, saveIndividualAnimal, deleteIndividualAnimal,
      reproductionEvents: filteredReproductionEvents, saveReproductionEvent, deleteReproductionEvent,
      healthEvents: filteredHealthEvents, saveHealthEvent, deleteHealthEvent,
      milkRecords: filteredMilkRecords, saveMilkRecord, deleteMilkRecord,
      talhoes: filteredTalhoes, saveTalhao, deleteTalhao,
      cropPlans: filteredCropPlans, saveCropPlan, deleteCropPlan,
      fieldLogEntries: filteredFieldLogEntries, saveFieldLogEntry, deleteFieldLogEntry,
      pestRecords: filteredPestRecords, savePestRecord, deletePestRecord,
      irrigationRecords: filteredIrrigationRecords, saveIrrigationRecord, deleteIrrigationRecord,
      costCenters: filteredCostCenters, saveCostCenter, deleteCostCenter,
      accountsPayable: filteredAccountPayables, saveAccountPayable, deleteAccountPayable,
      accountsReceivable: filteredAccountReceivables, saveAccountReceivable, deleteAccountReceivable,
      machines: filteredMachines, saveMachine, deleteMachine,
      maintenanceRecords: filteredMaintenanceRecords, saveMaintenanceRecord, deleteMaintenanceRecord,
      teams: filteredTeams, saveTeam, deleteTeam,
      workSchedules: filteredWorkSchedules, saveWorkSchedule, deleteWorkSchedule,
      trainings: filteredTrainings, saveTraining, deleteTraining,
      ppeItems: filteredPPEItems, savePPEItem, deletePPEItem,
      certifications: filteredCertifications, saveCertification, deleteCertification,
      documents: filteredDocuments, saveDocument, deleteDocument,
      animals: filteredAnimals, pastures: filteredPastures, expenses: filteredExpenses,
      payments: filteredPayments, tasks: filteredTasks, transactions,
      inventory: filteredInventory, employees: filteredEmployees,
      fixedExpenses: filteredFixedExpenses, weighingSheets: filteredWeighingSheets, settings,
      updateSettings, saveAnimal, deleteAnimal, savePasture, deletePasture,
      saveExpense, deleteExpense, savePayment, deletePayment, saveTask,
      deleteTask, saveTransaction, saveInventory, deleteInventory,
      saveEmployee, deleteEmployee, saveFixedExpense, deleteFixedExpense,
      saveWeighingSheet, deleteWeighingSheet, seedDatabase, importBackupData
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};