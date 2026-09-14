/**
 * FIA CLEAN & CARE - Application Bootstrapper & Main Controller
 * Orchestrates modules, tab routing, barcode scanner, modals, and lifecycle initialization.
 */

// Core Modules
import {
    state,
    loadFromLocalStorage,
    startAutomaticBackup,
    todayDDMMYYYY,
    getTodayDateString
} from './core/state.js?v=47.7';
import {
    startRealtimeSync,
    pullFromFirebase,
    syncToFirebase,
    manualCloudSync,
    downloadFullBackup,
    openBackupFilePicker,
    restoreFullBackup
} from './core/db.js?v=47.7';
import {
    verifyLoginPin,
    logoutApp,
    togglePinVisibility,
    openChangePinModal,
    closeChangePinModal,
    submitChangePin,
    openResetPinModal,
    closeResetPinModal,
    verifyMasterKeyAndReset,
    saveNewPin,
    openSettingsModal,
    closeSettingsModal
} from './core/auth.js?v=47.7';

// Feature Modules
import {
    updateDashboard,
    checkLowStockAlerts,
    openDueAmountList,
    closeDueAmountList,
    renderDueAmountList,
    deleteDueBillFromList,
    openLowStockList,
    closeLowStockList,
    goToAddStockFromLowStock,
    pushDashboardModalState
} from './dashboard/dashboard.js?v=47.7';

import {
    saveDirectCustomer,
    editCustomerProfile,
    deleteDirectCustomer,
    renderDirectCustomerList,
    resetDirectCustomerForm,
    updateCustomerDropdown,
    fillExistingCustomer,
    updateCosCustomerDropdown,
    fillCosExistingCustomer,
    switchCustomerSubTab,
    switchCustomerConsolidationView,
    renderCustomerConsolidationView,
    openCustomerConsolidationCustomer,
    closeCustomerConsolidatedDetail,
    shareSelectedCustomerConsolidatedDetail,
    renderCustomerConsolidationReport,
    shareCustomerConsolidationReport
} from './customers/customer.js?v=47.7';

import {
    previewBill,
    previewCosSaleBill,
    printBill,
    downloadBillPDF,
    generateBillPdfBlob,
    generateBillImageBlob,
    shareBillSmartWhatsApp,
    shareBillPdfWhatsApp,
    shareBillImageWhatsApp,
    downloadBillImage,
    sendBillViaWhatsApp,
    closeBillPreview
} from './billing/invoice-preview.js?v=47.7';

import {
    renderSalesHistory,
    renderCustomerSalesHistory,
    deleteCustomerBill,
    deleteCosSale,
    adjustEditedPayment,
    adjustCosmeticsSalePayment
} from './billing/billing-history.js?v=47.7';

import {
    getProductWholesalePrice,
    getProductRetailPrice,
    updateBillTypeBadge,
    quickSaveProductRate,
    updateCurrentBillItemsSaleType,
    updateBillRateNotice,
    updateProductDropdown,
    onCosSaleTypeChange,
    fillCosSalesStockDetails,
    calculateCosSalesTotal,
    addToCosBillItems,
    renderCosBillPreviewInput,
    editCosBillItem,
    calculateCosSalesBalance,
    onSaleTypeChange,
    fillProductPrice,
    onPackVariantSelected,
    onBillQtyOrUnitChange,
    calculateItemTotal,
    stepStdBillUnits,
    stepCombinedBillUnits,
    stepCosBillUnits,
    sortBillItemsAlphabetically,
    editBillItem,
    addToBillItems,
    renderBillPreviewInput,
    updateCombinedCustomerSelect,
    fillCombinedCustomer,
    updateCombinedProductSelect,
    fillCombinedProductPrice,
    onCombinedPackVariantSelected,
    onCombinedSaleTypeChange,
    calculateCombinedItemTotal,
    addToCombinedBill,
    renderCombinedBillItems,
    editCombinedBillItem,
    calculateCombinedBalance,
    getNextCombinedBillNumber,
    resetCombinedBillForm,
    saveCombinedBill,
    getNextCosBillNumber,
    getNextBillNumber,
    calculateBalance,
    saveCustomer,
    renderCustomers,
    editCustomerBill,
    editCombinedSavedBill,
    resetCustomerForm,
    saveCosSales,
    renderCosSales,
    resetCosSalesForm,
    renderCosmeticsSummary
} from './billing/billing.js?v=47.7';

import {
    updatePackageSelectors,
    addProductVariantRow,
    addPresetProductVariant,
    getProductFormVariants,
    renderProductVariants,
    clearProductVariants,
    normalizePackageMapping,
    switchPackageActionTab,
    switchStockTopTab,
    switchStockSubTab,
    switchStockActionTab,
    savePackage,
    resetPackageForm,
    editPackage,
    deletePackage,
    addPackageStock,
    renderPackages,
    switchPackageView,
    renderPackageConsolidationReport,
    getProductPackageInfo,
    getPackageSellingUnits,
    resolvePackageInfoForItem,
    restorePackageStock,
    checkAndDeductPackageStock,
    saveProduct,
    addCleaningStock,
    updateCleaningAddStockDropdown,
    saveStockReturn,
    updateStockReturnDropdowns,
    renderStockReturnHistory,

    renderProducts,
    editProduct,
    deleteProduct,
    resetProductForm,
    saveCosProduct,
    addCosmeticStock,
    editCosProduct,
    deleteCosProduct,
    renderCosProductStock,
    resetCosProductForm,
    showCosmeticStockList,
    updateCosProductDropdowns,
    renderConsolidatedStockReport,
    viewProduct,
    viewCosProduct,
    viewPackage
} from './operations/stock.js?v=47.7';

import {
    getTodayPurchaseDate,
    loadPurchaseSuppliers,
    renderPurchaseSupplierList,
    findPurchaseSupplier,
    fillPurchaseSupplierMobile,
    fillCosPurchaseSupplierMobile,
    selectPurchaseSupplier,
    addPurchaseSupplier,
    switchPurchaseSubTab,
    switchPurchaseActionTab,
    updateCleaningPurchaseDropdown,
    togglePurchaseInputs,
    fillPurchaseStockDetails,
    calculatePurchaseTotal,
    calculatePurchaseBalance,
    ensurePurchaseTimestamps,
    savePurchase,
    editPurchase,
    deletePurchase,
    renderPurchases,
    resetPurchaseForm,
    renderPurchaseReturnSelectors,
    fillPurchaseReturnDetails,
    savePurchaseReturn,
    renderPurchaseReturnHistory,
    renderCosPurchaseReturnSelectors,
    fillCosPurchaseReturnDetails,
    renderCosPurchaseReturnHistory,
    renderPurchaseHistory,
    toggleCosPurchaseInputs,
    fillCosPurchaseStockDetails,
    calculateCosPurchaseTotal,
    calculateCosPurchaseBalance,
    saveCosPurchase,
    viewPurchase,
    viewCosPurchase,
    editCosPurchase,
    deleteCosPurchase,
    renderCosPurchases,
    resetCosPurchaseForm,
    updatePurchaseReturnLiveCalc,
    openPurchaseReturn,
    deletePurchaseReturn,
    getConsolidatedPurchaseData,
    switchPurchaseConsolidationView,
    renderPurchaseConsolidationView,
    renderPurchaseConsolidationReport,
    openSupplierConsolidatedDetail,
    closeSupplierConsolidatedDetail,
    shareSelectedSupplierConsolidatedDetail,
    sharePurchaseConsolidationReport,
    downloadPurchaseConsolidationReportPDF
} from './operations/purchases.js?v=47.7';

import {
    saveExpense,
    editExpense,
    deleteExpense,
    renderExpenses,
    resetExpenseForm,
    viewExpense
} from './operations/expenses.js?v=47.7';

import {
    dashboardDateKey,
    setupDateFields,
    updateDayBookPresetButtons,
    setFilterPreset,
    onDayBookDateInputChange,
    restoreClearedDayBook,
    ensureStableTransactionIds,
    getAllMasterEntries,
    clearDayBook,
    deleteDayBookEntry,
    saveDayBookOpeningValues,
    renderAccounts,
    exportDayBookToCSV
} from './daybook/daybook.js?v=47.7';

// ================= RECORD VIEW MODAL =================
export function showRecordView(title, html) {
    const titleEl = document.getElementById('recordViewTitle');
    const contentEl = document.getElementById('recordViewContent');
    const modalEl = document.getElementById('recordViewModal');
    if (titleEl) titleEl.textContent = title;
    if (contentEl) contentEl.innerHTML = html;
    if (modalEl) modalEl.classList.remove('hidden');
}

export function closeRecordView() {
    const modalEl = document.getElementById('recordViewModal');
    if (modalEl) modalEl.classList.add('hidden');
}

// ================= BARCODE SCANNER ENGINE =================
let codeReader = null;
let scannerTargetMode = 'stock';

export function openBarcodeScanner() {
    scannerTargetMode = 'stock';
    document.getElementById('barcodeScannerModal')?.classList.remove('hidden');
    startScannerEngine();
}

export function openBarcodeScannerForBilling() {
    scannerTargetMode = 'billing';
    document.getElementById('barcodeScannerModal')?.classList.remove('hidden');
    startScannerEngine();
}

export function openBarcodeScannerForCosmeticStock() {
    scannerTargetMode = 'cosmetic-stock';
    document.getElementById('barcodeScannerModal')?.classList.remove('hidden');
    startScannerEngine();
}

export function openBarcodeScannerForCosmeticsSales() {
    scannerTargetMode = 'cosmetics-sales';
    document.getElementById('barcodeScannerModal')?.classList.remove('hidden');
    startScannerEngine();
}

export function openBarcodeScannerForCleaningPurchase() {
    scannerTargetMode = 'cleaning-purchase';
    document.getElementById('barcodeScannerModal')?.classList.remove('hidden');
    startScannerEngine();
}

export function openBarcodeScannerForCosmeticsPurchase() {
    scannerTargetMode = 'cosmetics-purchase';
    document.getElementById('barcodeScannerModal')?.classList.remove('hidden');
    startScannerEngine();
}

export async function startScannerEngine() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera access is not supported by this browser.');
        }
        const video = document.getElementById('videoScannerElement');
        if (!video) throw new Error('Camera preview not found.');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();

        if (!codeReader && typeof ZXing !== 'undefined') {
            codeReader = new ZXing.BrowserBarcodeReader();
        }
        if (codeReader) {
            codeReader.decodeFromConstraints(
                { video: { facingMode: { ideal: 'environment' } }, audio: false },
                'videoScannerElement',
                (result, err) => {
                    if (!result) return;
                    const scannedCode = result.text;
                    closeBarcodeScanner();
                    if (scannerTargetMode === 'stock') {
                        const el = document.getElementById('prodBarcode');
                        if (el) el.value = scannedCode;
                    } else if (scannerTargetMode === 'cosmetic-stock') {
                        const el = document.getElementById('cosProdBarcode');
                        if (el) el.value = scannedCode;
                    } else if (scannerTargetMode === 'billing') {
                        const matchedProd = state.products.find(p => p.barcode === scannedCode || String(p.name || '').toLowerCase() === scannedCode.toLowerCase());
                        if (matchedProd) {
                            const pSel = document.getElementById('billProductSelect');
                            if (pSel) pSel.value = matchedProd.name;
                            fillProductPrice();
                        } else {
                            alert('Scanned Code (' + scannedCode + ') not found in cleaning products!');
                        }
                    } else if (scannerTargetMode === 'cleaning-purchase') {
                        const matchedProd = state.products.find(p => p.barcode === scannedCode || String(p.name || '').toLowerCase() === scannedCode.toLowerCase());
                        const rBar = document.getElementById('rawBarcode');
                        if (rBar) rBar.value = scannedCode;
                        if (matchedProd) {
                            const peType = document.getElementById('purchaseEntryType');
                            if (peType) peType.value = 'stock';
                            togglePurchaseInputs();
                            const psSel = document.getElementById('purchaseStockSelect');
                            if (psSel) psSel.value = matchedProd.id;
                            fillPurchaseStockDetails();
                        } else {
                            const peType = document.getElementById('purchaseEntryType');
                            if (peType) peType.value = 'manual';
                            togglePurchaseInputs();
                            alert('Barcode not found in cleaning stock.');
                        }
                    } else if (scannerTargetMode === 'cosmetics-purchase') {
                        const matchedProd = state.cosProducts.find(p => p.barcode === scannedCode || String(p.name || '').toLowerCase() === scannedCode.toLowerCase());
                        const cpBar = document.getElementById('cosPBarcode');
                        if (cpBar) cpBar.value = scannedCode;
                        if (matchedProd) {
                            const cpeType = document.getElementById('cosPurchaseEntryType');
                            if (cpeType) cpeType.value = 'stock';
                            toggleCosPurchaseInputs();
                            const cpsSel = document.getElementById('cosPurchaseStockSelect');
                            if (cpsSel) cpsSel.value = matchedProd.id;
                            fillCosPurchaseStockDetails();
                        } else {
                            const cpeType = document.getElementById('cosPurchaseEntryType');
                            if (cpeType) cpeType.value = 'manual';
                            toggleCosPurchaseInputs();
                            alert('Barcode not found in cosmetics stock.');
                        }
                    } else if (scannerTargetMode === 'cosmetics-sales') {
                        const matchedProd = state.cosProducts.find(p => p.barcode === scannedCode || String(p.name || '').toLowerCase() === scannedCode.toLowerCase());
                        const csBar = document.getElementById('cosSBarcode');
                        if (csBar) csBar.value = scannedCode;
                        if (matchedProd) {
                            const csSel = document.getElementById('cosSalesStockSelect');
                            if (csSel) csSel.value = matchedProd.id;
                            fillCosSalesStockDetails();
                        } else {
                            const csSel = document.getElementById('cosSalesStockSelect');
                            if (csSel) csSel.value = '';
                            alert('Barcode not found in cosmetics stock!');
                        }
                    }
                }
            );
        }
    } catch (err) {
        console.error('Camera access error:', err);
        closeBarcodeScanner();
        alert('Camera access failed. Please allow Camera permission for this app/browser, then try again.');
    }
}

export function closeBarcodeScanner() {
    const modal = document.getElementById('barcodeScannerModal');
    if (modal) modal.classList.add('hidden');
    if (codeReader) {
        try { codeReader.reset(); } catch (e) {}
    }
    const video = document.getElementById('videoScannerElement');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    }
}

// ================= NAVIGATION & TAB MANAGEMENT =================
export function hideUnwantedStockMenus() {
    const activeCustomer = !document.getElementById('sectionCustomers')?.classList.contains('hidden');
    const activeBilling = !document.getElementById('sectionBilling')?.classList.contains('hidden');
    const activeAccounts = !document.getElementById('sectionAccounts')?.classList.contains('hidden');
    const activePurchase = !document.getElementById('sectionPurchase')?.classList.contains('hidden');
    const activeExpenses = !document.getElementById('sectionExpenses')?.classList.contains('hidden');
    const activeCosmetics = !document.getElementById('sectionCosmetics')?.classList.contains('hidden');
    const backupOpen = !document.getElementById('backupModal')?.classList.contains('hidden');
    const shouldHide = activeCustomer || activeBilling || activeAccounts || activePurchase || activeExpenses || activeCosmetics || backupOpen;
    document.querySelectorAll('button, a, [role="button"]').forEach(el => {
        if (el.closest('#sectionStock, #sectionOperations')) return;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const isStockMenu = /(?:^|\s)Stock(?:\s|$)/i.test(text) &&
                            !/View Stock|Add Stock|Return Stock|Low Stock/i.test(text);
        const isPackageMenu = /(?:^|\s)(?:Package|Packaging)(?:\s|$)/i.test(text) &&
                              !/Package Used|Package Qty|Packaging item not found/i.test(text);
        if (isStockMenu || isPackageMenu) {
            const hideThis = isPackageMenu ? true : shouldHide;
            if (hideThis) {
                el.style.setProperty('display', 'none', 'important');
                el.setAttribute('data-unwanted-stock-menu-hidden', '1');
            } else if (el.getAttribute('data-unwanted-stock-menu-hidden') === '1') {
                el.style.removeProperty('display');
                el.removeAttribute('data-unwanted-stock-menu-hidden');
            }
        }
    });
}

export function switchTab(tabName, pushToHistory = true) {
    const isAuthed = state.isLoggedIn || window._isLoggedInFlag || (sessionStorage.getItem('fia_logged_in') === 'true');
    if (!isAuthed) {
        if (typeof logoutApp === 'function') logoutApp();
        return;
    }
    state.isLoggedIn = true;
    window._isLoggedInFlag = true;

    const sections = ['home', 'customers', 'billing', 'operations', 'stock', 'purchase', 'expenses', 'cosmetics', 'accounts'];

    sections.forEach(sec => {
        const secEl = document.getElementById('section' + sec.charAt(0).toUpperCase() + sec.slice(1));
        const tabEl = document.getElementById('tab' + sec.charAt(0).toUpperCase() + sec.slice(1));
        if (secEl) {
            secEl.classList.add('hidden');
            secEl.style.display = 'none';
        }
        if (tabEl) tabEl.className = "px-3 py-2 text-center font-medium text-slate-400 hover:text-slate-200 whitespace-nowrap transition";
    });

    const activeSec = document.getElementById('section' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    let activeTabName = tabName;
    if (['stock', 'purchase', 'expenses'].includes(tabName)) activeTabName = 'operations';
    const activeTab = document.getElementById('tab' + activeTabName.charAt(0).toUpperCase() + activeTabName.slice(1));

    if (activeSec) {
        activeSec.classList.remove('hidden');
        activeSec.style.display = '';
    }
    if (activeTab) activeTab.className = "px-3 py-2 text-center font-bold text-emerald-400 border-b-2 border-emerald-400 whitespace-nowrap transition";

    if (pushToHistory && state.isLoggedIn) {
        history.pushState({ loggedIn: true, tab: tabName }, "", "#" + tabName);
    }
    renderAll();
    hideUnwantedStockMenus();
    if (['billing', 'customers', 'stock', 'operations', 'cosmetics', 'purchase', 'expenses'].includes(tabName)) {
        if (typeof pullFromFirebase === 'function') pullFromFirebase();
    }
}

export function openOperationSection(section) {
    const isAuthed = state.isLoggedIn || window._isLoggedInFlag || (sessionStorage.getItem('fia_logged_in') === 'true');
    if (!isAuthed) {
        if (typeof logoutApp === 'function') logoutApp();
        return;
    }
    state.isLoggedIn = true;
    window._isLoggedInFlag = true;
    switchTab(section);
    const tab = document.getElementById('tabOperations');
    if (tab) tab.className = "px-3 py-2 text-center font-bold text-emerald-400 border-b-2 border-emerald-400 whitespace-nowrap transition";
    if (typeof pullFromFirebase === 'function') pullFromFirebase();
    if (section === 'stock') setTimeout(() => switchStockSubTab('cleaning'), 0);
    if (section === 'purchase') setTimeout(() => switchPurchaseSubTab('cleaning'), 0);
}

export function openBillingSection(type) {
    const isAuthed = state.isLoggedIn || window._isLoggedInFlag || (sessionStorage.getItem('fia_logged_in') === 'true');
    if (!isAuthed) {
        if (typeof logoutApp === 'function') logoutApp();
        return;
    }
    state.isLoggedIn = true;
    window._isLoggedInFlag = true;
    const secBilling = document.getElementById('sectionBilling');
    if (secBilling && (secBilling.classList.contains('hidden') || secBilling.style.display === 'none')) {
        switchTab('billing');
    } else {
        const billingTab = document.getElementById('tabBilling');
        if (billingTab) billingTab.className = "px-3 py-2 text-center font-bold text-emerald-400 border-b-2 border-emerald-400 whitespace-nowrap transition";
    }
    const std = document.getElementById('billingStandardContent');
    const hist = document.getElementById('billingSalesHistoryPanel');
    const btnNew = document.getElementById('btnBillingNew');
    const btnHist = document.getElementById('btnBillingHistory');

    if (type === 'history') {
        if (std) std.classList.add('hidden');
        if (hist) hist.classList.remove('hidden');
        if (btnNew) {
            btnNew.className = 'py-3 rounded-xl bg-slate-800 text-amber-300 border border-amber-800/50 text-xs font-bold flex items-center justify-center gap-1.5 transition';
        }
        if (btnHist) {
            btnHist.className = 'py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition';
        }
        window.__fiaSalesHistoryFilter = window.__fiaSalesHistoryFilter || 'all';
        if (typeof window.setSalesHistoryFilter === 'function') {
            window.setSalesHistoryFilter(window.__fiaSalesHistoryFilter);
        } else {
            renderSalesHistory();
        }
        if (typeof pullFromFirebase === 'function') {
            pullFromFirebase().then(() => {
                if (typeof window.setSalesHistoryFilter === 'function') {
                    window.setSalesHistoryFilter(window.__fiaSalesHistoryFilter || 'all');
                } else {
                    renderSalesHistory();
                }
            });
        }
        return;
    }

    if (hist) hist.classList.add('hidden');
    if (std) std.classList.remove('hidden');
    if (btnNew) {
        btnNew.className = 'py-3 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition';
    }
    if (btnHist) {
        btnHist.className = 'py-3 rounded-xl bg-slate-800 text-emerald-300 border border-emerald-800/50 text-xs font-bold flex items-center justify-center gap-1.5 transition';
    }

    const idxEl = document.getElementById('custIndex');
    const billNoEl = document.getElementById('billNumberDisplay');
    if (idxEl && billNoEl && String(idxEl.value) === '-1') {
        billNoEl.textContent = getNextBillNumber();
    }
    updateProductDropdown();
    updateCustomerDropdown();
    const curSaleType = document.querySelector('input[name="saleType"]:checked')?.value || 'Retail';
    updateBillTypeBadge(curSaleType);
}

export function openCosmeticsSalesEntry() {
    const isAuthed = state.isLoggedIn || window._isLoggedInFlag || (sessionStorage.getItem('fia_logged_in') === 'true');
    if (!isAuthed) {
        if (typeof logoutApp === 'function') logoutApp();
        return;
    }
    state.isLoggedIn = true;
    window._isLoggedInFlag = true;
    try { switchTab('cosmetics'); } catch (e) {}
    setTimeout(function() {
        const titleEl = document.getElementById('cosSalesFormTitle');
        if (titleEl) titleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const nameInput = document.getElementById('cosSName');
        if (nameInput) nameInput.focus();
    }, 120);
}

// ================= MASTER RENDER ALL =================
export function renderAll() {
    const safeRun = (fn) => {
        try {
            if (typeof fn === 'function') fn();
        } catch (e) {
            console.warn(fn?.name || 'safeRun error:', e);
        }
    };
    safeRun(updateDashboard);
    safeRun(renderProducts);
    safeRun(updateProductDropdown);
    safeRun(updateCleaningAddStockDropdown);
    safeRun(updateCosProductDropdowns);
    safeRun(renderCosProductStock);
    safeRun(renderCustomers);
    safeRun(updateCustomerDropdown);
    safeRun(updateCosCustomerDropdown);
    safeRun(updateCombinedProductSelect);
    safeRun(updateCombinedCustomerSelect);
    safeRun(renderPackages);
    safeRun(updatePackageSelectors);
    safeRun(renderPurchases);
    safeRun(renderExpenses);
    safeRun(renderCosPurchases);
    safeRun(renderCosSales);
    safeRun(renderCosmeticsSummary);
    safeRun(renderAccounts);
    safeRun(renderSalesHistory);
    safeRun(renderPurchaseConsolidationView);
    safeRun(renderPurchaseConsolidationReport);
}

// ================= BROWSER POPSTATE & HISTORY =================
if (typeof window !== 'undefined') {
    window.onpopstate = function(event) {
        const isAuthed = state.isLoggedIn || window._isLoggedInFlag || (sessionStorage.getItem('fia_logged_in') === 'true');
        if (!isAuthed) {
            if (typeof logoutApp === 'function') logoutApp();
            return;
        }
        state.isLoggedIn = true;
        window._isLoggedInFlag = true;

        const previewModal = document.getElementById('billPreviewModal');
        if (previewModal && !previewModal.classList.contains('hidden')) {
            previewModal.classList.add('hidden');
            return;
        }

        const modals = ['barcodeScannerModal', 'settingsModal', 'changePinModal', 'resetPinModal', 'dueAmountListModal', 'lowStockListModal', 'recordViewModal', 'customerConsolidatedDetailModal', 'supplierConsolidatedDetailModal'];
        let modalClosed = false;
        modals.forEach(mId => {
            const mEl = document.getElementById(mId);
            if (mEl && !mEl.classList.contains('hidden')) {
                mEl.classList.add('hidden');
                modalClosed = true;
            }
        });
        if (modalClosed) {
            if (event.state && event.state.tab) switchTab(event.state.tab, false);
            else switchTab('home', false);
            return;
        }

        if (event.state && event.state.tab) {
            switchTab(event.state.tab, false);
        } else {
            switchTab('home', false);
        }
    };

    // ================= GLOBAL WINDOW BINDINGS (ATTACHED FIRST) =================
    // Guarantees all inline HTML onclick handlers (switchTab, modals, etc.) are available immediately
    window.showRecordView = showRecordView;
    window.closeRecordView = closeRecordView;
    window.openBarcodeScanner = openBarcodeScanner;
    window.openBarcodeScannerForBilling = openBarcodeScannerForBilling;
    window.openBarcodeScannerForCosmeticStock = openBarcodeScannerForCosmeticStock;
    window.openBarcodeScannerForCosmeticsSales = openBarcodeScannerForCosmeticsSales;
    window.openBarcodeScannerForCleaningPurchase = openBarcodeScannerForCleaningPurchase;
    window.openBarcodeScannerForCosmeticsPurchase = openBarcodeScannerForCosmeticsPurchase;
    window.closeBarcodeScanner = closeBarcodeScanner;
    window.hideUnwantedStockMenus = hideUnwantedStockMenus;
    window.switchTab = switchTab;
    window.openOperationSection = openOperationSection;
    window.openBillingSection = openBillingSection;
    window.openCosmeticsSalesEntry = openCosmeticsSalesEntry;
    window.renderAll = renderAll;
    window.purchaseActionCleaning = 'add';
    window.purchaseActionCosmetics = 'add';
    window.switchStockTopTab = switchStockTopTab;
    window.switchStockSubTab = switchStockSubTab;
    window.switchStockActionTab = switchStockActionTab;
    window.switchPurchaseSubTab = switchPurchaseSubTab;
    window.switchPurchaseActionTab = switchPurchaseActionTab;
    window.switchCustomerSubTab = switchCustomerSubTab;
    window.switchCustomerConsolidationView = switchCustomerConsolidationView;
    window.renderCustomerConsolidationReport = renderCustomerConsolidationReport;
    window.renderCustomerConsolidationView = renderCustomerConsolidationView;
    window.renderConsolidatedStockReport = renderConsolidatedStockReport;
    window.updatePurchaseReturnLiveCalc = updatePurchaseReturnLiveCalc;
    window.openPurchaseReturn = openPurchaseReturn;
    window.deletePurchaseReturn = deletePurchaseReturn;
    window.getConsolidatedPurchaseData = getConsolidatedPurchaseData;
    window.switchPurchaseConsolidationView = switchPurchaseConsolidationView;
    window.renderPurchaseConsolidationView = renderPurchaseConsolidationView;
    window.renderPurchaseConsolidationReport = renderPurchaseConsolidationReport;
    window.openSupplierConsolidatedDetail = openSupplierConsolidatedDetail;
    window.closeSupplierConsolidatedDetail = closeSupplierConsolidatedDetail;
    window.shareSelectedSupplierConsolidatedDetail = shareSelectedSupplierConsolidatedDetail;
    window.sharePurchaseConsolidationReport = sharePurchaseConsolidationReport;
    window.downloadPurchaseConsolidationReportPDF = downloadPurchaseConsolidationReportPDF;
    window.shareBillSmartWhatsApp = shareBillSmartWhatsApp;
    window.shareBillPdfWhatsApp = shareBillPdfWhatsApp;
    window.generateBillPdfBlob = generateBillPdfBlob;

    // ================= INITIALIZATION & MOUNTING =================
    let isAppBootstrapped = false;
    function bootstrapApp() {
        if (isAppBootstrapped) return;
        isAppBootstrapped = true;

        try {
            loadFromLocalStorage();
        } catch (e) {
            console.error('loadFromLocalStorage error:', e);
        }

        // Check if user already logged in via instant synchronous authentication or active session
        try {
            const hasSession = sessionStorage.getItem('fia_logged_in') === 'true';
            if (hasSession || window._isLoggedInFlag || (window.state && window.state.isLoggedIn)) {
                state.isLoggedIn = true;
                window._isLoggedInFlag = true;
                if (typeof window._dismissLoginOverlay === 'function') {
                    window._dismissLoginOverlay();
                } else {
                    const overlay = document.getElementById('loginOverlay');
                    if (overlay) {
                        overlay.classList.add('hidden');
                        overlay.setAttribute('hidden', 'true');
                        overlay.style.setProperty('display', 'none', 'important');
                    }
                    const mainApp = document.getElementById('mainAppContainer');
                    if (mainApp) {
                        mainApp.classList.remove('hidden');
                        mainApp.removeAttribute('hidden');
                        mainApp.style.removeProperty('display');
                        mainApp.style.setProperty('display', 'block', 'important');
                    }
                }
            } else {
                state.isLoggedIn = false;
                window._isLoggedInFlag = false;
                if (typeof window._showLoginOverlay === 'function') {
                    window._showLoginOverlay();
                }
            }
        } catch (e) {
            console.error('Auth overlay sync error:', e);
        }

        try { setupDateFields(); } catch (e) {}
        try {
            if (window.history && window.history.replaceState) {
                history.replaceState({ loggedIn: state.isLoggedIn, tab: 'home' }, "", window.location.href);
            }
        } catch (e) {}

        try {
            const expDateEl = document.getElementById('expDate');
            if (expDateEl && (!expDateEl.value || typeof expDateEl.value === 'function' || String(expDateEl.value).includes('function'))) expDateEl.value = getTodayDateString();
        } catch (e) {}

        setTimeout(() => {
            try {
                if (typeof switchStockTopTab === 'function') switchStockTopTab('product');
                if (typeof switchStockSubTab === 'function') switchStockSubTab('cleaning');
                if (typeof switchPurchaseSubTab === 'function') switchPurchaseSubTab('cleaning');
                updateCleaningPurchaseDropdown();
                updateCosProductDropdowns();
                updateStockReturnDropdowns();
                renderStockReturnHistory();
                updateBillTypeBadge(document.querySelector('input[name="saleType"]:checked')?.value || 'Retail');
            } catch (e) {
                console.warn('Subtab init error:', e);
            }
        }, 0);

        try { renderAll(); } catch (e) { console.error('renderAll error:', e); }
        try { startRealtimeSync(); } catch (e) { console.error('startRealtimeSync error:', e); }
        try { pullFromFirebase(); } catch (e) { console.error('pullFromFirebase error:', e); }
        try { startAutomaticBackup(); } catch (e) { console.error('startAutomaticBackup error:', e); }
    }

    window.bootstrapApp = bootstrapApp;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapApp);
    } else {
        bootstrapApp();
    }

    setInterval(hideUnwantedStockMenus, 500);

    if (typeof document !== 'undefined') {
        document.addEventListener('input', function(e) {
            const el = e.target;
            if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
            if (el.type === 'password' || el.type === 'number' || el.type === 'tel' || el.type === 'email' || el.type === 'date' || el.type === 'search') return;
            const pos = el.selectionStart;
            const upper = el.value.toUpperCase();
            if (el.value !== upper) { el.value = upper; try { el.setSelectionRange(pos, pos); } catch(err) {} }
        });

        // Auto-refresh when switching back to the app or turning phone screen back on
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible') {
                if (window.FB_DB) {
                    try { window.FB_DB.goOnline(); } catch(e) {}
                    if (typeof pullFromFirebase === 'function') pullFromFirebase();
                }
            }
        });
        window.addEventListener('focus', function() {
            if (window.FB_DB && typeof pullFromFirebase === 'function') {
                pullFromFirebase();
            }
        });
    }

    // PWA Install Prompt Handling
    let deferredPwaPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPwaPrompt = e;
        const btn = document.getElementById('pwaInstallBtn');
        if (btn) btn.classList.remove('hidden');
    });

    window.triggerPwaInstall = function() {
        if (deferredPwaPrompt) {
            deferredPwaPrompt.prompt();
            deferredPwaPrompt.userChoice.then(function(choiceResult) {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User installed the FIA CLEAN PWA');
                    const btn = document.getElementById('pwaInstallBtn');
                    if (btn) btn.classList.add('hidden');
                }
                deferredPwaPrompt = null;
            });
        } else {
            alert("FIA CLEAN & CARE ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യാൻ:\n\n1. Android (Chrome): മുകളിൽ വലതുഭാഗത്തെ 3 കുത്തുകളിൽ (⋮) ക്ലിക്ക് ചെയ്ത് 'Install app' അല്ലെങ്കിൽ 'Add to Home screen' കൊടുക്കുക.\n2. iPhone (Safari): താഴെയുള്ള Share ചിഹ്നം (⬆️) ക്ലിക്ക് ചെയ്ത് 'Add to Home Screen' കൊടുക്കുക.\n\nഇപ്പോൾ ഒഫീഷ്യൽ ഫിയ ലോഗോയോടെ നിങ്ങളുടെ മൊബൈൽ ഹോം സ്ക്രീനിൽ ആപ്പ് ഐക്കൺ വരുന്നതാണ്!");
        }
    };

    window.addEventListener('appinstalled', function() {
        console.log('FIA CLEAN PWA installed successfully');
        const btn = document.getElementById('pwaInstallBtn');
        if (btn) btn.classList.add('hidden');
    });
}


