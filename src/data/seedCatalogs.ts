import type { ProductVertical, StoreVertical } from '../types/pos';
import { daysAgoIsoDate } from '../lib/validation';

export interface SeedSupplierTemplate {
  key: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  category: string;
  payableBalance: number;
  totalSupplied: number;
  paymentTerms: string;
}

export interface SeedCustomerTemplate {
  key: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number;
  balance: number;
  totalPurchases: number;
  notes: string;
}

export interface SeedProductTemplate {
  key: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  vertical: ProductVertical;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  taxPercent: number;
  stockQty: number;
  minStockLevel: number;
  batchNumber: string;
  expiryDate: string;
  supplierKey: string;
}

export interface SeedDataset {
  storeName: string;
  vertical: StoreVertical;
  suppliers: SeedSupplierTemplate[];
  customers: SeedCustomerTemplate[];
  products: SeedProductTemplate[];
  historicalSales: {
    daysAgo: number;
    customerKey: string | 'walk-in';
    paymentMethod: 'cash' | 'upi' | 'card' | 'credit';
    items: { productKey: string; qty: number }[];
    paidRatio: number;
  }[];
  initialPurchases: {
    daysAgo: number;
    supplierKey: string;
    status: 'received' | 'ordered';
    paymentStatus: 'paid' | 'partial' | 'unpaid';
    items: { productKey: string; qty: number }[];
    paidRatio: number;
  }[];
}

export const VERTICAL_OPTIONS: {
  id: StoreVertical;
  label: string;
  subtitle: string;
  sampleStore: string;
}[] = [
  {
    id: 'mixed',
    label: 'Multi-Department Store',
    subtitle: 'Grocery, Pharmacy & Hardware combined catalog',
    sampleStore: 'Bharat Retail Mart',
  },
  {
    id: 'grocery',
    label: 'Grocery & Supermart',
    subtitle: 'Staples, dairy, beverages, packaged FMCG',
    sampleStore: 'Annapurna Supermart',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy & Medical',
    subtitle: 'OTC & Rx medicines with batch and expiry tracking',
    sampleStore: 'Arogya Care Pharmacy',
  },
  {
    id: 'hardware',
    label: 'Hardware & Building',
    subtitle: 'Tools, paints, electrical, plumbing & fasteners',
    sampleStore: 'Shree Vishwakarma Hardware',
  },
];

export function buildSeedDataset(vertical: StoreVertical): SeedDataset {
  const suppliers: SeedSupplierTemplate[] = [
    {
      key: 'sup_grocery',
      name: 'Mahajan Agro Distributors',
      contactPerson: 'Rajesh Mahajan',
      phone: '+91 98204 51200',
      email: 'orders@mahajanagro.in',
      address: 'APMC Market Yard, Navi Mumbai',
      taxId: '27AABCM4821K1Z4',
      category: 'Grocery & FMCG',
      payableBalance: 14500,
      totalSupplied: 128400,
      paymentTerms: 'Net 15 Days',
    },
    {
      key: 'sup_pharma',
      name: 'MedLine Pharma Agencies',
      contactPerson: 'Dr. Kavita Deshmukh',
      phone: '+91 98112 73490',
      email: 'dispatch@medlineagencies.in',
      address: 'Bhiwandi Pharma Logistics Hub, MH',
      taxId: '27AADCM9012L1Z8',
      category: 'Pharmaceuticals',
      payableBalance: 22800,
      totalSupplied: 196500,
      paymentTerms: 'Net 30 Days',
    },
    {
      key: 'sup_hardware',
      name: 'Apex Industrial & Hardware Supply',
      contactPerson: 'Vikramjit Gill',
      phone: '+91 98710 66218',
      email: 'sales@apexhardware.in',
      address: 'Industrial Estate Phase 2, Pune',
      taxId: '27AAECA7743P1Z1',
      category: 'Hardware & Electrical',
      payableBalance: 18200,
      totalSupplied: 245000,
      paymentTerms: 'Net 21 Days',
    },
  ];

  const customers: SeedCustomerTemplate[] = [
    {
      key: 'cust_1',
      name: 'Suresh Kirana & Tiffin',
      phone: '+91 98331 20411',
      email: 'suresh.tiffin@example.com',
      address: 'Sector 14, Main Market',
      creditLimit: 25000,
      balance: 4850,
      totalPurchases: 42300,
      notes: 'Weekly bulk grocery buyer, settles every Monday',
    },
    {
      key: 'cust_2',
      name: 'Meera Sharma',
      phone: '+91 98229 44810',
      email: 'meera.sharma@example.com',
      address: '402 Gulmohar Residency',
      creditLimit: 10000,
      balance: 1420,
      totalPurchases: 16900,
      notes: 'Monthly prescription & household essentials',
    },
    {
      key: 'cust_3',
      name: 'Rathore Civil Contractors',
      phone: '+91 97654 88120',
      email: 'accounts@rathorecivil.in',
      address: 'Plot 19, Ring Road Site',
      creditLimit: 75000,
      balance: 12600,
      totalPurchases: 118500,
      notes: 'Site materials on 15-day credit account',
    },
    {
      key: 'cust_4',
      name: 'Imran Electronics & Repair',
      phone: '+91 98900 31542',
      email: 'imran.repairs@example.com',
      address: 'Shop 7, Station Road',
      creditLimit: 20000,
      balance: 0,
      totalPurchases: 28400,
      notes: 'Prompt UPI payer',
    },
  ];

  const groceryProducts: SeedProductTemplate[] = [
    {
      key: 'g_rice',
      sku: 'GRC-101',
      barcode: '8901491101011',
      name: 'India Gate Basmati Rice 5kg',
      category: 'Staples & Grains',
      vertical: 'grocery',
      unit: 'bag',
      costPrice: 540,
      sellingPrice: 685,
      taxPercent: 5,
      stockQty: 34,
      minStockLevel: 10,
      batchNumber: 'IG-2610',
      expiryDate: '2027-08-15',
      supplierKey: 'sup_grocery',
    },
    {
      key: 'g_oil',
      sku: 'GRC-102',
      barcode: '8901491101028',
      name: 'Fortune Kachchi Ghani Mustard Oil 1L',
      category: 'Edible Oils',
      vertical: 'grocery',
      unit: 'bottle',
      costPrice: 138,
      sellingPrice: 172,
      taxPercent: 5,
      stockQty: 6,
      minStockLevel: 15,
      batchNumber: 'FO-882',
      expiryDate: '2027-03-30',
      supplierKey: 'sup_grocery',
    },
    {
      key: 'g_atta',
      sku: 'GRC-103',
      barcode: '8901491101035',
      name: 'Aashirvaad Whole Wheat Atta 10kg',
      category: 'Staples & Grains',
      vertical: 'grocery',
      unit: 'bag',
      costPrice: 385,
      sellingPrice: 465,
      taxPercent: 0,
      stockQty: 22,
      minStockLevel: 8,
      batchNumber: 'AA-542',
      expiryDate: '2027-02-20',
      supplierKey: 'sup_grocery',
    },
    {
      key: 'g_tea',
      sku: 'GRC-104',
      barcode: '8901491101042',
      name: 'Tata Tea Gold 500g',
      category: 'Beverages',
      vertical: 'grocery',
      unit: 'pack',
      costPrice: 235,
      sellingPrice: 295,
      taxPercent: 5,
      stockQty: 4,
      minStockLevel: 12,
      batchNumber: 'TT-119',
      expiryDate: '2027-09-10',
      supplierKey: 'sup_grocery',
    },
    {
      key: 'g_ghee',
      sku: 'GRC-105',
      barcode: '8901491101059',
      name: 'Amul Pure Cow Ghee 1L Tin',
      category: 'Dairy & Ghee',
      vertical: 'grocery',
      unit: 'tin',
      costPrice: 560,
      sellingPrice: 650,
      taxPercent: 12,
      stockQty: 18,
      minStockLevel: 6,
      batchNumber: 'AM-904',
      expiryDate: '2027-05-12',
      supplierKey: 'sup_grocery',
    },
    {
      key: 'g_dal',
      sku: 'GRC-106',
      barcode: '8901491101066',
      name: 'Toor Dal Unpolished 1kg',
      category: 'Pulses & Lentils',
      vertical: 'grocery',
      unit: 'pack',
      costPrice: 142,
      sellingPrice: 184,
      taxPercent: 0,
      stockQty: 0,
      minStockLevel: 10,
      batchNumber: 'TD-301',
      expiryDate: '2027-06-01',
      supplierKey: 'sup_grocery',
    },
  ];

  const pharmacyProducts: SeedProductTemplate[] = [
    {
      key: 'p_dolo',
      sku: 'PHM-201',
      barcode: '8902211202014',
      name: 'Paracetamol 650mg Strip (15 Tabs)',
      category: 'Analgesics & Fever',
      vertical: 'pharmacy',
      unit: 'strip',
      costPrice: 22,
      sellingPrice: 34,
      taxPercent: 12,
      stockQty: 86,
      minStockLevel: 25,
      batchNumber: 'DL-2604A',
      expiryDate: '2028-04-30',
      supplierKey: 'sup_pharma',
    },
    {
      key: 'p_amox',
      sku: 'PHM-202',
      barcode: '8902211202021',
      name: 'Amoxicillin + Clavulanate 625mg (10 Tabs)',
      category: 'Antibiotics',
      vertical: 'pharmacy',
      unit: 'strip',
      costPrice: 145,
      sellingPrice: 215,
      taxPercent: 12,
      stockQty: 7,
      minStockLevel: 15,
      batchNumber: 'AMX-991',
      expiryDate: '2026-12-20',
      supplierKey: 'sup_pharma',
    },
    {
      key: 'p_vitd',
      sku: 'PHM-203',
      barcode: '8902211202038',
      name: 'Vitamin D3 60000 IU Softgels (8 Caps)',
      category: 'Supplements',
      vertical: 'pharmacy',
      unit: 'strip',
      costPrice: 168,
      sellingPrice: 260,
      taxPercent: 12,
      stockQty: 29,
      minStockLevel: 10,
      batchNumber: 'VD-4410',
      expiryDate: '2027-11-30',
      supplierKey: 'sup_pharma',
    },
    {
      key: 'p_thermo',
      sku: 'PHM-204',
      barcode: '8902211202045',
      name: 'Omron Digital Clinical Thermometer',
      category: 'Medical Devices',
      vertical: 'pharmacy',
      unit: 'pcs',
      costPrice: 210,
      sellingPrice: 325,
      taxPercent: 18,
      stockQty: 3,
      minStockLevel: 8,
      batchNumber: 'OM-2026',
      expiryDate: '',
      supplierKey: 'sup_pharma',
    },
    {
      key: 'p_ors',
      sku: 'PHM-205',
      barcode: '8902211202052',
      name: 'Electral WHO ORS Powder 21.8g',
      category: 'Hydration & OTC',
      vertical: 'pharmacy',
      unit: 'sachet',
      costPrice: 15,
      sellingPrice: 23,
      taxPercent: 12,
      stockQty: 64,
      minStockLevel: 20,
      batchNumber: 'EL-712',
      expiryDate: '2027-07-15',
      supplierKey: 'sup_pharma',
    },
  ];

  const hardwareProducts: SeedProductTemplate[] = [
    {
      key: 'h_paint',
      sku: 'HRD-301',
      barcode: '8903399303017',
      name: 'Asian Paints Apex Exterior Emulsion 4L',
      category: 'Paints & Coatings',
      vertical: 'hardware',
      unit: 'bucket',
      costPrice: 1320,
      sellingPrice: 1740,
      taxPercent: 18,
      stockQty: 14,
      minStockLevel: 6,
      batchNumber: 'AP-4402',
      expiryDate: '',
      supplierKey: 'sup_hardware',
    },
    {
      key: 'h_wire',
      sku: 'HRD-302',
      barcode: '8903399303024',
      name: 'Polycab FR Copper Wire 1.5mm (90m Coil)',
      category: 'Electrical',
      vertical: 'hardware',
      unit: 'coil',
      costPrice: 1480,
      sellingPrice: 1890,
      taxPercent: 18,
      stockQty: 4,
      minStockLevel: 10,
      batchNumber: 'PC-1590',
      expiryDate: '',
      supplierKey: 'sup_hardware',
    },
    {
      key: 'h_drill',
      sku: 'HRD-303',
      barcode: '8903399303031',
      name: 'Bosch 13mm Impact Drill Bit Set (12 Pcs)',
      category: 'Power Tool Accessories',
      vertical: 'hardware',
      unit: 'set',
      costPrice: 490,
      sellingPrice: 720,
      taxPercent: 18,
      stockQty: 19,
      minStockLevel: 6,
      batchNumber: 'BS-1312',
      expiryDate: '',
      supplierKey: 'sup_hardware',
    },
    {
      key: 'h_pipe',
      sku: 'HRD-304',
      barcode: '8903399303048',
      name: 'Astral CPVC Plumbing Pipe 1" (3m)',
      category: 'Plumbing',
      vertical: 'hardware',
      unit: 'length',
      costPrice: 285,
      sellingPrice: 390,
      taxPercent: 18,
      stockQty: 42,
      minStockLevel: 15,
      batchNumber: 'AS-100',
      expiryDate: '',
      supplierKey: 'sup_hardware',
    },
    {
      key: 'h_lock',
      sku: 'HRD-305',
      barcode: '8903399303055',
      name: 'Godrej Nav-Tal 7-Lever Brass Padlock',
      category: 'Locks & Security',
      vertical: 'hardware',
      unit: 'pcs',
      costPrice: 340,
      sellingPrice: 495,
      taxPercent: 18,
      stockQty: 2,
      minStockLevel: 8,
      batchNumber: 'GD-701',
      expiryDate: '',
      supplierKey: 'sup_hardware',
    },
  ];

  let selectedProducts: SeedProductTemplate[];
  if (vertical === 'grocery') selectedProducts = groceryProducts;
  else if (vertical === 'pharmacy') selectedProducts = pharmacyProducts;
  else if (vertical === 'hardware') selectedProducts = hardwareProducts;
  else selectedProducts = [...groceryProducts, ...pharmacyProducts, ...hardwareProducts];

  const pickKey = (idx: number) => selectedProducts[idx % selectedProducts.length].key;
  const pickSup = (idx: number) => selectedProducts[idx % selectedProducts.length].supplierKey;

  const historicalSales: SeedDataset['historicalSales'] = [
    {
      daysAgo: 6,
      customerKey: 'cust_1',
      paymentMethod: 'upi',
      items: [
        { productKey: pickKey(0), qty: 3 },
        { productKey: pickKey(1), qty: 4 },
      ],
      paidRatio: 1,
    },
    {
      daysAgo: 5,
      customerKey: 'walk-in',
      paymentMethod: 'cash',
      items: [
        { productKey: pickKey(2), qty: 2 },
        { productKey: pickKey(3), qty: 3 },
      ],
      paidRatio: 1,
    },
    {
      daysAgo: 4,
      customerKey: 'cust_3',
      paymentMethod: 'credit',
      items: [
        { productKey: pickKey(4), qty: 4 },
        { productKey: pickKey(0), qty: 2 },
      ],
      paidRatio: 0.4,
    },
    {
      daysAgo: 3,
      customerKey: 'cust_2',
      paymentMethod: 'card',
      items: [
        { productKey: pickKey(1), qty: 2 },
        { productKey: pickKey(2), qty: 3 },
      ],
      paidRatio: 1,
    },
    {
      daysAgo: 2,
      customerKey: 'walk-in',
      paymentMethod: 'upi',
      items: [
        { productKey: pickKey(3), qty: 4 },
        { productKey: pickKey(4), qty: 2 },
      ],
      paidRatio: 1,
    },
    {
      daysAgo: 1,
      customerKey: 'cust_4',
      paymentMethod: 'upi',
      items: [
        { productKey: pickKey(0), qty: 4 },
        { productKey: pickKey(2), qty: 2 },
      ],
      paidRatio: 1,
    },
    {
      daysAgo: 0,
      customerKey: 'cust_1',
      paymentMethod: 'cash',
      items: [
        { productKey: pickKey(0), qty: 2 },
        { productKey: pickKey(3), qty: 2 },
      ],
      paidRatio: 1,
    },
  ];

  const initialPurchases: SeedDataset['initialPurchases'] = [
    {
      daysAgo: 5,
      supplierKey: pickSup(0),
      status: 'received',
      paymentStatus: 'paid',
      items: [
        { productKey: pickKey(0), qty: 15 },
        { productKey: pickKey(1), qty: 20 },
      ],
      paidRatio: 1,
    },
    {
      daysAgo: 1,
      supplierKey: pickSup(2),
      status: 'ordered',
      paymentStatus: 'partial',
      items: [
        { productKey: pickKey(1), qty: 15 },
        { productKey: pickKey(3), qty: 12 },
      ],
      paidRatio: 0.5,
    },
  ];

  const option = VERTICAL_OPTIONS.find((v) => v.id === vertical) ?? VERTICAL_OPTIONS[0];

  return {
    storeName: option.sampleStore,
    vertical,
    suppliers,
    customers,
    products: selectedProducts,
    historicalSales,
    initialPurchases,
  };
}

export function getSeedDate(daysAgo: number): string {
  return daysAgoIsoDate(daysAgo);
}
