var db = window.db || (typeof firebase !== 'undefined' && firebase.apps.length ? firebase.firestore() : null);

var allProducts = [];
var cart = JSON.parse(localStorage.getItem('gib_cart') || '[]');
var wishlist = JSON.parse(localStorage.getItem('gib_wishlist') || '[]');
var appSettings = { insideDhaka: 60, outsideDhaka: 120, freeInside: false, freeAllBd: false };

// কুপন ও ইনভয়েস স্টেট
var appliedCoupon = null;
var currentInvoiceData = null;

var productsGrid = document.getElementById('productsGrid');
var categoryTabs = document.getElementById('categoryTabs');
var cartDrawer = document.getElementById('cartDrawer');
var cartOverlay = document.getElementById('cartOverlay');
var cartItemsContainer = document.getElementById('cartItems');
var cartTotalPriceElem = document.getElementById('cartTotalPrice');
var checkoutModal = document.getElementById('checkoutModal');
var orderSummaryBox = document.getElementById('orderSummaryBox');

var wishlistDrawer = document.getElementById('wishlistDrawer');
var wishlistOverlay = document.getElementById('wishlistOverlay');
var wishlistItemsContainer = document.getElementById('wishlistItemsContainer');

// ফায়ারস্টোর থেকে লাইভ প্রোডাক্ট লোড
function listenToLiveProducts() {
  if (!db && window.db) db = window.db;
  if (!db) return;

  db.collection("products").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    allProducts = [];
    snapshot.forEach(doc => {
      allProducts.push({ id: doc.id, ...doc.data() });
    });
    renderCategories();
    renderProducts(allProducts);
  }, err => console.error("লাইভ পণ্য লোড এরর:", err));
}

// ফায়ারস্টোর থেকে সেটিংস লোড
function listenToLiveSettings() {
  if (!db && window.db) db = window.db;
  if (!db) return;

  db.collection("settings").doc("general").onSnapshot(doc => {
    if (doc.exists) {
      appSettings = { ...appSettings, ...doc.data() };
      updateFooterSocialLinks();
    }
  });
}

function renderCategories() {
  if (!categoryTabs) return;
  var categories = ['সব গ্যাজেট', ...new Set(allProducts.map(p => p.category).filter(Boolean))];
  
  categoryTabs.innerHTML = categories.map((cat, idx) => `
    <button class="cat-pill ${idx === 0 ? 'active' : ''}" onclick="filterCategory('${cat}', this)">
      ${cat}
    </button>
  `).join('');
}

window.filterCategory = function(category, elem) {
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  if (elem) elem.classList.add('active');

  if (category === 'সব গ্যাজেট') {
    renderProducts(allProducts);
  } else {
    renderProducts(allProducts.filter(p => p.category === category));
  }
};

// প্রোডাক্ট রেন্ডারিংয়ে ফ্রি ডেলিভারি ব্যাজ যুক্ত
function renderProducts(products) {
  if (!productsGrid) return;
  productsGrid.innerHTML = '';

  if (!products || products.length === 0) {
    productsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 40px 0;">কোনো পণ্য পাওয়া যায়নি।</p>';
    return;
  }

  products.forEach(p => {
    var card = document.createElement('div');
    card.className = 'product-card';

    var discountBadge = '';
    if (p.originalPrice && p.originalPrice > p.price) {
      var discount = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
      discountBadge = `<span class="badge discount">-${discount}% OFF</span>`;
    }

    // ফ্রি ডেলিভারি ব্যাজ
    var freeDeliveryBadge = '';
    if (p.isFreeDelivery) {
      var topPos = discountBadge ? '32px' : '8px';
      freeDeliveryBadge = `<span class="badge" style="position:absolute; top:${topPos}; left:8px; background:#059669; color:#fff; font-size:10px; font-weight:700; padding:3px 6px; border-radius:4px; z-index:2;">ফ্রি ডেলিভারি</span>`;
    }

    var stockBadge = '';
    var isOutOfStock = p.stockStatus === 'stock_out' || (p.stockQuantity !== undefined && Number(p.stockQuantity) <= 0);

    if (isOutOfStock) {
      stockBadge = `<span class="badge" style="position:absolute; bottom:8px; left:8px; background:#ef4444; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; z-index:2;">স্টক আউট</span>`;
    } else if (p.stockStatus === 'low_stock') {
      var qtyText = p.stockQuantity ? ` (${p.stockQuantity}টি বাকি)` : '';
      stockBadge = `<span class="badge" style="position:absolute; bottom:8px; left:8px; background:#f59e0b; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; z-index:2;">লো স্টক${qtyText}</span>`;
    } else {
      stockBadge = `<span class="badge" style="position:absolute; bottom:8px; left:8px; background:#10b981; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; z-index:2;">ইন স্টক</span>`;
    }

    var isFav = wishlist.some(item => item.id === p.id);

    card.innerHTML = `
      <div class="product-image-wrap" onclick="openProductQuickView('${p.id}')" style="cursor:pointer; position:relative;">
        ${discountBadge}
        ${freeDeliveryBadge}
        ${stockBadge}
        <button class="card-wishlist-btn" onclick="event.stopPropagation(); toggleWishlist('${p.id}')" title="পছন্দের তালিকায় রাখুন" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.4); border:none; color:${isFav ? '#ef4444' : '#fff'}; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:3;">
          <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
        </button>
        <img src="${p.imageUrl || 'https://via.placeholder.com/300'}" alt="${p.name}" loading="lazy">
      </div>
      <div class="product-info">
        <span class="category-tag">${p.category || 'Gadget'}</span>
        <h3 class="product-title" onclick="openProductQuickView('${p.id}')" style="cursor:pointer;">${p.name}</h3>
        <div class="price-row">
          <span class="current-price">৳ ${Number(p.price).toLocaleString()}</span>
          ${p.originalPrice ? `<span class="old-price">৳ ${Number(p.originalPrice).toLocaleString()}</span>` : ''}
        </div>
        <div class="card-buttons-group">
          <button class="buy-now-btn" ${isOutOfStock ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="directBuy('${p.id}')"`}>
            ${isOutOfStock ? 'স্টক নেই' : 'অর্ডার করুন'}
          </button>
          <button class="add-to-cart-btn" ${isOutOfStock ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="addToCart('${p.id}')"`}>
            কার্ট
          </button>
        </div>
      </div>
    `;
    productsGrid.appendChild(card);
  });
}

// কুইক ভিউ পপআপ
window.openProductQuickView = function(productId) {
  var product = allProducts.find(p => p.id === productId);
  if (!product) return;

  var modalBody = document.getElementById('quickModalBody');
  var modal = document.getElementById('productQuickModal');
  var overlay = document.getElementById('productModalOverlay');

  var images = (product.images && product.images.length > 0) ? product.images : [product.imageUrl || 'https://via.placeholder.com/300'];

  var stockHtml = '<span style="color:#10b981;"><i class="fas fa-check-circle"></i> স্টকে পর্যাপ্ত আছে</span>';
  if (product.stockStatus === 'low_stock') {
    stockHtml = `<span style="color:#f59e0b;"><i class="fas fa-exclamation-circle"></i> লো স্টক (${product.stockQuantity || 1}টি বাকি)</span>`;
  } else if (product.stockStatus === 'stock_out' || (product.stockQuantity && Number(product.stockQuantity) <= 0)) {
    stockHtml = '<span style="color:#ef4444;"><i class="fas fa-times-circle"></i> স্টক আউট</span>';
  }

  var thumbsHtml = '';
  if (images.length > 1) {
    thumbsHtml = `<div class="modal-thumbnails">
      ${images.map((img, idx) => `
        <img src="${img}" class="thumb-img ${idx === 0 ? 'active' : ''}" onclick="switchModalImage(this, '${img}')">
      `).join('')}
    </div>`;
  }

  modalBody.innerHTML = `
    <div class="modal-gallery">
      <div class="main-modal-img-wrap">
        <img id="mainModalImage" src="${images[0]}" alt="${product.name}">
      </div>
      ${thumbsHtml}
    </div>

    <div class="modal-product-details">
      <span class="modal-category">${product.category || 'Gadget'}</span>
      <h2 class="modal-title">${product.name}</h2>
      <div class="modal-stock-status">${stockHtml}</div>
      
      <div class="modal-prices">
        <span class="modal-current-price">৳ ${Number(product.price).toLocaleString()}</span>
        ${product.originalPrice ? `<span class="modal-old-price">৳ ${Number(product.originalPrice).toLocaleString()}</span>` : ''}
      </div>

      <div class="modal-description">
        ${product.description ? product.description : 'এই পণ্যের জন্য কোনো বিশেষ বিবরণ দেওয়া হয়নি।'}
      </div>

      <button class="modal-cart-btn" onclick="addToCart('${product.id}'); closeProductModal();">
        <i class="fas fa-shopping-bag"></i> কার্টে যোগ করুন
      </button>
    </div>
  `;

  modal.classList.add('active');
  overlay.classList.add('active');
};

window.switchModalImage = function(el, src) {
  document.getElementById('mainModalImage').src = src;
  document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
};

window.closeProductModal = function() {
  var modal = document.getElementById('productQuickModal');
  var overlay = document.getElementById('productModalOverlay');
  if (modal) modal.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
};

// উইশলিস্ট
window.toggleWishlist = function(productId) {
  var p = allProducts.find(item => item.id === productId);
  if (!p) return;

  var index = wishlist.findIndex(item => item.id === productId);
  if (index > -1) {
    wishlist.splice(index, 1);
  } else {
    wishlist.push(p);
  }

  localStorage.setItem('gib_wishlist', JSON.stringify(wishlist));
  updateWishlistUI();
  renderProducts(allProducts);
};

function updateWishlistUI() {
  var countBadge = document.getElementById('wishlistCountBadge');
  if (countBadge) countBadge.textContent = wishlist.length;

  if (!wishlistItemsContainer) return;
  wishlistItemsContainer.innerHTML = '';

  if (wishlist.length === 0) {
    wishlistItemsContainer.innerHTML = '<p style="text-align:center; color:#94a3b8; margin-top:30px;">আপনার পছন্দের তালিকায় কোনো পণ্য নেই!</p>';
    return;
  }

  wishlist.forEach((item, index) => {
    var div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${item.imageUrl || 'https://via.placeholder.com/80'}" alt="">
      <div class="cart-item-details">
        <h4>${item.name}</h4>
        <div class="price">৳ ${Number(item.price).toLocaleString()}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        <button onclick="addToCart('${item.id}')" style="background:#2563eb; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">
          কার্টে নিন
        </button>
        <button onclick="removeFromWishlist(${index})" style="background:none; border:none; color:#ef4444; font-size:12px; cursor:pointer;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    wishlistItemsContainer.appendChild(div);
  });
}

window.removeFromWishlist = function(index) {
  wishlist.splice(index, 1);
  localStorage.setItem('gib_wishlist', JSON.stringify(wishlist));
  updateWishlistUI();
  renderProducts(allProducts);
};

window.openWishlist = function() {
  if (wishlistDrawer) wishlistDrawer.classList.add('active');
  if (wishlistOverlay) wishlistOverlay.classList.add('active');
};

window.closeWishlist = function() {
  if (wishlistDrawer) wishlistDrawer.classList.remove('active');
  if (wishlistOverlay) wishlistOverlay.classList.remove('active');
};

// কার্ট
window.addToCart = function(productId) {
  var p = allProducts.find(item => item.id === productId);
  if (!p) return;

  var existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({ id: p.id, name: p.name, price: Number(p.price), imageUrl: p.imageUrl, quantity: 1 });
  }

  localStorage.setItem('gib_cart', JSON.stringify(cart));
  updateCartUI();
};

window.directBuy = function(productId) {
  var p = allProducts.find(item => item.id === productId);
  if (!p) return;

  cart = [{ id: p.id, name: p.name, price: Number(p.price), imageUrl: p.imageUrl, quantity: 1 }];
  localStorage.setItem('gib_cart', JSON.stringify(cart));
  updateCartUI();
  goToCheckout();
};

function updateCartUI() {
  var totalCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  document.querySelectorAll('.cart-count').forEach(el => el.textContent = totalCount);

  if (!cartItemsContainer) return;
  cartItemsContainer.innerHTML = '';
  var totalAmount = 0;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p style="text-align:center; color:#94a3b8; margin-top:20px;">আপনার কার্ট খালি!</p>';
  } else {
    cart.forEach((item, index) => {
      totalAmount += item.price * (item.quantity || 1);
      var div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <img src="${item.imageUrl || 'https://via.placeholder.com/80'}" alt="">
        <div class="cart-item-details">
          <h4>${item.name}</h4>
          <div class="price">৳ ${item.price.toLocaleString()} × ${item.quantity}</div>
        </div>
        <button onclick="removeFromCart(${index})" style="background:none;border:none;color:#ef4444;cursor:pointer;"><i class="fas fa-trash"></i></button>
      `;
      cartItemsContainer.appendChild(div);
    });
  }

  if (cartTotalPriceElem) cartTotalPriceElem.textContent = `৳ ${totalAmount.toLocaleString()}`;
}

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  localStorage.setItem('gib_cart', JSON.stringify(cart));
  updateCartUI();
};

window.openCart = function() {
  if (cartDrawer) cartDrawer.classList.add('active');
  if (cartOverlay) cartOverlay.classList.add('active');
};

window.closeCart = function() {
  if (cartDrawer) cartDrawer.classList.remove('active');
  if (cartOverlay) cartOverlay.classList.remove('active');
};

// কুপন যাচাই
window.applyCouponCode = async function() {
  var input = document.getElementById('checkoutCouponInput');
  var msg = document.getElementById('couponStatusMsg');
  if (!input || !msg) return;

  var code = input.value.trim().toUpperCase();
  if (!code) {
    msg.style.color = '#ef4444';
    msg.textContent = 'দয়া করে একটি কুপন কোড লিখুন!';
    return;
  }

  msg.style.color = '#94a3b8';
  msg.textContent = 'যাচাই করা হচ্ছে...';

  try {
    if (!db && window.db) db = window.db;

    if (db) {
      var snapshot = await db.collection("coupons").where("code", "==", code).get();
      if (!snapshot.empty) {
        var couponData = snapshot.docs[0].data();
        appliedCoupon = { code: code, discount: Number(couponData.discount) || 0 };
        msg.style.color = '#10b981';
        msg.textContent = `🎉 '${code}' কুপন সফলভাবে প্রয়োগ হয়েছে! ৳${appliedCoupon.discount} ছাড় পেয়েছেন।`;
      } else {
        appliedCoupon = null;
        msg.style.color = '#ef4444';
        msg.textContent = '❌ কুপন কোডটি সঠিক নয়!';
      }
    } else {
      appliedCoupon = null;
      msg.style.color = '#ef4444';
      msg.textContent = 'ডাটাবেস কানেক্ট নেই!';
    }
  } catch (err) {
    console.error(err);
    msg.style.color = '#ef4444';
    msg.textContent = 'কুপন যাচাই করতে সমস্যা হয়েছে!';
  }

  updateCheckoutTotal();
};

// চেকআউট হিসাব
window.updateCheckoutTotal = function() {
  var subTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  
  var charge = 0;
  if (!appSettings.freeAllBd) {
    var area = document.querySelector('input[name="deliveryArea"]:checked').value;
    if (area === 'inside') {
      charge = appSettings.freeInside ? 0 : (appSettings.insideDhaka || 60);
    } else {
      charge = appSettings.outsideDhaka || 120;
    }
  }

  var discountVal = 0;
  var discountRow = document.getElementById('couponDiscountRow');
  var discountValElem = document.getElementById('couponDiscountVal');

  if (appliedCoupon && appliedCoupon.discount > 0) {
    discountVal = appliedCoupon.discount;
    if (discountRow) discountRow.style.display = 'block';
    if (discountValElem) discountValElem.textContent = discountVal.toLocaleString();
  } else {
    if (discountRow) discountRow.style.display = 'none';
  }

  var grandTotal = Math.max(0, subTotal + charge - discountVal);
  var grandElem = document.getElementById('checkoutGrandTotal');
  if (grandElem) grandElem.textContent = `৳ ${grandTotal.toLocaleString()}`;
};

window.goToCheckout = function() {
  appliedCoupon = null;
  var couponInput = document.getElementById('checkoutCouponInput');
  var couponMsg = document.getElementById('couponStatusMsg');
  if (couponInput) couponInput.value = '';
  if (couponMsg) couponMsg.textContent = '';

  closeCart();
  if (cart.length === 0) {
    alert('কার্টে কোনো পণ্য নেই!');
    return;
  }

  document.getElementById('insideRateLabel').textContent = appSettings.freeInside || appSettings.freeAllBd ? 'ফ্রি' : `৳${appSettings.insideDhaka || 60}`;
  document.getElementById('outsideRateLabel').textContent = appSettings.freeAllBd ? 'ফ্রি' : `৳${appSettings.outsideDhaka || 120}`;

  var summaryHtml = '<ul style="list-style:none; padding:0; margin-bottom:8px;">';
  cart.forEach(item => {
    summaryHtml += `<li style="display:flex; justify-content:space-between; margin-bottom:4px;">
      <span>${item.name} (×${item.quantity})</span>
      <b>৳ ${(item.price * item.quantity).toLocaleString()}</b>
    </li>`;
  });
  summaryHtml += '</ul>';
  orderSummaryBox.innerHTML = summaryHtml;

  updateCheckoutTotal();
  checkoutModal.classList.add('active');
};

window.closeCheckout = function() {
  checkoutModal.classList.remove('active');
};

// মোবাইল নম্বরে শুরুতে ০ চাপলে তা অটো রিমুভ করার ফাংশন
window.handlePhoneInput = function(input) {
  var val = input.value.replace(/\D/g, '');
  if (val.startsWith('0')) {
    val = val.substring(1);
  }
  if (val.length > 10) {
    val = val.substring(0, 10);
  }
  input.value = val;
};

// ইনভয়েস মেমো প্রদর্শন
function showOrderInvoice(orderData) {
  currentInvoiceData = orderData;

  document.getElementById('invOrderNo').textContent = '#' + orderData.orderNo;
  document.getElementById('invDate').textContent = new Date().toLocaleDateString('en-GB');
  document.getElementById('invCustName').textContent = orderData.customerName;
  document.getElementById('invCustPhone').textContent = orderData.customerPhone;
  document.getElementById('invCustAddress').textContent = orderData.customerAddress;

  var tbody = document.getElementById('invItemsBody');
  tbody.innerHTML = '';
  orderData.items.forEach(item => {
    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#000 !important; padding:8px; border-bottom:1px solid #ddd; font-size:12px;">${item.name}</td>
      <td style="color:#000 !important; text-align:center; padding:8px; border-bottom:1px solid #ddd; font-size:12px;">${item.quantity}</td>
      <td style="color:#000 !important; text-align:right; padding:8px; border-bottom:1px solid #ddd; font-size:12px;">Tk ${(item.price * item.quantity).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('invSubTotal').textContent = `Tk ${orderData.subTotal.toLocaleString()}`;
  document.getElementById('invDeliveryCharge').textContent = orderData.deliveryCharge === 0 ? 'Free' : `Tk ${orderData.deliveryCharge}`;

  var discRow = document.getElementById('invDiscountRow');
  if (orderData.discountAmount && orderData.discountAmount > 0) {
    discRow.style.display = 'flex';
    document.getElementById('invDiscount').textContent = `-Tk ${orderData.discountAmount.toLocaleString()}`;
  } else {
    discRow.style.display = 'none';
  }

  document.getElementById('invGrandTotal').textContent = `Tk ${orderData.grandTotal.toLocaleString()}`;

  var invModal = document.getElementById('invoiceModal');
  if (invModal) {
    invModal.classList.add('active');
  }
}

window.closeInvoiceModal = function() {
  var invModal = document.getElementById('invoiceModal');
  if (invModal) {
    invModal.classList.remove('active');
  }
};

// PDF ডাউনলোড ফাংশন
window.downloadInvoicePDF = function() {
  var element = document.getElementById('invoicePrintArea');
  if (!element || !currentInvoiceData) return;

  var opt = {
    margin:       [10, 10, 10, 10],
    filename:     `Invoice_${currentInvoiceData.orderNo}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#ffffff',
      scrollY: 0
    },
    jsPDF:        { unit: 'mm', format: 'a5', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
};

// অর্ডার সাবমিট (ফায়ারবেস ডাটাবেসে সেভ ও ইনভয়েস ওপেন)
window.handleOrderSubmit = async function(e) {
  e.preventDefault();
  if (!db && window.db) db = window.db;

  var name = document.getElementById('custName').value.trim();
  var rawPhone = document.getElementById('custPhone').value.trim();

  // নম্বর ভ্যালিডেশন
  var cleanNumber = rawPhone.replace(/\D/g, '');
  if (cleanNumber.startsWith('880')) {
    cleanNumber = cleanNumber.substring(3);
  } else if (cleanNumber.startsWith('0')) {
    cleanNumber = cleanNumber.substring(1);
  }

  if (cleanNumber.length !== 10) {
    alert('দয়া করে সঠিক মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX বা 17XXXXXXXX)');
    return;
  }

  var phone = '+880' + cleanNumber;
  var address = document.getElementById('custAddress').value.trim();
  
  var area = document.querySelector('input[name="deliveryArea"]:checked').value;
  var charge = 0;
  if (!appSettings.freeAllBd) {
    charge = (area === 'inside') ? (appSettings.freeInside ? 0 : (appSettings.insideDhaka || 60)) : (appSettings.outsideDhaka || 120);
  }

  var subTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  var discountVal = (appliedCoupon && appliedCoupon.discount) ? appliedCoupon.discount : 0;
  var grandTotal = Math.max(0, subTotal + charge - discountVal);

  var orderNo = "GB-" + Math.floor(100000 + Math.random() * 900000);

  var orderData = {
    orderNo: orderNo,
    customerName: name,
    customerPhone: phone,
    customerAddress: address,
    deliveryArea: area === 'inside' ? 'ঢাকার ভিতরে' : 'ঢাকার বাইরে',
    deliveryCharge: charge,
    couponApplied: appliedCoupon ? appliedCoupon.code : null,
    discountAmount: discountVal,
    items: [...cart],
    subTotal: subTotal,
    grandTotal: grandTotal,
    status: 'নতুন অর্ডার',
    createdAt: new Date().toISOString()
  };

  try {
    if (db) {
      await db.collection("orders").add(orderData);
    } else {
      var localOrders = JSON.parse(localStorage.getItem('gib_orders')) || [];
      localOrders.unshift(orderData);
      localStorage.setItem('gib_orders', JSON.stringify(localOrders));
    }

    // টেলিগ্রাম অ্যালার্ট
    if (appSettings.tgBotToken && appSettings.tgChatId) {
      var itemsList = cart.map(i => `• ${i.name} (x${i.quantity}) - ৳${i.price * i.quantity}`).join('\n');
      var couponText = appliedCoupon ? `\n🏷️ *কুপন কোড:* ${appliedCoupon.code} (-৳${discountVal})` : '';
      var msg = `🛍️ *নতুন অর্ডার এসেছে!*\n\n*অর্ডার আইডি:* #${orderNo}\n*কাস্টমার:* ${name}\n*ফোন:* ${phone}\n*ঠিকানা:* ${address}\n*এরিয়া:* ${orderData.deliveryArea}\n\n*পণ্যসমূহ:*\n${itemsList}\n\n📦 *ডেলিভারি চার্জ:* ৳${charge}${couponText}\n💰 *সর্বমোট বিল:* ৳${grandTotal.toLocaleString()}\n*স্ট্যাটাস:* নতুন অর্ডার`;

      fetch(`https://api.telegram.org/bot${appSettings.tgBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: appSettings.tgChatId, text: msg, parse_mode: 'Markdown' })
      }).catch(err => console.error("Telegram Error:", err));
    }

    // কার্ট খালি ও চেকআউট বন্ধ করা
    cart = [];
    appliedCoupon = null;
    localStorage.setItem('gib_cart', JSON.stringify(cart));
    updateCartUI();
    closeCheckout();

    // সরাসরি কাস্টমারকে ইনভয়েস মেমো দেখানো
    showOrderInvoice(orderData);

  } catch (err) {
    alert('অর্ডার সাবমিট করতে সমস্যা হয়েছে: ' + err.message);
  }
};

function updateFooterSocialLinks() {
  function formatUrl(url) {
    if (!url) return '#';
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) return 'https://' + url;
    return url;
  }

  var fbBtn = document.getElementById('footerFb');
  var instaBtn = document.getElementById('footerInsta');
  var ytBtn = document.getElementById('footerYt');

  if (fbBtn && appSettings.facebook) fbBtn.href = formatUrl(appSettings.facebook);
  if (instaBtn && appSettings.instagram) instaBtn.href = formatUrl(appSettings.instagram);
  if (ytBtn && appSettings.youtube) ytBtn.href = formatUrl(appSettings.youtube);

  if (appSettings.whatsapp) {
    var cleanNumber = appSettings.whatsapp.replace(/[^0-9]/g, '');
    var waUrl = `https://wa.me/${cleanNumber}`;

    var floatWa = document.getElementById('floatingWhatsappBtn');
    if (floatWa) floatWa.href = waUrl;

    var waElem = document.getElementById('footerWhatsappText');
    if (waElem) waElem.innerHTML = `<a href="${waUrl}" target="_blank" style="color:#25d366; text-decoration:none;">+${appSettings.whatsapp}</a>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  listenToLiveProducts();
  listenToLiveSettings();
  updateCartUI();
  updateWishlistUI();
});