/**
 * RentReceipt Local IndexedDB Storage Engine
 * 
 * 100% Local. Zero Network. No Cloud.
 * Stores tenants, payment records, ledgers, and landlord settings.
 */

const DB_NAME = 'RentReceiptDB';
const DB_VERSION = 1;

let dbInstance = null;

// In-memory fallback store for Node.js test execution
const memoryStore = {
  tenants: new Map(),
  payments: new Map(),
  settings: new Map([
    ['landlord', {
      name: 'Property Manager',
      phone: '',
      email: '',
      address: '',
      receiptPrefix: 'RR-',
      receiptNotes: 'Thank you for your timely payment.'
    }]
  ])
};

const isBrowserIndexedDB = typeof indexedDB !== 'undefined';

/**
 * Open and initialize IndexedDB database connection.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (!isBrowserIndexedDB) {
    return Promise.resolve(null);
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Tenants store
      if (!db.objectStoreNames.contains('tenants')) {
        const tenantStore = db.createObjectStore('tenants', { keyPath: 'id' });
        tenantStore.createIndex('name', 'name', { unique: false });
        tenantStore.createIndex('unit', 'unit', { unique: false });
      }

      // Payments store
      if (!db.objectStoreNames.contains('payments')) {
        const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
        paymentStore.createIndex('tenantId', 'tenantId', { unique: false });
        paymentStore.createIndex('date', 'date', { unique: false });
        paymentStore.createIndex('receiptNumber', 'receiptNumber', { unique: true });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Tenants CRUD
 */
export async function getTenants() {
  if (!isBrowserIndexedDB) {
    return Array.from(memoryStore.tenants.values());
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tenants', 'readonly');
    const store = tx.objectStore('tenants');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getTenant(id) {
  if (!isBrowserIndexedDB) {
    return memoryStore.tenants.get(id) || null;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tenants', 'readonly');
    const store = tx.objectStore('tenants');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTenant(tenant) {
  if (!tenant.id) {
    tenant.id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  tenant.updatedAt = new Date().toISOString();
  if (!tenant.createdAt) {
    tenant.createdAt = tenant.updatedAt;
  }

  if (!isBrowserIndexedDB) {
    memoryStore.tenants.set(tenant.id, { ...tenant });
    return tenant;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tenants', 'readwrite');
    const store = tx.objectStore('tenants');
    const req = store.put(tenant);
    req.onsuccess = () => resolve(tenant);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTenant(id) {
  if (!isBrowserIndexedDB) {
    memoryStore.tenants.delete(id);
    return true;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tenants', 'readwrite');
    const store = tx.objectStore('tenants');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Payments CRUD
 */
export async function getPayments() {
  if (!isBrowserIndexedDB) {
    return Array.from(memoryStore.payments.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('payments', 'readonly');
    const store = tx.objectStore('payments');
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPayment(id) {
  if (!isBrowserIndexedDB) {
    return memoryStore.payments.get(id) || null;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('payments', 'readonly');
    const store = tx.objectStore('payments');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getPaymentsByTenant(tenantId) {
  const all = await getPayments();
  return all.filter(p => p.tenantId === tenantId);
}

export async function savePayment(payment) {
  if (!payment.id) {
    payment.id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  if (!payment.receiptNumber) {
    const year = (payment.date || new Date().toISOString().slice(0, 10)).slice(0, 4);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    payment.receiptNumber = `RR-${year}-${randomSuffix}`;
  }
  payment.updatedAt = new Date().toISOString();
  if (!payment.createdAt) {
    payment.createdAt = payment.updatedAt;
  }

  if (!isBrowserIndexedDB) {
    memoryStore.payments.set(payment.id, { ...payment });
    return payment;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('payments', 'readwrite');
    const store = tx.objectStore('payments');
    const req = store.put(payment);
    req.onsuccess = () => resolve(payment);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePayment(id) {
  if (!isBrowserIndexedDB) {
    memoryStore.payments.delete(id);
    return true;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('payments', 'readwrite');
    const store = tx.objectStore('payments');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Settings
 */
const DEFAULT_SETTINGS = {
  landlordName: 'Property Manager',
  landlordPhone: '',
  landlordEmail: '',
  propertyAddress: '',
  receiptPrefix: 'RR-',
  receiptNotes: 'Thank you for your prompt payment.',
  currencySymbol: '$'
};

export async function getSettings() {
  if (!isBrowserIndexedDB) {
    const stored = memoryStore.settings.get('landlord');
    return { ...DEFAULT_SETTINGS, ...stored };
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get('landlord');
    req.onsuccess = () => {
      resolve({ ...DEFAULT_SETTINGS, ...(req.result?.value || {}) });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  if (!isBrowserIndexedDB) {
    memoryStore.settings.set('landlord', merged);
    return merged;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key: 'landlord', value: merged });
    req.onsuccess = () => resolve(merged);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Data Export & Import (100% JSON, Local Backup)
 */
export async function exportAllData() {
  const [tenants, payments, settings] = await Promise.all([
    getTenants(),
    getPayments(),
    getSettings()
  ]);

  return {
    app: 'RentReceipt',
    version: 1,
    exportedAt: new Date().toISOString(),
    tenants,
    payments,
    settings
  };
}

export async function importAllData(data, { mode = 'replace' } = {}) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup file: Not a JSON object');
  }
  if (!Array.isArray(data.tenants) || !Array.isArray(data.payments)) {
    throw new Error('Invalid backup file schema: Missing tenants or payments array');
  }

  if (mode === 'replace') {
    if (!isBrowserIndexedDB) {
      memoryStore.tenants.clear();
      memoryStore.payments.clear();
      data.tenants.forEach(t => memoryStore.tenants.set(t.id, t));
      data.payments.forEach(p => memoryStore.payments.set(p.id, p));
      if (data.settings) memoryStore.settings.set('landlord', data.settings);
    } else {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['tenants', 'payments', 'settings'], 'readwrite');
        tx.objectStore('tenants').clear();
        tx.objectStore('payments').clear();
        data.tenants.forEach(t => tx.objectStore('tenants').put(t));
        data.payments.forEach(p => tx.objectStore('payments').put(p));
        if (data.settings) {
          tx.objectStore('settings').put({ key: 'landlord', value: data.settings });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } else { // merge
    for (const t of data.tenants) {
      await saveTenant(t);
    }
    for (const p of data.payments) {
      await savePayment(p);
    }
    if (data.settings) {
      await saveSettings(data.settings);
    }
  }

  return {
    tenantsRestored: data.tenants.length,
    paymentsRestored: data.payments.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Reset / clear all records (Used for fresh state / testing)
 */
export async function resetDatabase() {
  if (!isBrowserIndexedDB) {
    memoryStore.tenants.clear();
    memoryStore.payments.clear();
    memoryStore.settings.clear();
    return true;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['tenants', 'payments', 'settings'], 'readwrite');
    tx.objectStore('tenants').clear();
    tx.objectStore('payments').clear();
    tx.objectStore('settings').clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
