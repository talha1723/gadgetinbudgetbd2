var db = window.db || (typeof firebase !== 'undefined' && firebase.apps.length ? firebase.firestore() : null);

var adminProducts = [];
var adminOrders = [];
var adminCoupons = [];
var appSettings = {
  insideDhaka: 60,
  outsideDhaka: 120,
  freeInside: false,
  freeAllBd: false,
  tgBotToken: '',
  tgChatId: '',
  whatsapp: '8801815701085',
  facebook: '',
  instagram: '',
  youtube: ''
};

// ক্লাউড ও লোকাল স্টোরেজ থেকে পাসওয়ার্ড রিড করা
function getAdminPassword() {
  return localStorage.getItem('gib_admin_password') || "admin123";
}

// ফায়ারবেস ক্লাউড থেকে পাসওয়ার্ড রিয়েল-টাইম সিঙ্ক
function listenToAdminPassword() {
  if (!db && window.db) db = window.db;
  if (!db) return;
  db.collection("settings").doc("security").onSnapshot(doc => {
    if (doc.exists && doc.data().password) {
      localStorage.setItem('gib_admin_password', doc.data().password);
    }
  }, err => console.log("পাসওয়ার্ড সিঙ্ক এরর:", err));
}

// ১৫ মিনিট নিষ্ক্রিয় থাকলে স্বয়ংক্রিয় লক
var inactivityTimer = null;
function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    alert('১৫ মিনিট নিষ্ক্রিয় থাকায় সেশন স্বয়ংক্রিয়ভাবে লক করা হয়েছে।');
    handleLogout();
  }, 15 * 60 * 1000);
}

// পেজ লোড ইভেন্ট লিসেনার
document.addEventListener('DOMContentLoaded', () => {
  if (!db && window.db) db = window.db;
  listenToAdminPassword();

  if (sessionStorage.getItem('gib_admin_auth') === 'true') {
    showDashboard();
  } else {
    showLogin();
  }
  document.addEventListener('mousemove', resetInactivityTimer);
  document.addEventListener('keypress', resetInactivityTimer);
});

// লগইন স্ক্রিন শো করা (পাসওয়ার্ড ইনপুট ফাঁকা রাখা)
function showLogin() {
  var loginWrap = document.getElementById('loginWrapper');
  var dashWrap = document.getElementById('dashboardWrapper');
  if (loginWrap) loginWrap.style.display = 'flex';
  if (dashWrap) dashWrap.style.display = 'none';

  var passInput = document.getElementById('adminPassInput');
  if (passInput) {
    passInput.value = '';
  }
}

// লগআউট হ্যান্ডলার
window.handleLogout = function() {
  sessionStorage.removeItem('gib_admin_auth');
  
  var passInput = document.getElementById('adminPassInput');
  if (passInput) {
    passInput.value = '';
  }
  
  showLogin();
};

// লগইন সাবমিট হ্যান্ডলার
window.handleAdminLogin = function(e) {
  if (e) e.preventDefault();
  var inputElem = document.getElementById('adminPassInput');
  var pass = inputElem ? inputElem.value.trim() : '';
  var currentSavedPass = getAdminPassword();

  if (pass === currentSavedPass) {
    sessionStorage.setItem('gib_admin_auth', 'true');
    showDashboard();
  } else {
    var errElem = document.getElementById('loginErrorMsg');
    if (errElem) errElem.textContent = 'ভুল পাসওয়ার্ড!';
    alert('ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন।');
  }
  return false;
};

// ড্যাশবোর্ড স্ক্রিন শো করা
function showDashboard() {
  var loginWrap = document.getElementById('loginWrapper');
  var dashWrap = document.getElementById('dashboardWrapper');
  if (loginWrap) loginWrap.style.display = 'none';
  if (dashWrap) dashWrap.style.display = 'block';

  if (!db && window.db) db = window.db;

  if (db) {
    listenToAdminPassword();
    listenToProducts();
    listenToOrders();
    listenToCoupons();
    loadSettingsFromFirebase();
  } else {
    console.error("ফায়ারবেস ডাটাবেস লোড হয়নি!");
  }

  resetInactivityTimer();
}

window.switchAdminTab = function(tabId, ev) {
  document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  if (ev && ev.currentTarget) ev.currentTarget.classList.add('active');
  var target = document.getElementById(tabId);
  if (target) target.classList.add('active');
};

// ==========================================
// ১. পণ্য ম্যানেজমেন্ট ও এডিট
// ==========================================
function listenToProducts() {
  if (!db) return;
  db.collection("products").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    adminProducts = [];
    snapshot.forEach(doc => {
      adminProducts.push({ id: doc.id, ...doc.data() });
    });
    renderProductsTable();
    updateCategoryDatalist();
  }, error => {
    console.error("পণ্য লোড এরর:", error);
  });
}

window.handleSaveOrUpdateProduct = async function(e) {
  if (e) e.preventDefault();
  if (!db && window.db) db = window.db;
  if (!db) {
    alert("ডাটাবেস কানেকশন পাওয়া যায়নি!");
    return;
  }

  var editId = document.getElementById('editProductId').value;
  var name = document.getElementById('pName').value.trim();
  var category = document.getElementById('pCategory').value.trim();
  var stockQuantity = Number(document.getElementById('pStockQty').value) || 0;
  var originalPrice = Number(document.getElementById('pOriginalPrice').value) || null;
  var price = Number(document.getElementById('pPrice').value);
  var rawImages = document.getElementById('pImages').value.trim();
  var desc = document.getElementById('pDesc').value.trim();
  var isFreeDelivery = document.getElementById('pFreeDelivery').checked;
  var stockStatus = document.querySelector('input[name="stockStatus"]:checked').value;

  var imagesList = rawImages.split(',').map(s => s.trim()).filter(Boolean);

  var productData = {
    name: name,
    category: category,
    stockQuantity: stockQuantity,
    originalPrice: originalPrice,
    price: price,
    imageUrl: imagesList[0] || 'https://via.placeholder.com/300',
    images: imagesList,
    description: desc,
    isFreeDelivery: isFreeDelivery,
    stockStatus: stockStatus,
    updatedAt: new Date().toISOString()
  };

  try {
    if (editId) {
      await db.collection("products").doc(editId).update(productData);
      alert('✅ পণ্য ডাটাবেসে সফলভাবে আপডেট হয়েছে!');
    } else {
      productData.createdAt = new Date().toISOString();
      await db.collection("products").add(productData);
      alert('✅ নতুন পণ্য ডাটাবেসে সফলভাবে যুক্ত হয়েছে!');
    }
    cancelEditMode();
  } catch (error) {
    alert('এরর: ' + error.message);
  }
};

window.editProduct = function(id) {
  var p = adminProducts.find(item => item.id === id);
  if (!p) return;

  switchAdminTab('tabProducts');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  document.getElementById('editProductId').value = p.id;
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pStockQty').value = p.stockQuantity || 0;
  document.getElementById('pOriginalPrice').value = p.originalPrice || '';
  document.getElementById('pPrice').value = p.price || '';
  document.getElementById('pImages').value = (p.images && p.images.length > 0) ? p.images.join(', ') : (p.imageUrl || '');
  document.getElementById('pDesc').value = p.description || '';
  document.getElementById('pFreeDelivery').checked = !!p.isFreeDelivery;

  var radios = document.querySelectorAll('input[name="stockStatus"]');
  radios.forEach(r => {
    if (r.value === p.stockStatus) r.checked = true;
  });

  document.getElementById('formHeaderTitle').textContent = 'পণ্য এডিট করুন';
  document.getElementById('saveProdBtn').textContent = 'পণ্য আপডেট করুন';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
};

window.cancelEditMode = function() {
  document.getElementById('addProductForm').reset();
  document.getElementById('editProductId').value = '';
  document.getElementById('formHeaderTitle').textContent = 'নতুন পণ্য যোগ করুন';
  document.getElementById('saveProdBtn').textContent = 'পণ্য সেভ করুন';
  document.getElementById('cancelEditBtn').style.display = 'none';
};

window.deleteProduct = async function(id) {
  if (!confirm('পণ্যটি ডাটাবেস থেকে মুছে ফেলতে চান?')) return;
  try {
    await db.collection("products").doc(id).delete();
  } catch (err) {
    alert('মুছতে সমস্যা: ' + err.message);
  }
};

function renderProductsTable() {
  var tbody = document.getElementById('productsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (adminProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:#94a3b8;">কোনো পণ্য নেই! উপরে ফর্ম পূরণ করে যোগ করুন।</td></tr>';
    return;
  }

  adminProducts.forEach(p => {
    var stockLabel = `<span style="color:#10b981;">ইন স্টক (${p.stockQuantity || 0})</span>`;
    if (p.stockStatus === 'low_stock') stockLabel = `<span style="color:#f59e0b;">লো স্টক (${p.stockQuantity || 0})</span>`;
    if (p.stockStatus === 'stock_out' || Number(p.stockQuantity) <= 0) stockLabel = `<span style="color:#ef4444;">স্টক আউট (০)</span>`;

    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${p.imageUrl}" style="width:38px; height:38px; object-fit:contain; background:#fff; border-radius:4px;"></td>
      <td><b>${p.name}</b></td>
      <td>${p.category}</td>
      <td>৳ ${Number(p.price).toLocaleString()}</td>
      <td>${stockLabel}</td>
      <td style="text-align: center;">
        <div class="action-btn-group">
          <button class="btn-tbl-edit" onclick="editProduct('${p.id}')">এডিট</button>
          <button class="btn-tbl-delete" onclick="deleteProduct('${p.id}')">মুছুন</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateCategoryDatalist() {
  var datalist = document.getElementById('catList');
  if (!datalist) return;
  var cats = [...new Set(adminProducts.map(p => p.category).filter(Boolean))];
  datalist.innerHTML = cats.map(c => `<option value="${c}">`).join('');
}

// ==========================================
// ২. অর্ডার ও স্মার্ট স্টক ট্র্যাকিং
// ==========================================
function listenToOrders() {
  if (!db) return;
  db.collection("orders").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    adminOrders = [];
    snapshot.forEach(doc => {
      adminOrders.push({ id: doc.id, ...doc.data() });
    });
    renderOrdersTable();
  }, err => console.error("অর্ডার লোড এরর:", err));
}

function renderOrdersTable() {
  var tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  var countBadge = document.getElementById('orderCountBadge');
  if (countBadge) countBadge.textContent = `মোট অর্ডার: ${adminOrders.length}`;

  if (adminOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:#94a3b8;">কোনো অর্ডার পাওয়া যায়নি!</td></tr>';
    return;
  }

  adminOrders.forEach((o, index) => {
    var tr = document.createElement('tr');
    var items = (o.items || []).map(i => `${i.name} (x${i.quantity || 1})`).join(', ');
    var phone = o.customerPhone || '';
    var cleanPhone = phone.replace(/[^0-9]/g, '');

    tr.innerHTML = `
      <td><b>#${o.orderNo || ('GB-' + (index + 1001))}</b></td>
      <td><b>${o.customerName || 'N/A'}</b><br><small style="color:#94a3b8;">${phone}<br>${o.customerAddress || ''}</small></td>
      <td><b>৳ ${(o.grandTotal || o.totalAmount || 0).toLocaleString()}</b><br><small style="color:#94a3b8;">${items}</small></td>
      <td>${o.createdAt ? new Date(o.createdAt).toLocaleDateString('bn-BD') : 'আজ'}</td>
      <td>
        <select class="order-status-select" onchange="handleOrderStatusChange('${o.id}', this.value)">
          <option value="নতুন অর্ডার" ${o.status === 'নতুন অর্ডার' ? 'selected' : ''}>নতুন অর্ডার (Pending)</option>
          <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>অর্ডার কনফার্ম (স্টক কমবে)</option>
          <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>ডেলিভার্ড (স্টক অপরিবর্তিত)</option>
          <option value="Returned" ${o.status === 'Returned' ? 'selected' : ''}>রিটার্ন (স্টকে ফেরত যোগ হবে)</option>
          <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>ক্যান্সেল (বাতিল)</option>
        </select>
      </td>
      <td>
        <a href="tel:${phone}" class="btn-act-call" title="কল করুন"><i class="fas fa-phone"></i></a>
        <a href="https://wa.me/${cleanPhone}" target="_blank" class="btn-act-wa" title="হোয়াটসঅ্যাপ"><i class="fab fa-whatsapp"></i></a>
        <button onclick="deleteOrder('${o.id}')" style="background:none; border:none; color:#ef4444; margin-left:6px; cursor:pointer;" title="অর্ডার মুছুন"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.handleOrderStatusChange = async function(orderDocId, newStatus) {
  var order = adminOrders.find(o => o.id === orderDocId);
  if (!order || !db) return;

  var oldStatus = order.status || 'নতুন অর্ডার';

  try {
    if (newStatus === 'Confirmed' && oldStatus !== 'Confirmed' && oldStatus !== 'Delivered') {
      for (var item of (order.items || [])) {
        if (item.id) {
          var prodRef = db.collection("products").doc(item.id);
          var doc = await prodRef.get();
          if (doc.exists) {
            var currentQty = doc.data().stockQuantity || 0;
            var newQty = Math.max(0, currentQty - (item.quantity || 1));
            var sStatus = newQty === 0 ? 'stock_out' : (newQty <= 3 ? 'low_stock' : 'in_stock');
            await prodRef.update({ stockQuantity: newQty, stockStatus: sStatus });
          }
        }
      }
      alert('📦 অর্ডার কনফার্ম হয়েছে এবং স্টক কমানো হয়েছে!');
    } else if (newStatus === 'Returned' && (oldStatus === 'Confirmed' || oldStatus === 'Delivered')) {
      for (var item of (order.items || [])) {
        if (item.id) {
          var prodRef = db.collection("products").doc(item.id);
          var doc = await prodRef.get();
          if (doc.exists) {
            var currentQty = doc.data().stockQuantity || 0;
            var newQty = currentQty + (item.quantity || 1);
            var sStatus = newQty > 3 ? 'in_stock' : 'low_stock';
            await prodRef.update({ stockQuantity: newQty, stockStatus: sStatus });
          }
        }
      }
      alert('🔄 পণ্য রিটার্ন এসেছে এবং স্টকে ফেরত যোগ হয়েছে!');
    } else if (newStatus === 'Cancelled' && oldStatus === 'Confirmed') {
      for (var item of (order.items || [])) {
        if (item.id) {
          var prodRef = db.collection("products").doc(item.id);
          var doc = await prodRef.get();
          if (doc.exists) {
            var currentQty = doc.data().stockQuantity || 0;
            var newQty = currentQty + (item.quantity || 1);
            var sStatus = newQty > 3 ? 'in_stock' : 'low_stock';
            await prodRef.update({ stockQuantity: newQty, stockStatus: sStatus });
          }
        }
      }
      alert('❌ অর্ডার বাতিল করা হয়েছে এবং স্টক পুনরুদ্ধার করা হয়েছে!');
    }

    await db.collection("orders").doc(orderDocId).update({ status: newStatus });
  } catch (err) {
    alert('স্ট্যাটাস আপডেট এরর: ' + err.message);
  }
};

window.deleteOrder = async function(orderDocId) {
  if (!confirm('অর্ডারটি ডাটাবেস থেকে মুছে ফেলতে চান?')) return;
  try {
    await db.collection("orders").doc(orderDocId).delete();
  } catch (err) {
    alert('মুছতে সমস্যা: ' + err.message);
  }
};

// ==========================================
// ৩. সেটিংস
// ==========================================
function loadSettingsFromFirebase() {
  if (!db) return;
  db.collection("settings").doc("general").onSnapshot(doc => {
    if (doc.exists) {
      appSettings = { ...appSettings, ...doc.data() };
    }
    loadBotDeliverySettings();
    loadSocialLinksUI();
  }, err => console.log("সেটিংস লোড:", err));
}

function loadSocialLinksUI() {
  if (document.getElementById('socialWhatsapp')) document.getElementById('socialWhatsapp').value = appSettings.whatsapp || '';
  if (document.getElementById('socialFb')) document.getElementById('socialFb').value = appSettings.facebook || '';
  if (document.getElementById('socialInsta')) document.getElementById('socialInsta').value = appSettings.instagram || '';
  if (document.getElementById('socialYt')) document.getElementById('socialYt').value = appSettings.youtube || '';
}

window.handleSaveSocialLinks = async function(e) {
  if (e) e.preventDefault();
  if (!db) return;
  var updateData = {
    whatsapp: document.getElementById('socialWhatsapp').value.trim(),
    facebook: document.getElementById('socialFb').value.trim(),
    instagram: document.getElementById('socialInsta').value.trim(),
    youtube: document.getElementById('socialYt').value.trim()
  };

  try {
    await db.collection("settings").doc("general").set(updateData, { merge: true });
    alert('✅ হোয়াটসঅ্যাপ ও সোশ্যাল লিংক ডাটাবেসে সেভ হয়েছে!');
  } catch (err) {
    alert('সেভ এরর: ' + err.message);
  }
};

function loadBotDeliverySettings() {
  if (document.getElementById('settingTgToken')) document.getElementById('settingTgToken').value = appSettings.tgBotToken || '';
  if (document.getElementById('settingTgChatId')) document.getElementById('settingTgChatId').value = appSettings.tgChatId || '';
  if (document.getElementById('settingWhatsapp')) document.getElementById('settingWhatsapp').value = appSettings.whatsapp || '';
  if (document.getElementById('chargeInside')) document.getElementById('chargeInside').value = appSettings.insideDhaka ?? 60;
  if (document.getElementById('chargeOutside')) document.getElementById('chargeOutside').value = appSettings.outsideDhaka ?? 120;
  if (document.getElementById('freeInside')) document.getElementById('freeInside').checked = !!appSettings.freeInside;
  if (document.getElementById('freeAllBd')) document.getElementById('freeAllBd').checked = !!appSettings.freeAllBd;
}

window.handleSaveBotDelivery = async function(e) {
  if (e) e.preventDefault();
  if (!db) return;
  var deliveryData = {
    tgBotToken: document.getElementById('settingTgToken').value.trim(),
    tgChatId: document.getElementById('settingTgChatId').value.trim(),
    whatsapp: document.getElementById('settingWhatsapp').value.trim(),
    insideDhaka: Number(document.getElementById('chargeInside').value) || 60,
    outsideDhaka: Number(document.getElementById('chargeOutside').value) || 120,
    freeInside: document.getElementById('freeInside').checked,
    freeAllBd: document.getElementById('freeAllBd').checked
  };

  try {
    await db.collection("settings").doc("general").set(deliveryData, { merge: true });
    alert('✅ সেটিংস সফলভাবে ক্লাউডে সেভ হয়েছে!');
  } catch (err) {
    alert('সেভ এরর: ' + err.message);
  }
};

// ==========================================
// ৪. কুপন কোড
// ==========================================
function listenToCoupons() {
  if (!db) return;
  db.collection("coupons").onSnapshot(snap => {
    adminCoupons = [];
    snap.forEach(d => adminCoupons.push({ id: d.id, ...d.data() }));
    renderCouponsTable();
  });
}

window.handleAddCoupon = async function(e) {
  if (e) e.preventDefault();
  if (!db) return;
  var code = document.getElementById('couponCode').value.trim().toUpperCase();
  var discount = Number(document.getElementById('couponDiscount').value);

  try {
    await db.collection("coupons").add({ code: code, discount: discount });
    alert('✅ কুপন যুক্ত করা হয়েছে!');
    document.getElementById('couponCode').value = '';
    document.getElementById('couponDiscount').value = '';
  } catch (err) {
    alert('কুপন এরর: ' + err.message);
  }
};

function renderCouponsTable() {
  var tbody = document.getElementById('couponsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (adminCoupons.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:12px; color:#94a3b8;">কোনো কুপন নেই!</td></tr>';
    return;
  }

  adminCoupons.forEach((c) => {
    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${c.code}</b></td>
      <td>৳ ${c.discount}</td>
      <td>
        <button onclick="deleteCoupon('${c.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.deleteCoupon = async function(docId) {
  if (!db) return;
  await db.collection("coupons").doc(docId).delete();
};

// টেলিগ্রাম টেস্ট
window.testTelegramAlert = async function() {
  var token = document.getElementById('settingTgToken').value.trim();
  var chatId = document.getElementById('settingTgChatId').value.trim();

  if (!token || !chatId) {
    alert('দয়া করে আগে বট টোকেন ও চ্যাট আইডি দিন!');
    return;
  }

  try {
    var res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🔔 *Gadget In Budget*\nটেলিগ্রাম বট সফলভাবে কানেক্ট হয়েছে!',
        parse_mode: 'Markdown'
      })
    });
    var result = await res.json();
    if (result.ok) alert('🎉 টেস্ট মেসেজ চলে গেছে! টেলিগ্রাম চেক করুন।');
    else alert('❌ মেসেজ যায়নি: ' + result.description);
  } catch (err) {
    alert('কানেকশন এরর: ' + err.message);
  }
};

// পাসওয়ার্ড পরিবর্তন (সরাসরি ক্লাউড ও লোকালে স্থায়ী সেভ)
window.handleChangePassword = async function(e) {
  if (e) e.preventDefault();
  var cur = document.getElementById('curPassword').value.trim();
  var newP = document.getElementById('newPassword').value.trim();
  var confP = document.getElementById('confirmNewPassword').value.trim();
  var savedPass = getAdminPassword();

  if (cur !== savedPass) {
    alert('বর্তমান পাসওয়ার্ডটি সঠিক নয়!');
    return;
  }
  if (newP !== confP) {
    alert('নতুন পাসওয়ার্ড দুটি মিলছে না!');
    return;
  }
  if (newP.length < 4) {
    alert('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে!');
    return;
  }

  try {
    localStorage.setItem('gib_admin_password', newP);

    if (!db && window.db) db = window.db;
    if (db) {
      await db.collection("settings").doc("security").set({ password: newP }, { merge: true });
    }

    alert('🎉 পাসওয়ার্ড সফলভাবে ক্লাউডে সংরক্ষিত হয়েছে!');
    document.getElementById('curPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
  } catch (err) {
    alert('পাসওয়ার্ড সেভ করতে সমস্যা হয়েছে: ' + err.message);
  }
};