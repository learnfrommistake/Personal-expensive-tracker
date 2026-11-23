/**
 * Personal Expense & Budget Tracker (ES6+ Modular Architecture)
 * Implements UML Classes: StorageManager, Transaction, BudgetManager, ReportExporter
 * Security: Strict DOM textContent rendering (XSS safe) & schema validation
 */

"use strict";

/* ==========================================================================
   1. Default Category Configuration (Entity: CATEGORY)
   ========================================================================== */
const DEFAULT_CATEGORIES = [
  {
    category_id: "cat_food",
    cat_name: "Food & Dining",
    cat_type: "expense",
    color_hex: "#f97316",
  },
  {
    category_id: "cat_travel",
    cat_name: "Travel & Commute",
    cat_type: "expense",
    color_hex: "#3b82f6",
  },
  {
    category_id: "cat_edu",
    cat_name: "Education & Books",
    cat_type: "expense",
    color_hex: "#8b5cf6",
  },
  {
    category_id: "cat_bills",
    cat_name: "Bills & Utilities",
    cat_type: "expense",
    color_hex: "#ef4444",
  },
  {
    category_id: "cat_shop",
    cat_name: "Shopping & Personal",
    cat_type: "expense",
    color_hex: "#ec4899",
  },
  {
    category_id: "cat_other_exp",
    cat_name: "Other Expense",
    cat_type: "expense",
    color_hex: "#64748b",
  },
  {
    category_id: "cat_salary",
    cat_name: "Salary / Stipend",
    cat_type: "income",
    color_hex: "#16a34a",
  },
  {
    category_id: "cat_allowance",
    cat_name: "Allowance / Pocket Money",
    cat_type: "income",
    color_hex: "#0d9488",
  },
  {
    category_id: "cat_freelance",
    cat_name: "Freelance / Bonus",
    cat_type: "income",
    color_hex: "#2563eb",
  },
];

/* ==========================================================================
   2. Transaction Model Class (Entity: TRANSACTION)
   ========================================================================== */
class Transaction {
  constructor({
    txn_id,
    title,
    amount,
    txn_type,
    category_id,
    txn_date,
    notes = "",
  }) {
    this.txn_id =
      txn_id ||
      (crypto.randomUUID
        ? crypto.randomUUID()
        : `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    this.title = String(title).trim();
    this.amount = Number(parseFloat(amount).toFixed(2));
    this.txn_type = txn_type === "income" ? "income" : "expense";
    this.category_id = String(category_id);
    this.txn_date = String(txn_date);
    this.notes = String(notes || "").trim();
  }

  validate() {
    if (!this.title || this.title.length === 0) {
      return {
        valid: false,
        message: "Please enter a valid transaction title.",
      };
    }
    if (!Number.isFinite(this.amount) || this.amount <= 0) {
      return {
        valid: false,
        message: "Amount must be a positive number greater than ₹0.",
      };
    }
    if (!this.category_id) {
      return { valid: false, message: "Please select a category." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.txn_date)) {
      return { valid: false, message: "Please select a valid date." };
    }
    return { valid: true, message: "" };
  }

  toJSON() {
    return {
      txn_id: this.txn_id,
      title: this.title,
      amount: this.amount,
      txn_type: this.txn_type,
      category_id: this.category_id,
      txn_date: this.txn_date,
      notes: this.notes,
    };
  }
}

/* ==========================================================================
   3. StorageManager Class (M1: State & localStorage Persistence)
   ========================================================================== */
class StorageManager {
  constructor() {
    this.KEYS = {
      TRANSACTIONS: "pebt_transactions",
      BUDGETS: "pebt_budgets",
      CATEGORIES: "pebt_categories",
      THEME: "pebt_theme",
    };
  }

  loadState() {
    try {
      const rawTxns = localStorage.getItem(this.KEYS.TRANSACTIONS);
      const rawBudgets = localStorage.getItem(this.KEYS.BUDGETS);
      const rawCats = localStorage.getItem(this.KEYS.CATEGORIES);

      const categories = rawCats ? JSON.parse(rawCats) : DEFAULT_CATEGORIES;
      if (!rawCats) {
        localStorage.setItem(
          this.KEYS.CATEGORIES,
          JSON.stringify(DEFAULT_CATEGORIES),
        );
      }

      return {
        transactions: Array.isArray(JSON.parse(rawTxns || "[]"))
          ? JSON.parse(rawTxns || "[]")
          : [],
        budgets: Array.isArray(JSON.parse(rawBudgets || "[]"))
          ? JSON.parse(rawBudgets || "[]")
          : [],
        categories,
      };
    } catch (error) {
      console.error("Storage parse failure; recovering clean state:", error);
      return { transactions: [], budgets: [], categories: DEFAULT_CATEGORIES };
    }
  }

  saveTransactions(transactions) {
    localStorage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  saveBudgets(budgets) {
    localStorage.setItem(this.KEYS.BUDGETS, JSON.stringify(budgets));
  }

  clearAllData() {
    localStorage.removeItem(this.KEYS.TRANSACTIONS);
    localStorage.removeItem(this.KEYS.BUDGETS);
  }
}

/* ==========================================================================
   4. BudgetManager Class (M3: Budget Limit & 80%/100% Alert Engine)
   ========================================================================== */
class BudgetManager {
  constructor(budgets = []) {
    this.budgets = budgets;
    this.alertThreshold = 80;
  }

  setLimit(monthYear, limitAmt) {
    const cleanAmt = Math.max(0, Number(parseFloat(limitAmt) || 0));
    const existingIndex = this.budgets.findIndex(
      (b) => b.month_year === monthYear,
    );

    if (existingIndex >= 0) {
      this.budgets[existingIndex].limit_amt = cleanAmt;
    } else {
      this.budgets.push({
        budget_id: `bud_${monthYear}`,
        month_year: monthYear,
        limit_amt: cleanAmt,
        alert_threshold_pct: this.alertThreshold,
      });
    }
    return this.budgets;
  }

  getLimitForMonth(monthYear) {
    const record = this.budgets.find((b) => b.month_year === monthYear);
    return record ? Number(record.limit_amt) : 0;
  }

  evaluateStatus(monthYear, monthlyExpenses) {
    const limit = this.getLimitForMonth(monthYear);
    if (limit <= 0) {
      return {
        limit: 0,
        spent: monthlyExpenses,
        remaining: 0,
        percentage: 0,
        status: "unset",
      };
    }

    const percentage = (monthlyExpenses / limit) * 100;
    const remaining = limit - monthlyExpenses;

    let status = "safe";
    if (percentage >= 100) {
      status = "danger";
    } else if (percentage >= this.alertThreshold) {
      status = "warning";
    }

    return {
      limit,
      spent: monthlyExpenses,
      remaining,
      percentage,
      status,
    };
  }
}

/* ==========================================================================
   5. ReportExporter Class (M5: CSV Export, Print View & JSON Backup)
   ========================================================================== */
class ReportExporter {
  static formatINR(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  static exportToCSV(transactions, categoryMap) {
    const headers = [
      "Transaction ID",
      "Date",
      "Title",
      "Category",
      "Type",
      "Amount (INR)",
      "Notes",
    ];
    const escapeCSV = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const rows = transactions.map((txn) => {
      const catName = categoryMap[txn.category_id]?.cat_name || "Uncategorized";
      return [
        escapeCSV(txn.txn_id),
        escapeCSV(txn.txn_date),
        escapeCSV(txn.title),
        escapeCSV(catName),
        escapeCSV(txn.txn_type.toUpperCase()),
        txn.amount.toFixed(2),
        escapeCSV(txn.notes),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `Expense_Statement_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static exportJSONBackup(stateData) {
    const payload = {
      app: "Personal Expense & Budget Tracker",
      exported_at: new Date().toISOString(),
      data: stateData,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `FinTrack_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/* ==========================================================================
   6. Main Application Controller (MVC Orchestration & DOM Rendering)
   ========================================================================== */
class ExpenseTrackerApp {
  constructor() {
    this.storage = new StorageManager();
    const initialState = this.storage.loadState();

    this.transactions = initialState.transactions;
    this.categories = initialState.categories;
    this.budgetManager = new BudgetManager(initialState.budgets);
    this.categoryMap = Object.fromEntries(
      this.categories.map((c) => [c.category_id, c]),
    );
    this.chartInstance = null;
    this.lastIsMobile = window.innerWidth <= 680;

    this.currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    this.cacheDOM();
    this.initTheme();
    this.initDefaults();
    this.bindEvents();
    this.render();
  }

  cacheDOM() {
    // Form Inputs
    this.form = document.getElementById("transactionForm");
    this.formHeading = document.getElementById("formHeading");
    this.editTxnId = document.getElementById("editTxnId");
    this.txnTitle = document.getElementById("txnTitle");
    this.txnAmount = document.getElementById("txnAmount");
    this.txnCategory = document.getElementById("txnCategory");
    this.txnDate = document.getElementById("txnDate");
    this.txnNotes = document.getElementById("txnNotes");
    this.formErrorMsg = document.getElementById("formErrorMsg");
    this.submitTxnBtn = document.getElementById("submitTxnBtn");
    this.cancelEditBtn = document.getElementById("cancelEditBtn");

    // KPI Elements
    this.kpiTotalIncome = document.getElementById("kpiTotalIncome");
    this.kpiTotalExpense = document.getElementById("kpiTotalExpense");
    this.kpiNetBalance = document.getElementById("kpiNetBalance");
    this.kpiSavingsRate = document.getElementById("kpiSavingsRate");
    this.kpiIncomeCount = document.getElementById("kpiIncomeCount");
    this.kpiExpenseCount = document.getElementById("kpiExpenseCount");
    this.kpiSavingsStatus = document.getElementById("kpiSavingsStatus");

    // Budget Elements
    this.budgetForm = document.getElementById("budgetForm");
    this.monthlyLimitInput = document.getElementById("monthlyLimitInput");
    this.budgetMonthDisplay = document.getElementById("budgetMonthDisplay");
    this.budgetSpentText = document.getElementById("budgetSpentText");
    this.budgetLimitText = document.getElementById("budgetLimitText");
    this.budgetRemainingText = document.getElementById("budgetRemainingText");
    this.budgetProgressBar = document.getElementById("budgetProgressBar");
    this.budgetProgressWrapper = document.getElementById(
      "budgetProgressWrapper",
    );
    this.budgetStatusBadge = document.getElementById("budgetStatusBadge");

    // Alert Banner
    this.budgetAlertBanner = document.getElementById("budgetAlertBanner");
    this.alertTitle = document.getElementById("alertTitle");
    this.alertMessage = document.getElementById("alertMessage");

    // Filters & Ledger
    this.searchInput = document.getElementById("searchInput");
    this.filterMonth = document.getElementById("filterMonth");
    this.filterCategory = document.getElementById("filterCategory");
    this.filterType = document.getElementById("filterType");
    this.resetFiltersBtn = document.getElementById("resetFiltersBtn");
    this.ledgerTableBody = document.getElementById("ledgerTableBody");
    this.ledgerCountText = document.getElementById("ledgerCountText");
    this.emptyLedgerState = document.getElementById("emptyLedgerState");
    this.printPeriodLabel = document.getElementById("printPeriodLabel");

    // Chart
    this.chartCanvas = document.getElementById("expenseChart");
    this.emptyChartState = document.getElementById("emptyChartState");
  }

  initTheme() {
    const savedTheme = localStorage.getItem(this.storage.KEYS.THEME) || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.getElementById("themeIcon").textContent =
      savedTheme === "dark" ? "☀️" : "🌙";
  }

  initDefaults() {
    const today = new Date().toISOString().slice(0, 10);
    this.txnDate.value = today;
    this.filterMonth.value = this.currentMonth;
    this.populateCategoryDropdowns("expense");
  }

  populateCategoryDropdowns(selectedType = "expense") {
    this.txnCategory.innerHTML = "";
    this.categories
      .filter((cat) => cat.cat_type === selectedType)
      .forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat.category_id;
        opt.textContent = cat.cat_name;
        this.txnCategory.appendChild(opt);
      });

    if (this.filterCategory.options.length <= 1) {
      this.categories.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat.category_id;
        opt.textContent = `${cat.cat_name} (${cat.cat_type})`;
        this.filterCategory.appendChild(opt);
      });
    }
  }

  bindEvents() {
    // Re-position chart legend automatically when switching between mobile and desktop widths
    window.addEventListener("resize", () => {
      const isMobileNow = window.innerWidth <= 680;
      if (isMobileNow !== this.lastIsMobile) {
        this.lastIsMobile = isMobileNow;
        this.renderChart(this.getFilteredTransactions());
      }
    });

    document.querySelectorAll('input[name="txnType"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.populateCategoryDropdowns(e.target.value);
      });
    });

    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleTransactionSubmit();
    });

    this.cancelEditBtn.addEventListener("click", () => this.resetForm());

    this.budgetForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const targetMonth = this.filterMonth.value || this.currentMonth;
      const limitVal = parseFloat(this.monthlyLimitInput.value);
      if (Number.isNaN(limitVal) || limitVal < 0) return;

      const updatedBudgets = this.budgetManager.setLimit(targetMonth, limitVal);
      this.storage.saveBudgets(updatedBudgets);
      this.monthlyLimitInput.value = "";
      this.render();
    });

    [
      this.searchInput,
      this.filterMonth,
      this.filterCategory,
      this.filterType,
    ].forEach((el) => {
      el.addEventListener("input", () => this.render());
    });

    this.resetFiltersBtn.addEventListener("click", () => {
      this.searchInput.value = "";
      this.filterMonth.value = this.currentMonth;
      this.filterCategory.value = "all";
      this.filterType.value = "all";
      this.render();
    });

    document.getElementById("exportCsvBtn").addEventListener("click", () => {
      const filtered = this.getFilteredTransactions();
      if (filtered.length === 0) {
        alert("No transactions in the current view to export.");
        return;
      }
      ReportExporter.exportToCSV(filtered, this.categoryMap);
    });

    document.getElementById("printReportBtn").addEventListener("click", () => {
      window.print();
    });

    document.getElementById("exportBackupBtn").addEventListener("click", () => {
      ReportExporter.exportJSONBackup({
        transactions: this.transactions,
        budgets: this.budgetManager.budgets,
      });
    });

    document
      .getElementById("importBackupInput")
      .addEventListener("change", (e) => {
        this.handleJSONImport(e);
      });

    document.getElementById("clearAllBtn").addEventListener("click", () => {
      if (
        confirm("Delete all saved transactions and budget caps permanently?")
      ) {
        this.transactions = [];
        this.budgetManager.budgets = [];
        this.storage.clearAllData();
        this.resetForm();
        this.render();
      }
    });

    document
      .getElementById("seedDemoBtn")
      .addEventListener("click", () => this.loadSampleData());

    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(this.storage.KEYS.THEME, next);
      document.getElementById("themeIcon").textContent =
        next === "dark" ? "☀️" : "🌙";
      this.render();
    });
  }

  handleTransactionSubmit() {
    const selectedType = document.querySelector(
      'input[name="txnType"]:checked',
    ).value;
    const editId = this.editTxnId.value;

    const txnObj = new Transaction({
      txn_id: editId || undefined,
      title: this.txnTitle.value,
      amount: this.txnAmount.value,
      txn_type: selectedType,
      category_id: this.txnCategory.value,
      txn_date: this.txnDate.value,
      notes: this.txnNotes.value,
    });

    const validation = txnObj.validate();
    if (!validation.valid) {
      this.formErrorMsg.textContent = validation.message;
      this.formErrorMsg.classList.remove("hidden");
      return;
    }

    this.formErrorMsg.classList.add("hidden");

    if (editId) {
      const idx = this.transactions.findIndex((t) => t.txn_id === editId);
      if (idx !== -1) this.transactions[idx] = txnObj.toJSON();
    } else {
      this.transactions.unshift(txnObj.toJSON());
    }

    this.storage.saveTransactions(this.transactions);
    this.resetForm();
    this.render();
  }

  startEditTransaction(txnId) {
    const txn = this.transactions.find((t) => t.txn_id === txnId);
    if (!txn) return;

    this.editTxnId.value = txn.txn_id;
    document.querySelector(
      `input[name="txnType"][value="${txn.txn_type}"]`,
    ).checked = true;
    this.populateCategoryDropdowns(txn.txn_type);

    this.txnTitle.value = txn.title;
    this.txnAmount.value = txn.amount;
    this.txnCategory.value = txn.category_id;
    this.txnDate.value = txn.txn_date;
    this.txnNotes.value = txn.notes || "";

    this.formHeading.textContent = "Edit Transaction";
    this.submitTxnBtn.textContent = "Update Transaction";
    this.cancelEditBtn.classList.remove("hidden");
    this.form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  deleteTransaction(txnId) {
    if (!confirm("Remove this transaction from your ledger?")) return;
    this.transactions = this.transactions.filter((t) => t.txn_id !== txnId);
    this.storage.saveTransactions(this.transactions);
    if (this.editTxnId.value === txnId) this.resetForm();
    this.render();
  }

  resetForm() {
    this.form.reset();
    this.editTxnId.value = "";
    this.txnDate.value = new Date().toISOString().slice(0, 10);
    document.querySelector('input[name="txnType"][value="expense"]').checked =
      true;
    this.populateCategoryDropdowns("expense");
    this.formHeading.textContent = "Add New Transaction";
    this.submitTxnBtn.textContent = "Save Transaction";
    this.cancelEditBtn.classList.add("hidden");
    this.formErrorMsg.classList.add("hidden");
  }

  getFilteredTransactions() {
    const keyword = this.searchInput.value.trim().toLowerCase();
    const monthVal = this.filterMonth.value;
    const catVal = this.filterCategory.value;
    const typeVal = this.filterType.value;

    return this.transactions
      .filter((txn) => {
        const matchesMonth = !monthVal || txn.txn_date.startsWith(monthVal);
        const matchesCategory = catVal === "all" || txn.category_id === catVal;
        const matchesType = typeVal === "all" || txn.txn_type === typeVal;
        const matchesKeyword =
          !keyword ||
          txn.title.toLowerCase().includes(keyword) ||
          (txn.notes && txn.notes.toLowerCase().includes(keyword));
        return matchesMonth && matchesCategory && matchesType && matchesKeyword;
      })
      .sort((a, b) => b.txn_date.localeCompare(a.txn_date));
  }

  render() {
    const filtered = this.getFilteredTransactions();
    this.renderKPIs(filtered);
    this.renderBudgetSection();
    this.renderLedgerTable(filtered);
    this.renderChart(filtered);

    const periodLabel = this.filterMonth.value
      ? `Month: ${this.filterMonth.value}`
      : "All Time";
    this.printPeriodLabel.textContent = `Statement Period: ${periodLabel} | Generated on ${new Date().toLocaleDateString("en-IN")}`;
  }

  renderKPIs(filteredList) {
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    filteredList.forEach((txn) => {
      if (txn.txn_type === "income") {
        totalIncome += txn.amount;
        incomeCount++;
      } else {
        totalExpense += txn.amount;
        expenseCount++;
      }
    });

    const netBalance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

    this.kpiTotalIncome.textContent = ReportExporter.formatINR(totalIncome);
    this.kpiTotalExpense.textContent = ReportExporter.formatINR(totalExpense);
    this.kpiNetBalance.textContent = ReportExporter.formatINR(netBalance);
    this.kpiNetBalance.style.color =
      netBalance < 0 ? "var(--danger)" : "var(--text-primary)";

    this.kpiIncomeCount.textContent = `${incomeCount} income ${incomeCount === 1 ? "entry" : "entries"}`;
    this.kpiExpenseCount.textContent = `${expenseCount} expense ${expenseCount === 1 ? "entry" : "entries"}`;

    this.kpiSavingsRate.textContent = `${savingsRate.toFixed(1)}%`;
    if (totalIncome === 0) {
      this.kpiSavingsStatus.textContent = "Add income to compute savings";
    } else if (savingsRate >= 20) {
      this.kpiSavingsStatus.textContent = "Healthy savings surplus";
    } else if (savingsRate >= 0) {
      this.kpiSavingsStatus.textContent = "Low savings margin";
    } else {
      this.kpiSavingsStatus.textContent = "Deficit: Spending exceeds income";
    }
  }

  renderBudgetSection() {
    const activeMonth = this.filterMonth.value || this.currentMonth;
    this.budgetMonthDisplay.textContent = `Month: ${activeMonth}`;

    const monthlyExpenseSum = this.transactions
      .filter(
        (t) => t.txn_type === "expense" && t.txn_date.startsWith(activeMonth),
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const evalResult = this.budgetManager.evaluateStatus(
      activeMonth,
      monthlyExpenseSum,
    );

    this.budgetSpentText.textContent = ReportExporter.formatINR(
      evalResult.spent,
    );
    this.budgetLimitText.textContent =
      evalResult.limit > 0
        ? ReportExporter.formatINR(evalResult.limit)
        : "Not Set";
    this.budgetRemainingText.textContent =
      evalResult.limit > 0
        ? ReportExporter.formatINR(evalResult.remaining)
        : "—";
    this.budgetRemainingText.style.color =
      evalResult.remaining < 0 ? "var(--danger)" : "inherit";

    const cappedWidth = Math.min(100, Math.max(0, evalResult.percentage));
    this.budgetProgressBar.style.width = `${cappedWidth}%`;
    this.budgetProgressWrapper.setAttribute(
      "aria-valuenow",
      Math.round(evalResult.percentage),
    );

    this.budgetProgressBar.className = "progress-bar";
    this.budgetStatusBadge.className = "status-pill";
    this.budgetAlertBanner.className = "alert-banner hidden";

    if (evalResult.status === "unset") {
      this.budgetProgressBar.classList.add("status-safe");
      this.budgetStatusBadge.classList.add("status-safe");
      this.budgetStatusBadge.textContent = "No Monthly Cap Configured";
    } else if (evalResult.status === "danger") {
      this.budgetProgressBar.classList.add("status-danger");
      this.budgetStatusBadge.classList.add("status-danger");
      this.budgetStatusBadge.textContent = `Exceeded (${evalResult.percentage.toFixed(1)}%)`;

      this.budgetAlertBanner.className = "alert-banner alert-danger";
      this.alertTitle.textContent = `Monthly Budget Exceeded (${evalResult.percentage.toFixed(1)}%)`;
      this.alertMessage.textContent = `You have spent ${ReportExporter.formatINR(evalResult.spent)} against your ${ReportExporter.formatINR(evalResult.limit)} cap for ${activeMonth}.`;
    } else if (evalResult.status === "warning") {
      this.budgetProgressBar.classList.add("status-warning");
      this.budgetStatusBadge.classList.add("status-warning");
      this.budgetStatusBadge.textContent = `Approaching Limit (${evalResult.percentage.toFixed(1)}%)`;

      this.budgetAlertBanner.className = "alert-banner alert-warning";
      this.alertTitle.textContent = `Approaching Monthly Limit (${evalResult.percentage.toFixed(1)}%)`;
      this.alertMessage.textContent = `Only ${ReportExporter.formatINR(evalResult.remaining)} remaining in your ${activeMonth} budget.`;
    } else {
      this.budgetProgressBar.classList.add("status-safe");
      this.budgetStatusBadge.classList.add("status-safe");
      this.budgetStatusBadge.textContent = `On Track (${evalResult.percentage.toFixed(1)}%)`;
    }
  }

  renderLedgerTable(filteredList) {
    this.ledgerTableBody.innerHTML = "";
    this.ledgerCountText.textContent = `Showing ${filteredList.length} ${filteredList.length === 1 ? "record" : "records"}`;

    if (filteredList.length === 0) {
      this.emptyLedgerState.classList.remove("hidden");
      return;
    }

    this.emptyLedgerState.classList.add("hidden");

    filteredList.forEach((txn) => {
      const tr = document.createElement("tr");
      const cat = this.categoryMap[txn.category_id] || {
        cat_name: "General",
        color_hex: "#64748b",
      };

      // 1. Title & Notes Cell (Appears at top of mobile card)
      const tdTitle = document.createElement("td");
      tdTitle.className = "txn-title-cell";
      tdTitle.setAttribute("data-label", "Title");
      const strongTitle = document.createElement("strong");
      strongTitle.textContent = txn.title;
      tdTitle.appendChild(strongTitle);

      if (txn.notes) {
        const smallNote = document.createElement("small");
        smallNote.textContent = txn.notes;
        tdTitle.appendChild(smallNote);
      }

      // 2. Date Cell
      const tdDate = document.createElement("td");
      tdDate.setAttribute("data-label", "Date");
      tdDate.textContent = txn.txn_date;

      // 3. Category Badge Cell
      const tdCat = document.createElement("td");
      tdCat.setAttribute("data-label", "Category");
      const badge = document.createElement("span");
      badge.className = "cat-badge";
      const dot = document.createElement("span");
      dot.className = "cat-dot";
      dot.style.backgroundColor = cat.color_hex;
      badge.appendChild(dot);
      badge.appendChild(document.createTextNode(cat.cat_name));
      tdCat.appendChild(badge);

      // 4. Type Cell
      const tdType = document.createElement("td");
      tdType.setAttribute("data-label", "Type");
      tdType.textContent = txn.txn_type === "income" ? "Income" : "Expense";

      // 5. Amount Cell
      const tdAmt = document.createElement("td");
      tdAmt.setAttribute("data-label", "Amount");
      tdAmt.className = `text-right ${txn.txn_type === "income" ? "amt-income" : "amt-expense"}`;
      const prefix = txn.txn_type === "income" ? "+" : "-";
      tdAmt.textContent = `${prefix}${ReportExporter.formatINR(txn.amount)}`;

      // 6. Actions Cell
      const tdActions = document.createElement("td");
      tdActions.setAttribute("data-label", "Actions");
      tdActions.className = "text-center no-print";
      const actionWrap = document.createElement("div");
      actionWrap.className = "action-btns";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn-table";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () =>
        this.startEditTransaction(txn.txn_id),
      );

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-table delete";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () =>
        this.deleteTransaction(txn.txn_id),
      );

      actionWrap.append(editBtn, delBtn);
      tdActions.appendChild(actionWrap);

      tr.append(tdDate, tdTitle, tdCat, tdType, tdAmt, tdActions);
      this.ledgerTableBody.appendChild(tr);
    });
  }

  renderChart(filteredList) {
    if (typeof Chart === "undefined") return;

    const expenseTotals = {};
    filteredList
      .filter((t) => t.txn_type === "expense")
      .forEach((txn) => {
        expenseTotals[txn.category_id] =
          (expenseTotals[txn.category_id] || 0) + txn.amount;
      });

    const categoryIds = Object.keys(expenseTotals);

    if (categoryIds.length === 0) {
      this.emptyChartState.classList.remove("hidden");
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }
      return;
    }

    this.emptyChartState.classList.add("hidden");

    const labels = categoryIds.map(
      (id) => this.categoryMap[id]?.cat_name || "Other",
    );
    const dataValues = categoryIds.map((id) => expenseTotals[id]);
    const bgColors = categoryIds.map(
      (id) => this.categoryMap[id]?.color_hex || "#64748b",
    );
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const isMobile = window.innerWidth <= 680;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    this.chartInstance = new Chart(this.chartCanvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: dataValues,
            backgroundColor: bgColors,
            borderWidth: 2,
            borderColor: isDark ? "#1e293b" : "#ffffff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: isMobile ? "bottom" : "right",
            labels: {
              color: isDark ? "#cbd5e1" : "#334155",
              boxWidth: 12,
              padding: isMobile ? 10 : 14,
              font: { family: "Inter", size: isMobile ? 11 : 12 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ReportExporter.formatINR(ctx.parsed)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  handleJSONImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const importedTxns = parsed?.data?.transactions;
        const importedBudgets = parsed?.data?.budgets;

        if (!Array.isArray(importedTxns)) {
          throw new Error("Invalid backup structure.");
        }

        const sanitizedTxns = importedTxns
          .map((item) => new Transaction(item))
          .filter((txn) => txn.validate().valid)
          .map((txn) => txn.toJSON());

        this.transactions = sanitizedTxns;
        this.storage.saveTransactions(this.transactions);

        if (Array.isArray(importedBudgets)) {
          this.budgetManager.budgets = importedBudgets;
          this.storage.saveBudgets(importedBudgets);
        }

        this.render();
        alert(`Successfully restored ${sanitizedTxns.length} transactions.`);
      } catch (err) {
        alert("Backup restore failed: Corrupted or invalid JSON file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  loadSampleData() {
    const month = this.filterMonth.value || this.currentMonth;
    const samples = [
      new Transaction({
        title: "Monthly Pocket Allowance",
        amount: 15000,
        txn_type: "income",
        category_id: "cat_allowance",
        txn_date: `${month}-01`,
        notes: "UPI transfer",
      }),
      new Transaction({
        title: "Freelance Web Landing Page",
        amount: 6500,
        txn_type: "income",
        category_id: "cat_freelance",
        txn_date: `${month}-08`,
        notes: "Client milestone",
      }),
      new Transaction({
        title: "Hostel & Mess Food",
        amount: 4200,
        txn_type: "expense",
        category_id: "cat_food",
        txn_date: `${month}-03`,
        notes: "Monthly mess card",
      }),
      new Transaction({
        title: "Dehradun - Delhi Bus Ticket",
        amount: 1150,
        txn_type: "expense",
        category_id: "cat_travel",
        txn_date: `${month}-06`,
        notes: "FlixBus booking",
      }),
      new Transaction({
        title: "BCA Project Spiral Binding & Print",
        amount: 650,
        txn_type: "expense",
        category_id: "cat_edu",
        txn_date: `${month}-10`,
        notes: "Synopsis submission",
      }),
      new Transaction({
        title: "Mobile & Broadband Recharge",
        amount: 899,
        txn_type: "expense",
        category_id: "cat_bills",
        txn_date: `${month}-12`,
        notes: "Monthly plan",
      }),
      new Transaction({
        title: "Weekend Cafe & Snacks",
        amount: 1450,
        txn_type: "expense",
        category_id: "cat_food",
        txn_date: `${month}-15`,
        notes: "Group hangout",
      }),
    ].map((t) => t.toJSON());

    this.transactions = [...samples, ...this.transactions];
    this.storage.saveTransactions(this.transactions);

    const updatedBudgets = this.budgetManager.setLimit(month, 10000);
    this.storage.saveBudgets(updatedBudgets);

    this.render();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.expenseApp = new ExpenseTrackerApp();
});
