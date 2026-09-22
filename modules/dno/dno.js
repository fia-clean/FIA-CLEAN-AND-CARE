/**
 * FIA CLEAN & CARE - Demands & Orders (D & O) Module
 * Handles inventory shortages, packaging/material demand tracking,
 * bulk customer order bookings, overdue delivery reminders, and voice alerts.
 */

import {
    state,
    getTodayDateString,
    formatDateDDMMYYYY,
    formatCurrency,
    isItemDeleted,
    markIdDeleted,
    toTitleCase
} from '../core/state.js';
import { syncToFirebase } from '../core/db.js';

let currentDnoSubTab = 'demands'; // 'demands' | 'orders'
let currentDemandFilter = 'all'; // 'all' | 'needed' | 'urgent' | 'received'
let currentOrderFilter = 'all'; // 'all' | 'overdue' | 'pending' | 'processing' | 'delivered'
let tempOrderItems = [];
let editingOrderItemIndex = -1;
let audioMuted = localStorage.getItem('fia_audio_muted') === 'true';

// -------------------------------------------------------------
// Audio & Voice Notification Engine (Web Audio API & Speech Synthesis)
// -------------------------------------------------------------
export function playAlertChime() {
    if (audioMuted) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // Gentle, high-fidelity 2-tone reminder chime (880Hz -> 1174Hz)
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now); // Note A5
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1174.66, now + 0.18); // Note D6
        gain2.gain.setValueAtTime(0.25, now + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.7);
    } catch (e) {
        console.warn('Audio chime error:', e);
    }
}

export function speakText(text) {
    if (audioMuted) return;
    try {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // cancel pending speech
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 1.0;
            utter.pitch = 1.05;
            utter.volume = 1.0;
            window.speechSynthesis.speak(utter);
        }
    } catch (e) {
        console.warn('Speech synthesis error:', e);
    }
}

export function toggleAudioMute() {
    audioMuted = !audioMuted;
    localStorage.setItem('fia_audio_muted', audioMuted ? 'true' : 'false');
    updateAudioToggleButton();
    if (!audioMuted) {
        playAlertChime();
        speakText("Voice alerts enabled");
    }
}

export function updateAudioToggleButton() {
    const btn = document.getElementById('btnToggleDnoAudio');
    if (btn) {
        btn.innerHTML = audioMuted ? '🔇 Sound Off' : '🔊 Sound On';
        btn.className = audioMuted 
            ? 'px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-500 text-xs font-bold hover:bg-slate-200 transition'
            : 'px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition shadow-xs';
    }
}

// -------------------------------------------------------------
// Sub-tab Navigation
// -------------------------------------------------------------
export function switchDnoSubTab(tab) {
    currentDnoSubTab = tab;
    const tabDemands = document.getElementById('subTabDemands');
    const tabOrders = document.getElementById('subTabOrders');
    const contentDemands = document.getElementById('dnoDemandsContent');
    const contentOrders = document.getElementById('dnoOrdersContent');

    if (tabDemands && tabOrders) {
        if (tab === 'demands') {
            tabDemands.className = 'flex-1 py-2.5 px-4 text-center font-bold text-xs sm:text-sm rounded-xl bg-emerald-600 text-white shadow-sm transition';
            tabOrders.className = 'flex-1 py-2.5 px-4 text-center font-bold text-xs sm:text-sm rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition';
            if (contentDemands) contentDemands.classList.remove('hidden');
            if (contentOrders) contentOrders.classList.add('hidden');
            renderDemands();
        } else {
            tabOrders.className = 'flex-1 py-2.5 px-4 text-center font-bold text-xs sm:text-sm rounded-xl bg-emerald-600 text-white shadow-sm transition';
            tabDemands.className = 'flex-1 py-2.5 px-4 text-center font-bold text-xs sm:text-sm rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition';
            if (contentOrders) contentOrders.classList.remove('hidden');
            if (contentDemands) contentDemands.classList.add('hidden');
            renderOrders();
            checkOverdueOrderAlerts(true);
        }
    }
}

// -------------------------------------------------------------
// DEMANDS SUB-MODULE
// -------------------------------------------------------------

export function getLowStockProducts() {
    const cleaning = (state.products || []).filter(p => !isItemDeleted(p) && Number(p.stock || 0) <= 5);
    const cosmetics = (state.cosProducts || []).filter(p => !isItemDeleted(p) && Number(p.stock || 0) <= 5);
    return [
        ...cleaning.map(p => ({ ...p, _type: 'cleaning' })),
        ...cosmetics.map(p => ({ ...p, _type: 'cosmetics' }))
    ];
}

export function renderDemands() {
    const container = document.getElementById('demandsListContainer');
    if (!container) return;

    const lowStockItems = getLowStockProducts();
    const manualDemands = (state.demands || []).filter(d => !isItemDeleted(d));

    // Calculate Summary Stats
    const totalUrgent = manualDemands.filter(d => d.isUrgent && d.status !== 'received').length + lowStockItems.length;
    const totalPendingDemands = manualDemands.filter(d => d.status !== 'received').length + lowStockItems.length;
    
    const statsEl = document.getElementById('demandsSummaryStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-center">
                <div class="p-3 bg-rose-50 border border-rose-200 rounded-2xl">
                    <span class="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">⚠️ Urgent Shortages</span>
                    <span class="text-xl font-black text-rose-800">${totalUrgent}</span>
                </div>
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                    <span class="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">📦 Low Stock Items</span>
                    <span class="text-xl font-black text-amber-800">${lowStockItems.length}</span>
                </div>
                <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl col-span-2 sm:col-span-1">
                    <span class="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">📋 Total Active Demands</span>
                    <span class="text-xl font-black text-emerald-800">${totalPendingDemands}</span>
                </div>
            </div>
        `;
    }

    // Filter manual demands
    let filteredManual = manualDemands;
    if (currentDemandFilter === 'needed') {
        filteredManual = manualDemands.filter(d => d.status === 'needed');
    } else if (currentDemandFilter === 'urgent') {
        filteredManual = manualDemands.filter(d => d.isUrgent && d.status !== 'received');
    } else if (currentDemandFilter === 'received') {
        filteredManual = manualDemands.filter(d => d.status === 'received');
    }

    let html = '';

    // 1. Automatic Low Stock Section (Shown when 'all', 'needed', or 'urgent' is active)
    if (currentDemandFilter !== 'received' && lowStockItems.length > 0) {
        html += `
            <div class="space-y-2 mb-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5 text-xs font-black text-amber-800 uppercase tracking-wide">
                        <span>⚠️ Automated Low Stock Shortages</span>
                        <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">${lowStockItems.length}</span>
                    </div>
                    <span class="text-[10px] text-slate-500">Auto-detected from Inventory</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    ${lowStockItems.map(p => `
                        <div class="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="font-extrabold text-sm text-slate-900 truncate">${p.name}</span>
                                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${p._type === 'cleaning' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'}">${p._type}</span>
                                </div>
                                <div class="text-xs text-slate-600 mt-0.5">
                                    Current Stock: <strong class="text-rose-600 font-bold">${p.stock} ${p.unit || 'Units'}</strong>
                                    ${Number(p.stock) === 0 ? '<span class="ml-1 text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-bold">OUT OF STOCK</span>' : ''}
                                </div>
                            </div>
                            <button type="button" onclick="window.quickAddLowStockToDemand('${p.id}', '${p.name.replace(/'/g, "\\'")}', '${p.unit || 'Units'}', ${p.stock})" class="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition">
                                + Add Qty
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 2. Manual Shortages / Demand Items Section
    html += `
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-black text-slate-800 uppercase tracking-wide">
                    📝 Shortages & Procurement Requirements (${filteredManual.length})
                </span>
                <span class="text-[10px] text-slate-500">Packaging, Raw Chemical, Bottles, Finished Goods</span>
            </div>
    `;

    if (filteredManual.length === 0) {
        html += `
            <div class="text-center py-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 space-y-2">
                <span class="text-3xl block">📋</span>
                <p class="text-xs font-bold">No demand entries found for this filter.</p>
                <p class="text-[11px] text-slate-400">Click "+ Quick Add Demand" above to note down any shortage on the go!</p>
            </div>
        `;
    } else {
        html += `<div class="grid grid-cols-1 gap-2.5">`;
        filteredManual.forEach(item => {
            const isReceived = item.status === 'received';
            const categoryBadge = getCategoryBadge(item.category);

            html += `
                <div class="p-3.5 bg-white border ${item.isUrgent && !isReceived ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'} rounded-2xl shadow-xs hover:border-slate-300 transition flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-extrabold text-sm text-slate-900 ${isReceived ? 'line-through text-slate-400' : ''}">${item.itemName}</span>
                            ${categoryBadge}
                            ${item.isUrgent && !isReceived ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">🔴 URGENT</span>' : ''}
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(item.status)}">${item.status ? item.status.toUpperCase() : 'NEEDED'}</span>
                        </div>
                        <div class="flex items-center gap-3 text-xs text-slate-600 mt-1 flex-wrap">
                            <span>Qty Needed: <strong class="text-emerald-700 font-extrabold text-sm">${item.qtyNeeded} ${item.unit}</strong></span>
                            ${item.notes ? `<span class="text-slate-500 italic">"${item.notes}"</span>` : ''}
                            <span class="text-[10px] text-slate-400">• ${item.createdAt ? formatDateDDMMYYYY(new Date(item.createdAt).toISOString().slice(0, 10)) : ''}</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${!isReceived ? `
                            <button type="button" onclick="window.setDemandStatus('${item.id}', 'ordered')" title="Mark Ordered" class="px-2.5 py-1.5 rounded-xl border ${item.status === 'ordered' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'} font-bold text-xs transition">
                                Ordered
                            </button>
                            <button type="button" onclick="window.setDemandStatus('${item.id}', 'received')" title="Mark Received / Fulfilled" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs">
                                ✓ Received
                            </button>
                        ` : `
                            <button type="button" onclick="window.setDemandStatus('${item.id}', 'needed')" title="Re-open Demand" class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition">
                                ↺ Reopen
                            </button>
                        `}
                        <button type="button" onclick="window.editDemandItem('${item.id}')" title="Edit Demand" class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
                            ✏️
                        </button>
                        <button type="button" onclick="window.deleteDemandItem('${item.id}')" title="Delete Demand" class="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
    updateDnoBadge();
}

function getCategoryBadge(cat) {
    switch (cat) {
        case 'packaging':
            return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">📦 Packaging / Bottles / Caps</span>';
        case 'raw_material':
            return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">🧪 Raw Material / Chemical</span>';
        case 'finished_goods':
            return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">🧴 Finished Product</span>';
        default:
            return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">📌 General</span>';
    }
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'ordered':
            return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
        case 'received':
            return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
        default:
            return 'bg-amber-100 text-amber-700 border border-amber-200';
    }
}

export function filterDemands(filter) {
    currentDemandFilter = filter;
    ['all', 'needed', 'urgent', 'received'].forEach(f => {
        const btn = document.getElementById('filterDemand_' + f);
        if (btn) {
            btn.className = f === filter
                ? 'px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-xs transition'
                : 'px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs transition';
        }
    });
    renderDemands();
}

export function openAddDemandModal(prefill = {}) {
    const modal = document.getElementById('addDemandModal');
    if (!modal) return;
    
    document.getElementById('demandItemId').value = prefill.id || '';
    document.getElementById('demandItemName').value = prefill.itemName || '';
    document.getElementById('demandItemCategory').value = prefill.category || 'packaging';
    document.getElementById('demandItemQty').value = prefill.qtyNeeded || '';
    document.getElementById('demandItemUnit').value = prefill.unit || 'Pcs';
    document.getElementById('demandItemUrgent').checked = !!prefill.isUrgent;
    document.getElementById('demandItemNotes').value = prefill.notes || '';
    
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('demandItemName')?.focus(), 50);
}

export function closeAddDemandModal() {
    const modal = document.getElementById('addDemandModal');
    if (modal) modal.classList.add('hidden');
}

export function saveDemandItem() {
    const id = document.getElementById('demandItemId').value;
    const itemName = (document.getElementById('demandItemName').value || '').trim();
    const category = document.getElementById('demandItemCategory').value;
    const qtyNeeded = parseFloat(document.getElementById('demandItemQty').value) || 1;
    const unit = (document.getElementById('demandItemUnit').value || 'Pcs').trim();
    const isUrgent = document.getElementById('demandItemUrgent').checked;
    const notes = (document.getElementById('demandItemNotes').value || '').trim();

    if (!itemName) {
        alert("Please enter the Item Name (e.g. 500ml Bottle, Caps, Dishwash concentrate)");
        return;
    }

    if (!Array.isArray(state.demands)) state.demands = [];

    if (id) {
        // Edit existing
        const idx = state.demands.findIndex(d => d.id === id);
        if (idx !== -1) {
            state.demands[idx] = {
                ...state.demands[idx],
                itemName,
                category,
                qtyNeeded,
                unit,
                isUrgent,
                notes,
                updatedAt: Date.now()
            };
        }
    } else {
        // New item
        const newDemand = {
            id: 'dem_' + Date.now(),
            itemName,
            category,
            qtyNeeded,
            unit,
            isUrgent,
            status: 'needed',
            notes,
            createdAt: Date.now(),
            savedAt: Date.now()
        };
        state.demands.unshift(newDemand);
    }

    closeAddDemandModal();
    renderDemands();
    syncToFirebase();
}

export function quickAddLowStockToDemand(prodId, prodName, unit, currentStock) {
    openAddDemandModal({
        itemName: prodName,
        category: 'finished_goods',
        qtyNeeded: 10,
        unit: unit || 'Units',
        isUrgent: true,
        notes: `Low Stock replenishment (Current: ${currentStock})`
    });
}

export function setDemandStatus(id, newStatus) {
    if (!Array.isArray(state.demands)) return;
    const item = state.demands.find(d => d.id === id);
    if (item) {
        item.status = newStatus;
        item.updatedAt = Date.now();
        renderDemands();
        syncToFirebase();
    }
}

export function editDemandItem(id) {
    const item = (state.demands || []).find(d => d.id === id);
    if (item) {
        openAddDemandModal(item);
    }
}

export function deleteDemandItem(id) {
    if (confirm("Are you sure you want to delete this demand requirement?")) {
        markIdDeleted(id);
        state.demands = (state.demands || []).filter(d => d.id !== id);
        renderDemands();
        syncToFirebase();
    }
}

export function shareDemandsWhatsApp() {
    const lowStockItems = getLowStockProducts();
    const activeDemands = (state.demands || []).filter(d => !isItemDeleted(d) && d.status !== 'received');

    if (lowStockItems.length === 0 && activeDemands.length === 0) {
        alert("No active shortage or demand items to share!");
        return;
    }

    let text = `*📋 FIA CLEAN & CARE - REQUIREMENT & DEMAND LIST*\n`;
    text += `*Date:* ${formatDateDDMMYYYY(getTodayDateString())}\n`;
    text += `------------------------------------\n`;

    const urgentDemands = activeDemands.filter(d => d.isUrgent);
    if (urgentDemands.length > 0 || lowStockItems.length > 0) {
        text += `\n*🔴 URGENT REQUIREMENTS:*\n`;
        urgentDemands.forEach((d, i) => {
            text += `${i + 1}. *${d.itemName}* - ${d.qtyNeeded} ${d.unit} ${d.notes ? `(${d.notes})` : ''}\n`;
        });
        lowStockItems.forEach((p, i) => {
            text += `• ${p.name} (Low stock: ${p.stock} ${p.unit || 'Units'})\n`;
        });
    }

    const regularDemands = activeDemands.filter(d => !d.isUrgent);
    if (regularDemands.length > 0) {
        text += `\n*📦 OTHER REQUIREMENTS:*\n`;
        regularDemands.forEach((d, i) => {
            text += `${i + 1}. ${d.itemName} - ${d.qtyNeeded} ${d.unit} ${d.notes ? `(${d.notes})` : ''}\n`;
        });
    }

    text += `\n------------------------------------\n`;
    text += `_Generated via FIA Clean & Care Management App_`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// -------------------------------------------------------------
// ORDERS SUB-MODULE (Bulk Bookings & Due Date Reminders)
// -------------------------------------------------------------

export function renderOrders() {
    const container = document.getElementById('ordersListContainer');
    if (!container) return;

    const orders = (state.orders || []).filter(o => !isItemDeleted(o));
    const today = getTodayDateString();

    // Stats
    const overdueCount = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.dueDate < today).length;
    const dueTodayCount = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.dueDate === today).length;
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const deliveredCount = orders.filter(o => o.status === 'delivered').length;

    const statsEl = document.getElementById('ordersSummaryStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
                <div class="p-3 bg-rose-50 border border-rose-200 rounded-2xl ${overdueCount > 0 ? 'ring-2 ring-rose-400 animate-pulse' : ''}">
                    <span class="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">⚠️ Overdue Orders</span>
                    <span class="text-xl font-black text-rose-800">${overdueCount}</span>
                </div>
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                    <span class="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">🔔 Due Today</span>
                    <span class="text-xl font-black text-amber-800">${dueTodayCount}</span>
                </div>
                <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                    <span class="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">⏳ Pending / Packing</span>
                    <span class="text-xl font-black text-indigo-800">${pendingCount}</span>
                </div>
                <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <span class="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">✓ Delivered</span>
                    <span class="text-xl font-black text-emerald-800">${deliveredCount}</span>
                </div>
            </div>
        `;
    }

    // Filter
    let filteredOrders = orders;
    if (currentOrderFilter === 'overdue') {
        filteredOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && (o.dueDate <= today));
    } else if (currentOrderFilter === 'pending') {
        filteredOrders = orders.filter(o => o.status === 'pending');
    } else if (currentOrderFilter === 'processing') {
        filteredOrders = orders.filter(o => o.status === 'processing');
    } else if (currentOrderFilter === 'delivered') {
        filteredOrders = orders.filter(o => o.status === 'delivered');
    }

    // Sort by dueDate ascending (earliest due first)
    filteredOrders.sort((a, b) => {
        if (a.status === 'delivered' && b.status !== 'delivered') return 1;
        if (a.status !== 'delivered' && b.status === 'delivered') return -1;
        return (a.dueDate || '').localeCompare(b.dueDate || '');
    });

    if (filteredOrders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 space-y-2">
                <span class="text-3xl block">📦</span>
                <p class="text-xs font-bold">No orders found matching this filter.</p>
                <p class="text-[11px] text-slate-400">Click "+ New Order Booking" to register customer bulk orders.</p>
            </div>
        `;
        updateDnoBadge();
        return;
    }

    let html = `<div class="grid grid-cols-1 gap-3">`;

    filteredOrders.forEach(order => {
        const isDelivered = order.status === 'delivered';
        const isCancelled = order.status === 'cancelled';
        const isOverdue = !isDelivered && !isCancelled && order.dueDate < today;
        const isDueToday = !isDelivered && !isCancelled && order.dueDate === today;

        let borderClass = 'border-slate-200 bg-white';
        let alertBadge = '';

        if (isOverdue) {
            borderClass = 'border-rose-400 bg-rose-50/30 ring-1 ring-rose-400';
            alertBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">⚠️ OVERDUE</span>';
        } else if (isDueToday) {
            borderClass = 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-400';
            alertBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">🔔 DUE TODAY</span>';
        }

        const itemsSummary = (order.items || []).map(i => `${i.productName} (${i.qty} ${i.unit || 'Pcs'})`).join(', ');

        html += `
            <div class="p-4 rounded-2xl border ${borderClass} shadow-xs space-y-3 transition">
                <div class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">${order.orderNo || 'ORD'}</span>
                            <h3 class="text-sm sm:text-base font-black text-slate-900">${order.customerName}</h3>
                            ${alertBadge}
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getOrderStatusClass(order.status)}">${(order.status || 'PENDING').toUpperCase()}</span>
                        </div>
                        <div class="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                            ${order.phone ? `<span>📞 ${order.phone}</span>` : ''}
                            ${order.address ? `<span>📍 ${order.address}</span>` : ''}
                            <span>📅 Booked: ${formatDateDDMMYYYY(order.orderDate || '')}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-[11px] font-bold text-slate-500 block">Expected Delivery Due:</span>
                        <span class="text-xs sm:text-sm font-black ${isOverdue ? 'text-rose-600' : isDueToday ? 'text-amber-600' : 'text-slate-900'}">
                            ${formatDateDDMMYYYY(order.dueDate || '')} ${order.dueTime ? `at ${order.dueTime}` : ''}
                        </span>
                    </div>
                </div>

                <!-- Items list -->
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                    <div class="font-bold text-slate-700 flex items-center justify-between">
                        <span>Items Ordered (${(order.items || []).length}):</span>
                        <span class="text-emerald-700 font-extrabold text-sm">Total: ₹${Number(order.totalAmount || 0).toFixed(2)}</span>
                    </div>
                    <div class="text-slate-600 space-y-1">
                        ${(order.items || []).map(item => `
                            <div class="flex items-center justify-between text-[11px] border-b border-slate-200/40 pb-0.5">
                                <span>• <strong>${item.productName}</strong> × ${item.qty} ${item.unit || 'Pcs'}</span>
                                <span class="font-mono text-slate-700">₹${Number(item.total || 0).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                    ${order.advancePaid ? `
                        <div class="flex justify-between text-[11px] text-slate-500 pt-1 font-semibold">
                            <span>Advance Paid: ₹${Number(order.advancePaid).toFixed(2)}</span>
                            <span class="text-rose-600 font-bold">Balance Due: ₹${Number((order.totalAmount || 0) - order.advancePaid).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${order.notes ? `
                        <div class="text-[11px] text-slate-500 italic pt-1">
                            Note: "${order.notes}"
                        </div>
                    ` : ''}
                </div>

                <!-- Action Toolbar -->
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Status:</span>
                        <button type="button" onclick="window.setOrderStatus('${order.id}', 'pending')" class="px-2.5 py-1 rounded-lg text-xs font-bold ${order.status === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} transition">Pending</button>
                        <button type="button" onclick="window.setOrderStatus('${order.id}', 'processing')" class="px-2.5 py-1 rounded-lg text-xs font-bold ${order.status === 'processing' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} transition">Processing</button>
                        <button type="button" onclick="window.setOrderStatus('${order.id}', 'delivered')" class="px-2.5 py-1 rounded-lg text-xs font-bold ${order.status === 'delivered' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} transition">✓ Delivered</button>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="window.convertOrderToBill('${order.id}')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1">
                            <span>🧾</span> <span>Convert to Bill</span>
                        </button>
                        <button type="button" onclick="window.shareOrderWhatsApp('${order.id}')" title="Share on WhatsApp" class="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition text-sm">
                            📲
                        </button>
                        <button type="button" onclick="window.editOrderBooking('${order.id}')" title="Edit Order" class="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition text-sm">
                            ✏️
                        </button>
                        <button type="button" onclick="window.deleteOrderBooking('${order.id}')" title="Delete Order" class="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition text-sm">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
    updateDnoBadge();
}

function getOrderStatusClass(status) {
    switch (status) {
        case 'delivered':
            return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
        case 'processing':
            return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
        case 'cancelled':
            return 'bg-slate-200 text-slate-700 border border-slate-300';
        default:
            return 'bg-amber-100 text-amber-800 border border-amber-300';
    }
}

export function filterOrders(filter) {
    currentOrderFilter = filter;
    ['all', 'overdue', 'pending', 'processing', 'delivered'].forEach(f => {
        const btn = document.getElementById('filterOrder_' + f);
        if (btn) {
            btn.className = f === filter
                ? 'px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-xs transition'
                : 'px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs transition';
        }
    });
    renderOrders();
}

export function checkOverdueOrderAlerts(manualTrigger = false) {
    const today = getTodayDateString();
    const activeOrders = (state.orders || []).filter(o => !isItemDeleted(o) && o.status !== 'delivered' && o.status !== 'cancelled');
    const overdueOrders = activeOrders.filter(o => o.dueDate < today);
    const dueTodayOrders = activeOrders.filter(o => o.dueDate === today);

    if (overdueOrders.length > 0 || dueTodayOrders.length > 0) {
        playAlertChime();
        if (overdueOrders.length > 0) {
            const first = overdueOrders[0];
            speakText(`Attention! Order for ${first.customerName} is overdue for delivery!`);
        } else if (dueTodayOrders.length > 0) {
            const first = dueTodayOrders[0];
            speakText(`Reminder! Order for ${first.customerName} is due for delivery today.`);
        }
    } else if (manualTrigger) {
        speakText("All order deliveries are up to date.");
    }
}

// -------------------------------------------------------------
// New Order Modal Form Engine
// -------------------------------------------------------------

export function openNewOrderModal(orderData = null) {
    const modal = document.getElementById('newOrderModal');
    if (!modal) return;

    tempOrderItems = [];
    const today = getTodayDateString();

    document.getElementById('orderBookingId').value = orderData ? orderData.id : '';
    document.getElementById('orderBookingNo').value = orderData ? orderData.orderNo : 'ORD-' + (Date.now().toString().slice(-4));
    document.getElementById('orderCustomerName').value = orderData ? orderData.customerName : '';
    document.getElementById('orderCustomerPhone').value = orderData ? (orderData.phone || '') : '';
    document.getElementById('orderCustomerAddress').value = orderData ? (orderData.address || '') : '';
    document.getElementById('orderDueDate').value = orderData ? orderData.dueDate : today;
    document.getElementById('orderDueTime').value = orderData ? (orderData.dueTime || '17:00') : '17:00';
    document.getElementById('orderAdvancePaid').value = orderData ? (orderData.advancePaid || '') : '';
    document.getElementById('orderNotes').value = orderData ? (orderData.notes || '') : '';
    if (document.getElementById('orderItemCustomName')) document.getElementById('orderItemCustomName').value = '';
    if (document.getElementById('orderItemRate')) document.getElementById('orderItemRate').value = '';
    if (document.getElementById('orderItemQty')) document.getElementById('orderItemQty').value = '1';
    const variantWrapper = document.getElementById('orderPackVariantWrapper');
    if (variantWrapper) variantWrapper.classList.add('hidden');
    const variantSelect = document.getElementById('orderPackVariantSelect');
    if (variantSelect) variantSelect.innerHTML = '<option value="">-- Select Pack Size --</option>';

    editingOrderItemIndex = -1;
    const addBtn = document.getElementById('btnAddOrderItem');
    if (addBtn) {
        addBtn.innerHTML = '+ Add Item';
        addBtn.className = 'w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition shadow-xs';
    }

    if (orderData && Array.isArray(orderData.items)) {
        tempOrderItems = JSON.parse(JSON.stringify(orderData.items));
    }

    populateCustomerDatalist();
    populateProductSelect();
    renderTempOrderItems();
    modal.classList.remove('hidden');
}

export function closeNewOrderModal() {
    editingOrderItemIndex = -1;
    const addBtn = document.getElementById('btnAddOrderItem');
    if (addBtn) {
        addBtn.innerHTML = '+ Add Item';
        addBtn.className = 'w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition shadow-xs';
    }
    const modal = document.getElementById('newOrderModal');
    if (modal) modal.classList.add('hidden');
}

export function populateCustomerDatalist() {
    const dl = document.getElementById('orderCustomerDatalist');
    if (!dl) return;
    const names = new Set();
    (state.customers || []).forEach(c => {
        if (c && c.name && !isItemDeleted(c)) names.add(c.name);
    });
    dl.innerHTML = Array.from(names).map(n => `<option value="${n}">`).join('');
}

export function onOrderCustomerSelect() {
    const name = (document.getElementById('orderCustomerName').value || '').trim();
    if (!name) return;
    const existing = (state.customers || []).find(c => c && c.name && c.name.toLowerCase() === name.toLowerCase() && !isItemDeleted(c));
    if (existing && existing.phone) {
        document.getElementById('orderCustomerPhone').value = existing.phone;
    }
}

export function populateProductSelect() {
    const select = document.getElementById('orderItemProductSelect');
    if (!select) return;

    let html = '<option value="">-- Choose Product --</option>';

    // Cleaning Products
    html += '<optgroup label="🧴 Cleaning Products">';
    (state.products || []).filter(p => !isItemDeleted(p)).forEach(p => {
        const variantCount = Array.isArray(p.variants) && p.variants.length > 0 ? ` (${p.variants.length} pack sizes)` : '';
        html += `<option value="cln_${p.id}" data-type="cleaning" data-id="${p.id}">${p.name}${variantCount}</option>`;
    });
    html += '</optgroup>';

    // Cosmetics Products
    html += '<optgroup label="💄 Cosmetics Products">';
    (state.cosProducts || []).filter(p => !isItemDeleted(p)).forEach(p => {
        const variantCount = Array.isArray(p.variants) && p.variants.length > 0 ? ` (${p.variants.length} pack sizes)` : '';
        html += `<option value="cos_${p.id}" data-type="cosmetics" data-id="${p.id}">${p.name}${variantCount}</option>`;
    });
    html += '</optgroup>';

    select.innerHTML = html;
}

export function onOrderProductChange() {
    const select = document.getElementById('orderItemProductSelect');
    const opt = select ? select.options[select.selectedIndex] : null;
    const wrapper = document.getElementById('orderPackVariantWrapper');
    const variantSelect = document.getElementById('orderPackVariantSelect');
    const badgeEl = document.getElementById('orderPackVariantBadge');
    const customNameEl = document.getElementById('orderItemCustomName');
    const rateEl = document.getElementById('orderItemRate');
    const qtyEl = document.getElementById('orderItemQty');
    const unitEl = document.getElementById('orderItemUnit');

    if (!opt || !opt.value) {
        if (wrapper) wrapper.classList.add('hidden');
        if (badgeEl) badgeEl.textContent = '';
        if (customNameEl) customNameEl.value = '';
        if (rateEl) rateEl.value = '';
        return;
    }

    const type = opt.dataset.type;
    const prodId = opt.dataset.id;
    let product = null;

    if (type === 'cleaning') {
        product = (state.products || []).find(p => String(p.id) === String(prodId));
    } else if (type === 'cosmetics') {
        product = (state.cosProducts || []).find(p => String(p.id) === String(prodId));
    }

    if (!product) return;

    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) {
        if (wrapper && variantSelect) {
            wrapper.classList.remove('hidden');
            if (badgeEl) badgeEl.textContent = `${variants.length} options available`;

            let varHtml = `<option value="">-- Select Pack Size (${variants.length} options) --</option>`;
            variants.forEach(v => {
                const varDisplayName = v.name && v.name.toLowerCase().includes(product.name.toLowerCase())
                    ? v.name
                    : `${product.name} (${v.name || (v.size + ' ' + (v.unit || ''))})`;
                const rate = v.wholesalePrice || v.retailPrice || product.wholesalePrice || product.retailPrice || 0;
                varHtml += `<option value="${v.id}" data-name="${varDisplayName}" data-size="${v.size || 1}" data-unit="${v.unit || 'Bottle'}" data-rate="${rate}">
                    ${v.name || (v.size + ' ' + (v.unit || ''))} — ₹${Number(rate).toFixed(2)}
                </option>`;
            });

            // Add standard/bulk fallback
            const baseRate = product.wholesalePrice || product.retailPrice || 0;
            varHtml += `<option value="base_bulk" data-name="${product.name} (Bulk)" data-size="1" data-unit="${product.unit || 'Ltr'}" data-rate="${baseRate}">
                Standard / Bulk (${product.unit || 'Ltr'}) — ₹${Number(baseRate).toFixed(2)}
            </option>`;

            variantSelect.innerHTML = varHtml;
            variantSelect.selectedIndex = 1; // Default to first pack size
            onOrderPackVariantSelected();
        }
    } else {
        if (wrapper) wrapper.classList.add('hidden');
        if (badgeEl) badgeEl.textContent = '';
        if (variantSelect) variantSelect.innerHTML = '<option value="">-- None --</option>';

        const baseRate = product.wholesalePrice || product.retailPrice || 0;
        if (customNameEl) customNameEl.value = product.name;
        if (rateEl) rateEl.value = baseRate ? Number(baseRate).toFixed(2) : '';
        if (qtyEl && (!qtyEl.value || parseFloat(qtyEl.value) <= 0)) qtyEl.value = '1';
        if (unitEl && product.unit) {
            const u = product.unit;
            if ([...unitEl.options].some(o => o.value.toLowerCase() === u.toLowerCase())) {
                unitEl.value = u;
            } else {
                unitEl.value = 'Bottle';
            }
        }
    }
}

export function onOrderPackVariantSelected() {
    const select = document.getElementById('orderItemProductSelect');
    const opt = select ? select.options[select.selectedIndex] : null;
    const variantSelect = document.getElementById('orderPackVariantSelect');
    const vOpt = variantSelect ? variantSelect.options[variantSelect.selectedIndex] : null;
    const customNameEl = document.getElementById('orderItemCustomName');
    const rateEl = document.getElementById('orderItemRate');
    const unitEl = document.getElementById('orderItemUnit');
    const qtyEl = document.getElementById('orderItemQty');

    if (!opt || !vOpt || !vOpt.value) return;

    if (vOpt.dataset.name && customNameEl) {
        customNameEl.value = vOpt.dataset.name;
    }
    if (vOpt.dataset.rate && rateEl) {
        rateEl.value = Number(vOpt.dataset.rate).toFixed(2);
    }
    if (qtyEl && (!qtyEl.value || parseFloat(qtyEl.value) <= 0)) {
        qtyEl.value = '1';
    }
    if (vOpt.dataset.unit && unitEl) {
        const u = vOpt.dataset.unit;
        if ([...unitEl.options].some(o => o.value.toLowerCase() === u.toLowerCase())) {
            unitEl.value = u;
        } else if (/ml|l|ltr/i.test(u)) {
            unitEl.value = 'Bottle';
        }
    }
}

// Backward-compatibility alias
export function onOrderItemSelectChange() {
    onOrderProductChange();
}

export function addTempOrderItem() {
    const select = document.getElementById('orderItemProductSelect');
    const opt = select ? select.options[select.selectedIndex] : null;
    const variantWrapper = document.getElementById('orderPackVariantWrapper');
    const variantSelect = document.getElementById('orderPackVariantSelect');
    const isVariantVisible = variantWrapper && !variantWrapper.classList.contains('hidden');
    const vOpt = isVariantVisible && variantSelect && variantSelect.selectedIndex > 0
        ? variantSelect.options[variantSelect.selectedIndex] 
        : null;

    const customNameInput = document.getElementById('orderItemCustomName');
    const unitSelect = document.getElementById('orderItemUnit');
    
    let prodType = opt ? opt.dataset.type : '';
    let parentId = opt ? opt.dataset.id : '';
    let parentName = opt && opt.value ? opt.text.replace(/\s*\(\d+\s*pack sizes\)$/i, '').trim() : '';

    let variantId = '';
    let size = 1;
    let unit = unitSelect ? unitSelect.value : 'Bottle';

    if (vOpt && vOpt.value && vOpt.value !== 'base_bulk') {
        variantId = vOpt.value;
        size = parseFloat(vOpt.dataset.size) || 1;
        if (vOpt.dataset.unit && (!unitSelect || !unitSelect.value)) {
            unit = vOpt.dataset.unit;
        }
    }

    const rawEnteredName = customNameInput ? customNameInput.value.trim() : '';
    let productName = '';

    if (rawEnteredName) {
        // If user typed e.g. "250" or "250 ml" and a parent product was chosen, combine them cleanly!
        if (parentName && !rawEnteredName.toLowerCase().includes(parentName.toLowerCase())) {
            productName = `${parentName} (${rawEnteredName})`;
        } else {
            productName = rawEnteredName;
        }
    } else if (vOpt && vOpt.dataset.name) {
        productName = vOpt.dataset.name;
    } else if (parentName) {
        productName = parentName;
    }

    if (!productName) {
        alert("Please select a product or enter an item name.");
        return;
    }

    const qty = parseFloat(document.getElementById('orderItemQty').value) || 1;
    const rate = parseFloat(document.getElementById('orderItemRate').value) || 0;
    const total = qty * rate;

    const productId = parentId 
        ? (prodType === 'cleaning' ? `cln_${parentId}` : `cos_${parentId}`) 
        : ('custom_' + Date.now());

    const itemObj = {
        productId,
        productName,
        parentName: parentName || productName,
        parentId,
        variantId,
        size,
        qty,
        unit,
        rate,
        total
    };

    if (editingOrderItemIndex >= 0 && editingOrderItemIndex < tempOrderItems.length) {
        tempOrderItems[editingOrderItemIndex] = itemObj;
        editingOrderItemIndex = -1;
        const addBtn = document.getElementById('btnAddOrderItem');
        if (addBtn) {
            addBtn.innerHTML = '+ Add Item';
            addBtn.className = 'w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition shadow-xs';
        }
    } else {
        tempOrderItems.push(itemObj);
    }

    // Reset row
    if (select) select.value = '';
    if (variantSelect) {
        variantSelect.innerHTML = '<option value="">-- Select Pack Size --</option>';
        if (variantWrapper) variantWrapper.classList.add('hidden');
    }
    if (customNameInput) customNameInput.value = '';
    document.getElementById('orderItemQty').value = 1;
    document.getElementById('orderItemRate').value = '';

    renderTempOrderItems();
}

export function editTempOrderItem(idx) {
    if (idx < 0 || idx >= tempOrderItems.length) return;
    const item = tempOrderItems[idx];
    if (!item) return;

    editingOrderItemIndex = idx;

    const select = document.getElementById('orderItemProductSelect');
    const customNameInput = document.getElementById('orderItemCustomName');
    const unitSelect = document.getElementById('orderItemUnit');
    const qtyInput = document.getElementById('orderItemQty');
    const rateInput = document.getElementById('orderItemRate');

    // 1. Try to find and select matching product in orderItemProductSelect
    if (select) {
        let matched = false;
        if (item.parentId) {
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].dataset.id === String(item.parentId)) {
                    select.selectedIndex = i;
                    matched = true;
                    break;
                }
            }
        }
        if (!matched && (item.parentName || item.productName)) {
            const check = (item.parentName || item.productName).toLowerCase();
            for (let i = 0; i < select.options.length; i++) {
                const optVal = select.options[i].value.toLowerCase();
                if (optVal && (check.startsWith(optVal) || optVal.startsWith(check) || check.includes(optVal))) {
                    select.selectedIndex = i;
                    matched = true;
                    break;
                }
            }
        }

        if (matched) {
            onOrderProductChange();
            if (item.variantId) {
                const variantSelect = document.getElementById('orderPackVariantSelect');
                if (variantSelect) {
                    for (let j = 0; j < variantSelect.options.length; j++) {
                        if (variantSelect.options[j].value === item.variantId) {
                            variantSelect.selectedIndex = j;
                            break;
                        }
                    }
                }
            }
        } else {
            select.selectedIndex = 0;
            const variantWrapper = document.getElementById('orderPackVariantWrapper');
            if (variantWrapper) variantWrapper.classList.add('hidden');
        }
    }

    // 2. Pre-fill custom name, unit, qty, rate
    if (customNameInput) customNameInput.value = item.productName || '';
    if (unitSelect && item.unit) {
        if ([...unitSelect.options].some(o => o.value.toLowerCase() === item.unit.toLowerCase())) {
            unitSelect.value = item.unit;
        }
    }
    if (qtyInput) qtyInput.value = item.qty !== undefined ? item.qty : 1;
    if (rateInput) rateInput.value = item.rate !== undefined ? item.rate : '';

    // 3. Switch add button to "✓ Update Item"
    const addBtn = document.getElementById('btnAddOrderItem');
    if (addBtn) {
        addBtn.innerHTML = '✓ Update Item';
        addBtn.className = 'w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition shadow-xs ring-2 ring-indigo-300';
    }

    renderTempOrderItems();
    customNameInput?.focus();
}

export function removeTempOrderItem(idx) {
    if (editingOrderItemIndex === idx) {
        editingOrderItemIndex = -1;
        const addBtn = document.getElementById('btnAddOrderItem');
        if (addBtn) {
            addBtn.innerHTML = '+ Add Item';
            addBtn.className = 'w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition shadow-xs';
        }
        const select = document.getElementById('orderItemProductSelect');
        if (select) select.value = '';
        const variantWrapper = document.getElementById('orderPackVariantWrapper');
        if (variantWrapper) variantWrapper.classList.add('hidden');
        const customNameInput = document.getElementById('orderItemCustomName');
        if (customNameInput) customNameInput.value = '';
        if (document.getElementById('orderItemQty')) document.getElementById('orderItemQty').value = '1';
        if (document.getElementById('orderItemRate')) document.getElementById('orderItemRate').value = '';
    } else if (editingOrderItemIndex > idx) {
        editingOrderItemIndex--;
    }
    tempOrderItems.splice(idx, 1);
    renderTempOrderItems();
}

export function renderTempOrderItems() {
    const container = document.getElementById('tempOrderItemsList');
    if (!container) return;

    if (tempOrderItems.length === 0) {
        container.innerHTML = `<div class="text-center py-3 text-slate-400 text-xs italic">No items added yet. Add items above.</div>`;
        updateOrderModalTotals();
        return;
    }

    let html = '';
    tempOrderItems.forEach((item, idx) => {
        const isEditing = (editingOrderItemIndex === idx);
        html += `
            <div class="flex items-center justify-between p-2.5 bg-white border ${isEditing ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50/30' : 'border-slate-200'} rounded-xl text-xs gap-2 shadow-xs transition">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <strong class="text-slate-900 block truncate">${item.productName}</strong>
                        ${isEditing ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">Editing...</span>' : ''}
                    </div>
                    <span class="text-slate-500 text-[11px]">${item.qty} ${item.unit} × ₹${Number(item.rate).toFixed(2)} = <strong class="text-slate-800">₹${Number(item.total).toFixed(2)}</strong></span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="window.editTempOrderItem(${idx})" title="Edit Item" class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold text-xs transition border border-indigo-200 flex items-center gap-0.5">
                        <span>✏️</span> <span>Edit</span>
                    </button>
                    <button type="button" onclick="window.removeTempOrderItem(${idx})" title="Remove Item" class="px-2 py-1 bg-rose-50 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded-lg font-bold text-xs transition border border-rose-200">
                        ✕
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    updateOrderModalTotals();
}

export function updateOrderModalTotals() {
    const grandTotal = tempOrderItems.reduce((sum, i) => sum + Number(i.total || 0), 0);
    const advance = parseFloat(document.getElementById('orderAdvancePaid')?.value || 0) || 0;
    const balance = Math.max(0, grandTotal - advance);

    const elTotal = document.getElementById('orderModalGrandTotal');
    const elBal = document.getElementById('orderModalBalance');
    if (elTotal) elTotal.textContent = '₹' + grandTotal.toFixed(2);
    if (elBal) elBal.textContent = '₹' + balance.toFixed(2);
}

export function saveOrderBooking() {
    const id = document.getElementById('orderBookingId').value;
    const orderNo = (document.getElementById('orderBookingNo').value || '').trim();
    const customerName = (document.getElementById('orderCustomerName').value || '').trim();
    const phone = (document.getElementById('orderCustomerPhone').value || '').trim();
    const address = (document.getElementById('orderCustomerAddress').value || '').trim();
    const dueDate = document.getElementById('orderDueDate').value || getTodayDateString();
    const dueTime = document.getElementById('orderDueTime').value || '17:00';
    const advancePaid = parseFloat(document.getElementById('orderAdvancePaid').value) || 0;
    const notes = (document.getElementById('orderNotes').value || '').trim();

    if (!customerName) {
        alert("Please enter Customer / Shop Name.");
        return;
    }

    if (tempOrderItems.length === 0) {
        alert("Please add at least one product item to the order.");
        return;
    }

    const totalAmount = tempOrderItems.reduce((sum, i) => sum + Number(i.total || 0), 0);
    const balanceAmount = Math.max(0, totalAmount - advancePaid);

    if (!Array.isArray(state.orders)) state.orders = [];

    if (id) {
        // Edit existing
        const idx = state.orders.findIndex(o => o.id === id);
        if (idx !== -1) {
            state.orders[idx] = {
                ...state.orders[idx],
                orderNo,
                customerName,
                phone,
                address,
                items: [...tempOrderItems],
                totalAmount,
                advancePaid,
                balanceAmount,
                dueDate,
                dueTime,
                notes,
                updatedAt: Date.now()
            };
        }
    } else {
        // New order
        const newOrder = {
            id: 'ord_' + Date.now(),
            orderNo: orderNo || 'ORD-' + (Date.now().toString().slice(-4)),
            customerName,
            phone,
            address,
            items: [...tempOrderItems],
            totalAmount,
            advancePaid,
            balanceAmount,
            orderDate: getTodayDateString(),
            dueDate,
            dueTime,
            status: 'pending',
            notes,
            createdAt: Date.now(),
            savedAt: Date.now()
        };
        state.orders.unshift(newOrder);
    }

    closeNewOrderModal();
    renderOrders();
    syncToFirebase();
}

export function setOrderStatus(id, newStatus) {
    if (!Array.isArray(state.orders)) return;
    const order = state.orders.find(o => o.id === id);
    if (order) {
        order.status = newStatus;
        if (newStatus === 'delivered') order.deliveredAt = Date.now();
        order.updatedAt = Date.now();
        renderOrders();
        syncToFirebase();
    }
}

export function editOrderBooking(id) {
    const order = (state.orders || []).find(o => o.id === id);
    if (order) {
        openNewOrderModal(order);
    }
}

export function deleteOrderBooking(id) {
    if (confirm("Are you sure you want to delete this order booking?")) {
        markIdDeleted(id);
        state.orders = (state.orders || []).filter(o => o.id !== id);
        renderOrders();
        syncToFirebase();
    }
}

export function convertOrderToBill(id) {
    const order = (state.orders || []).find(o => o.id === id);
    if (!order) return;

    if (!confirm(`Convert order "${order.orderNo}" for "${order.customerName}" directly into a Bill/Invoice?`)) {
        return;
    }

    // 1. Pre-fill customer details in Billing
    const nameInput = document.getElementById('customerName');
    const phoneInput = document.getElementById('customerPhone');
    if (nameInput) nameInput.value = order.customerName;
    if (phoneInput) phoneInput.value = order.phone || '';

    // 2. Transfer items into Billing currentBillItems
    if (!Array.isArray(state.currentBillItems)) state.currentBillItems = [];
    
    (order.items || []).forEach(item => {
        const parentProduct = (state.products || []).find(p => 
            (item.parentId && String(p.id) === String(item.parentId)) || 
            (item.parentName && p.name.toLowerCase() === item.parentName.toLowerCase()) ||
            p.name.toLowerCase() === item.productName.toLowerCase()
        ) || (state.cosProducts || []).find(cp => 
            (item.parentId && String(cp.id) === String(item.parentId)) || 
            (item.parentName && cp.name.toLowerCase() === item.parentName.toLowerCase()) ||
            cp.name.toLowerCase() === item.productName.toLowerCase()
        );

        let variant = null;
        if (parentProduct && Array.isArray(parentProduct.variants)) {
            if (item.variantId) {
                variant = parentProduct.variants.find(v => String(v.id) === String(item.variantId));
            }
            if (!variant) {
                variant = parentProduct.variants.find(v => 
                    item.productName.toLowerCase().includes(String(v.name || '').toLowerCase()) ||
                    (v.size && item.productName.includes(String(v.size)))
                );
            }
        }

        const qtyUnits = Number(item.qty || 1);
        const itemRate = Number(item.rate || 0);

        state.currentBillItems.push({
            id: 'bi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            productName: parentProduct ? parentProduct.name : item.productName,
            variantId: variant ? variant.id : (item.variantId || ''),
            variantName: variant ? variant.name : '',
            displayName: item.productName,
            qty: variant ? (variant.size || 1) : 1,
            rate: itemRate,
            unitType: item.unit || (variant ? variant.unit : 'Bottle'),
            quantityType: item.unit || 'Bottle',
            numberOfUnits: qtyUnits,
            total: itemRate * qtyUnits,
            stockDeductionQty: variant ? ((variant.size || 1) * qtyUnits) : qtyUnits,
            packageId: variant?.packageId || parentProduct?.packageId || null,
            stockId: parentProduct ? parentProduct.id : item.productId,
            category: parentProduct?.category || 'Cleaning'
        });
    });

    // 3. Navigate to Billing
    if (typeof window.switchTab === 'function') {
        window.switchTab('billing');
    }

    if (typeof window.renderBillPreviewInput === 'function') {
        window.renderBillPreviewInput();
    }
    if (typeof window.calculateBalance === 'function') {
        window.calculateBalance();
    }

    alert(`✓ Order items transferred to Billing screen! Review and save invoice.`);
}

export function shareOrderWhatsApp(id) {
    const order = (state.orders || []).find(o => o.id === id);
    if (!order) return;

    let text = `*📦 FIA CLEAN & CARE - ORDER CONFIRMATION*\n`;
    text += `*Order No:* ${order.orderNo}\n`;
    text += `*Customer:* ${order.customerName}\n`;
    text += `*Expected Delivery:* ${formatDateDDMMYYYY(order.dueDate)} ${order.dueTime ? `at ${order.dueTime}` : ''}\n`;
    text += `------------------------------------\n`;
    text += `*ITEMS:*\n`;
    (order.items || []).forEach((item, i) => {
        text += `${i + 1}. *${item.productName}* - ${item.qty} ${item.unit} (₹${item.total.toFixed(2)})\n`;
    });
    text += `------------------------------------\n`;
    text += `*Total Amount:* ₹${Number(order.totalAmount || 0).toFixed(2)}\n`;
    if (order.advancePaid) {
        text += `*Advance Paid:* ₹${Number(order.advancePaid).toFixed(2)}\n`;
        text += `*Balance on Delivery:* ₹${Number((order.totalAmount || 0) - order.advancePaid).toFixed(2)}\n`;
    }
    text += `\n_Thank you for choosing FIA Clean & Care!_`;

    const phone = (order.phone || '').replace(/\D/g, '');
    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

export function updateDnoBadge() {
    const today = getTodayDateString();
    const lowStockCount = getLowStockProducts().length;
    const urgentDemandsCount = (state.demands || []).filter(d => !isItemDeleted(d) && d.isUrgent && d.status !== 'received').length;
    const overdueOrdersCount = (state.orders || []).filter(o => !isItemDeleted(o) && o.status !== 'delivered' && o.status !== 'cancelled' && (o.dueDate <= today)).length;
    
    const totalAlerts = lowStockCount + urgentDemandsCount + overdueOrdersCount;

    const navBadge = document.getElementById('navDnoBadge');
    if (navBadge) {
        if (totalAlerts > 0) {
            navBadge.textContent = totalAlerts;
            navBadge.classList.remove('hidden');
        } else {
            navBadge.classList.add('hidden');
        }
    }

    const dashboardCardCount = document.getElementById('dashboardDnoAlertCount');
    if (dashboardCardCount) {
        dashboardCardCount.textContent = totalAlerts;
    }
}

export function renderDno() {
    if (currentDnoSubTab === 'demands') {
        renderDemands();
    } else {
        renderOrders();
    }
    updateDnoBadge();
}

// Global window mappings
window.switchDnoSubTab = switchDnoSubTab;
window.renderDno = renderDno;
window.renderDemands = renderDemands;
window.renderOrders = renderOrders;
window.filterDemands = filterDemands;
window.filterOrders = filterOrders;
window.openAddDemandModal = openAddDemandModal;
window.closeAddDemandModal = closeAddDemandModal;
window.saveDemandItem = saveDemandItem;
window.quickAddLowStockToDemand = quickAddLowStockToDemand;
window.setDemandStatus = setDemandStatus;
window.editDemandItem = editDemandItem;
window.deleteDemandItem = deleteDemandItem;
window.shareDemandsWhatsApp = shareDemandsWhatsApp;
window.openNewOrderModal = openNewOrderModal;
window.closeNewOrderModal = closeNewOrderModal;
window.onOrderCustomerSelect = onOrderCustomerSelect;
window.onOrderItemSelectChange = onOrderItemSelectChange;
window.onOrderProductChange = onOrderProductChange;
window.onOrderPackVariantSelected = onOrderPackVariantSelected;
window.addTempOrderItem = addTempOrderItem;
window.editTempOrderItem = editTempOrderItem;
window.removeTempOrderItem = removeTempOrderItem;
window.saveOrderBooking = saveOrderBooking;
window.setOrderStatus = setOrderStatus;
window.editOrderBooking = editOrderBooking;
window.deleteOrderBooking = deleteOrderBooking;
window.convertOrderToBill = convertOrderToBill;
window.shareOrderWhatsApp = shareOrderWhatsApp;
window.toggleAudioMute = toggleAudioMute;
window.checkOverdueOrderAlerts = checkOverdueOrderAlerts;
window.updateOrderModalTotals = updateOrderModalTotals;
