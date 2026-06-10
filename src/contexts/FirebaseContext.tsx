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
import { Animal, Pasture, Expense, EmployeePayment, FarmTask, TransactionHistory, FarmSettings, InventoryItem, Employee, FixedExpense, WeighingSheet, ExpenseType, EmployeeRole, PaymentType } from '../types';

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

  const getFirestoreUserId = (): string => {
    if (!user) return '';
    const email = (user.email || '').toLowerCase();
    return (email === 'admin@fazenda.com.br' || email === 'usuario@fazenda.com.br' || email === 'admmeuarmazem@gmail.com' || email === 'arnaldolima.adv79@gmail.com')
      ? 'fazenda_shared_production_db_v1'
      : user.uid;
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
        setUserRole('admin');
        localStorage.setItem('gestao_fazenda_user_role', 'admin');
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
        setUserRole('user');
        localStorage.setItem('gestao_fazenda_user_role', 'user');
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
        const u = credential.user;
        setUser(u);
        const defaultRole = 'admin';
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
      
      const isAdminEmail = cleanedEmail === 'admin@fazenda.com.br' || cleanedEmail === 'admmeuarmazem@gmail.com' || cleanedEmail === 'arnaldolima.adv79@gmail.com';
      const defaultRole = isAdminEmail ? 'admin' : (cleanedEmail === 'usuario@fazenda.com.br' ? 'user' : 'admin');
      
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
      const u = result.user;
      setUser(u);
      const defaultRole = 'admin';
      setUserRole(defaultRole);
      localStorage.setItem('gestao_fazenda_user_role', defaultRole);
      setIsDemoMode(false);
      localStorage.removeItem('gestao_fazenda_is_demo');
      localStorage.removeItem('gestao_fazenda_custom_user');
      setLoading(false);
    } catch (err: any) {
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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setIsDemoMode(false);
        localStorage.removeItem('gestao_fazenda_is_demo');
        setUser(u);
        const email = (u.email || '').toLowerCase();
        let role = localStorage.getItem('gestao_fazenda_user_role') as 'admin' | 'user' | null;
        const isAdminEmail = email === 'admin@fazenda.com.br' || email === 'admmeuarmazem@gmail.com' || email === 'arnaldolima.adv79@gmail.com';
        
        if (!role || (email === 'usuario@fazenda.com.br' && role !== 'user') || (isAdminEmail && role !== 'admin')) {
          if (isAdminEmail) {
            role = 'admin';
          } else if (email === 'usuario@fazenda.com.br') {
            role = 'user';
          } else {
            role = role || 'admin';
          }
          localStorage.setItem('gestao_fazenda_user_role', role);
        }
        setUserRole(role);
        setLoading(false);
      } else {
        const customCached = localStorage.getItem('gestao_fazenda_custom_user');
        if (customCached) {
          setUser(JSON.parse(customCached) as User);
          const cachedRole = localStorage.getItem('gestao_fazenda_user_role') as 'admin' | 'user' | null;
          setUserRole(cachedRole || 'admin');
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

    const userId = getFirestoreUserId();

    // Settings
    const settingsUnsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as FarmSettings);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}`));

    // Animals
    const animalsUnsub = onSnapshot(collection(db, 'users', userId, 'animals'), (snap) => {
      setAnimals(snap.docs.map(d => d.data() as Animal));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/animals`));

    // Pastures
    const pasturesUnsub = onSnapshot(collection(db, 'users', userId, 'pastures'), (snap) => {
      setPastures(snap.docs.map(d => d.data() as Pasture));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/pastures`));

    // Expenses
    const expensesUnsub = onSnapshot(collection(db, 'users', userId, 'expenses'), (snap) => {
      setExpenses(snap.docs.map(d => d.data() as Expense));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/expenses`));

    // Payments
    const paymentsUnsub = onSnapshot(collection(db, 'users', userId, 'payments'), (snap) => {
      setPayments(snap.docs.map(d => d.data() as EmployeePayment));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/payments`));

    // Tasks
    const tasksUnsub = onSnapshot(collection(db, 'users', userId, 'tasks'), (snap) => {
      setTasks(snap.docs.map(d => d.data() as FarmTask));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/tasks`));

    // Transactions
    const transactionsUnsub = onSnapshot(collection(db, 'users', userId, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => d.data() as TransactionHistory));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/transactions`));

    // Inventory
    const inventoryUnsub = onSnapshot(collection(db, 'users', userId, 'inventory'), (snap) => {
      setInventory(snap.docs.map(d => d.data() as InventoryItem));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/inventory`));

    // Employees
    const employeesUnsub = onSnapshot(collection(db, 'users', userId, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => d.data() as Employee));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/employees`));

    // Fixed Expenses
    const fixedExpensesUnsub = onSnapshot(collection(db, 'users', userId, 'fixedExpenses'), (snap) => {
      setFixedExpenses(snap.docs.map(d => d.data() as FixedExpense));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/fixedExpenses`));

    // Weighing Sheets
    const weighingSheetsUnsub = onSnapshot(collection(db, 'users', userId, 'weighingSheets'), (snap) => {
      setWeighingSheets(snap.docs.map(d => d.data() as WeighingSheet));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/weighingSheets`));

    return () => {
      settingsUnsub();
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
    };
  }, [user, isDemoMode]);

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
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid), s);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUid}`);
    }
  };

  const saveAnimal = async (animal: Animal) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('animals', animal, setAnimals);
      return;
    }
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid, 'animals', animal.id), animal);
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
    const currentUid = getFirestoreUserId();
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'animals', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/animals/${id}`);
    }
  };

  // Internal helper to handle cascades
  const optionsRemoveFromWeighingSheetRows = (animalId: string) => {
    // optional helper
  };

  const savePasture = async (pasture: Pasture) => {
    if (!user) return;
    if (!checkWritePermission()) return;
    if (isDemoMode) {
      saveDemoItem('pastures', pasture, setPastures);
      return;
    }
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid, 'pastures', pasture.id), pasture);
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
    const currentUid = getFirestoreUserId();
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
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid, 'expenses', expense.id), expense);
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
    const currentUid = getFirestoreUserId();
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
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid, 'payments', payment.id), payment);
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
    const currentUid = getFirestoreUserId();
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
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid, 'tasks', task.id), task);
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
    const currentUid = getFirestoreUserId();
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
    const currentUid = getFirestoreUserId();
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
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid, 'inventory', item.id), item);
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
    const currentUid = getFirestoreUserId();
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
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid, 'employees', employee.id), employee);
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
    const currentUid = getFirestoreUserId();
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
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid, 'fixedExpenses', fixedExpense.id), fixedExpense);
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
    const currentUid = getFirestoreUserId();
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
    const currentUid = getFirestoreUserId();
    try {
      await setDoc(doc(db, 'users', currentUid, 'weighingSheets', sheet.id), sheet);
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
    const currentUid = getFirestoreUserId();
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'weighingSheets', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUid}/weighingSheets/${id}`);
    }
  };

  const seedDatabase = async () => {
    if (!user) return;
    if (!checkWritePermission()) return;
    const currentUid = getFirestoreUserId();
    if (!currentUid) return;

    try {
      setLoading(true);

      // Seed settings
      const s: FarmSettings = { 
        farmName: 'Fazenda Online', 
        city: 'Uberaba - MG' 
      };
      await setDoc(doc(db, 'users', currentUid), s);

      // Seed pastures
      for (const p of defaultDemoPastures) {
        await setDoc(doc(db, 'users', currentUid, 'pastures', p.id), p);
      }

      // Seed animals
      for (const a of defaultDemoAnimals) {
        await setDoc(doc(db, 'users', currentUid, 'animals', a.id), a);
      }

      // Seed employees
      for (const e of defaultDemoEmployees) {
        await setDoc(doc(db, 'users', currentUid, 'employees', e.id), e);
      }

      // Seed fixedExpenses
      for (const fe of defaultDemoFixedExpenses) {
        await setDoc(doc(db, 'users', currentUid, 'fixedExpenses', fe.id), fe);
      }

      // Seed tasks
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
        const currentUid = getFirestoreUserId();
        if (!currentUid) return;
        
        if (backup.settings) {
          await setDoc(doc(db, 'users', currentUid), backup.settings);
        }
        
        const subcollections = [
          'animals',
          'pastures',
          'expenses',
          'payments',
          'tasks',
          'transactions',
          'inventory',
          'employees',
          'fixedExpenses',
          'weighingSheets'
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

  return (
    <FirebaseContext.Provider value={{
      user, 
      userRole,
      loading, 
      isDemoMode,
      loginAsGuest,
      logoutAsGuest,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      sendPasswordReset,
      logout,
      animals, 
      pastures, 
      expenses, 
      payments, 
      tasks, 
      transactions, 
      inventory, 
      employees, 
      fixedExpenses, 
      weighingSheets, 
      settings,
      updateSettings, 
      saveAnimal, 
      deleteAnimal, 
      savePasture, 
      deletePasture, 
      saveExpense, 
      deleteExpense,
      savePayment, 
      deletePayment, 
      saveTask, 
      deleteTask, 
      saveTransaction, 
      saveInventory, 
      deleteInventory,
      saveEmployee, 
      deleteEmployee, 
      saveFixedExpense, 
      deleteFixedExpense, 
      saveWeighingSheet, 
      deleteWeighingSheet,
      seedDatabase,
      importBackupData
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
