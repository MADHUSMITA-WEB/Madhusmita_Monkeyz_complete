// Relative URL: works on localhost:3000 and on the hosted site,
// because server.js serves both the pages and the API.
// For localhost
const API_BASE_URL = "/api";
/* =========================================================
   HELPERS
   ========================================================= */

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("cart");
    window.location.href = "login.html";
}

/* =========================================================
   GENERIC API REQUEST
   ========================================================= */

async function api(endpoint, method = "GET", data = null) {

    const options = {
        method,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
    };

    if (data !== null && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        options.body = JSON.stringify(data);
    }

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    } catch {
        throw new Error("Cannot reach the server. Please try again later.");
    }

    const text = await response.text();
    let result = {};

    if (text.trim()) {
        try {
            result = JSON.parse(text);
        } catch {
            throw new Error(`Server not available (HTTP ${response.status}). The website's server may not be running.`);
        }
    }

    if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}`);
    }

    return result;
}

/* =========================================================
   LOGIN
   ========================================================= */

function setupLoginForm() {

    const form = document.getElementById("login-form");
    if (!form) return;

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const loginInput =
            document.getElementById("registerId") ||
            document.getElementById("regId") ||
            document.getElementById("username") ||
            document.getElementById("email");

        const passwordInput = document.getElementById("password");

        const username = loginInput ? loginInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

        if (!username || !password) {
            alert("Please enter your username/email and password.");
            return;
        }

        try {

            const response = await api("/login", "POST", { username, password });

            if (!response.success) {
                alert(response.message || "Invalid username/email or password.");
                return;
            }

            localStorage.setItem("user", JSON.stringify(response.user));

            // Bring back the cart saved in the database, or save the
            // cart the user filled before logging in.
            await loadCartFromServer();

            window.location.href = "store.html";

        } catch (error) {
            alert("Login failed: " + error.message);
        }
    });
}

/* =========================================================
   SIGNUP
   ========================================================= */

function setupSignupForm() {

    const form = document.getElementById("signup-form");
    if (!form) return;

    // Ignore a second click/Enter while the first signup is still being sent
    let submitting = false;

    form.addEventListener("submit", async (event) => {

        event.preventDefault();
        if (submitting) return;

        const username = document.getElementById("username")?.value.trim() || "";
        const email = document.getElementById("email")?.value.trim() || "";
        const password = document.getElementById("password")?.value || "";

        if (!username || !email || !password) {
            alert("Please fill in all fields.");
            return;
        }

        submitting = true;

        try {

            const response = await api("/signup", "POST", { username, email, password });

            if (response.success) {
                alert("Signup successful! Please login.");
                window.location.href = "login.html";
                return;
            }

            alert(response.message || "Signup failed.");

        } catch (error) {
            alert("Signup failed: " + error.message);
        } finally {
            submitting = false;
        }
    });
}

/* =========================================================
   STORE
   ========================================================= */

async function loadStore() {

    const container = document.getElementById("store-products");
    if (!container) return;

    container.innerHTML = "<p>Loading products...</p>";

    try {

        const products = await api("/store");

        if (!Array.isArray(products) || products.length === 0) {
            container.innerHTML = "<p>No products found. Add one with the product form or insert rows into the Store table.</p>";
            return;
        }

        container.innerHTML = "";

        products.forEach((p) => {

            const el = document.createElement("div");
            el.className = "product";

            if (p.ImageUrl) {
                const img = document.createElement("img");
                img.src = p.ImageUrl;
                img.alt = p.ProductName;
                img.style.maxWidth = "200px";
                el.appendChild(img);
            }

            const title = document.createElement("h3");
            title.textContent = p.ProductName;
            el.appendChild(title);

            if (p.Size) {
                const size = document.createElement("p");
                size.textContent = `Size: ${p.Size}`;
                el.appendChild(size);
            }

            const price = document.createElement("p");
            price.textContent = `Price: ₹${p.Price}`;
            el.appendChild(price);

            const qty = document.createElement("p");
            qty.textContent = `Quantity: ${p.Quantity}`;
            el.appendChild(qty);

            const addBtn = document.createElement("button");
            addBtn.textContent = "Add to Cart";
            addBtn.addEventListener("click", () => addToCart({
                id: p.ProductId ?? p.StoreId,
                name: p.ProductName,
                price: p.Price,
                image: p.ImageUrl,
                size: p.Size
            }));
            el.appendChild(addBtn);

            container.appendChild(el);
        });

    } catch (error) {

        container.innerHTML = `
            <div class="store-error">
                <p>Unable to load products.</p>
                <p>${escapeHtml(error.message)}</p>
                <button id="retry-store">Retry</button>
            </div>
        `;

        document.getElementById("retry-store")?.addEventListener("click", loadStore);
    }
}

async function saveProduct(product) {
    return api("/store", "POST", product);
}

/* =========================================================
   ADD PRODUCT FORM (saves to the Store table)
   Add this to store.html (or an admin page) to use it:

   <form id="product-form">
       <input id="product-name" placeholder="Product name" required>
       <input id="product-price" type="number" step="0.01" placeholder="Price" required>
       <input id="product-quantity" type="number" placeholder="Stock quantity">
       <input id="product-size" placeholder="Size (S, M, L...)">
       <input id="product-image" placeholder="Image URL">
       <button type="submit">Add Product</button>
   </form>
   ========================================================= */

function setupProductForm() {

    const form = document.getElementById("product-form");
    if (!form) return;

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const user = getCurrentUser();
        const value = (id) => document.getElementById(id)?.value.trim() || "";

        const product = {
            ProductName: value("product-name"),
            Price: value("product-price"),
            Quantity: value("product-quantity") || 0,
            Size: value("product-size") || null,
            ImageUrl: value("product-image") || null,
            UserId: user ? user.id : null
        };

        if (!product.ProductName || product.Price === "") {
            alert("Product name and price are required.");
            return;
        }

        try {
            await saveProduct(product);
            alert("Product saved.");
            form.reset();
            loadStore();
        } catch (error) {
            alert("Could not save product: " + error.message);
        }
    });
}

/* =========================================================
   CART
   The cart is kept in localStorage for fast display AND saved
   to the Cart table (per user) every time it changes, so the
   database always matches what the user sees.
   ========================================================= */

function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem("cart")) || [];
        return Array.isArray(cart) ? cart : [];
    } catch {
        return [];
    }
}

function saveCartLocal(cart) {
    localStorage.setItem("cart", JSON.stringify(cart));
}

// Same product + same size = same cart line
function sameItem(a, b) {
    return a.id === b.id && (a.size || "N/A") === (b.size || "N/A");
}

// Copy the whole local cart to the database (replaces the user's rows)
async function saveCart(cart = getCart()) {

    const user = getCurrentUser();
    if (!user) return false;

    try {

        await api("/cart", "PUT", {
            UserId: user.id,
            items: cart.map((item) => ({
                ProductId: item.id,
                ProductName: item.name,
                Price: item.price,
                Quantity: item.quantity,
                Size: item.size || "N/A",
                ImageUrl: item.image || ""
            }))
        });

        return true;

    } catch (error) {
        console.error("[CART] Could not save cart to database:", error.message);
        return false;
    }
}

// After login: use the database cart if the browser cart is empty,
// otherwise push the browser cart to the database.
async function loadCartFromServer() {

    const user = getCurrentUser();
    if (!user) return;

    try {

        if (getCart().length > 0) {
            await saveCart();
            return;
        }

        const rows = await api(`/cart?userId=${encodeURIComponent(user.id)}`);

        saveCartLocal(rows.map((r) => ({
            id: r.ProductId ?? r.CartId,
            name: r.ProductName,
            price: Number(r.Price),
            image: r.ImageUrl || "",
            size: r.Size || "N/A",
            quantity: r.Quantity
        })));

    } catch (error) {
        console.error("[CART] Could not load cart from database:", error.message);
    }
}

async function addToCart(product) {

    const cart = getCart();
    const existing = cart.find((item) => sameItem(item, product));

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image || "",
            size: product.size || "N/A",
            quantity: 1
        });
    }

    saveCartLocal(cart);

    if (!getCurrentUser()) {
        alert("Product added to cart. Login to save your cart.");
        return;
    }

    const saved = await saveCart(cart);
    alert(saved ? "Product added to cart." : "Added to cart, but it could not be saved to the database (see console).");
}

async function removeFromCart(productId, size) {
    const cart = getCart().filter((item) => !sameItem(item, { id: productId, size }));
    saveCartLocal(cart);
    await saveCart(cart);
}

async function changeQuantity(productId, size, delta) {

    const cart = getCart();
    const line = cart.find((item) => sameItem(item, { id: productId, size }));
    if (!line) return;

    line.quantity += delta;

    if (line.quantity < 1) {
        return removeFromCart(productId, size);
    }

    saveCartLocal(cart);
    await saveCart(cart);
}

/* =========================================================
   CHECKOUT + PAYMENT (Razorpay)
   Needs this in your HTML before main.js:
   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
   ========================================================= */

async function payNow() {

    const user = getCurrentUser();

    if (!user) {
        alert("Please login first.");
        window.location.href = "login.html";
        return;
    }

    const payButton = document.getElementById("pay-btn");
    if (payButton) payButton.disabled = true;

    try {

        // 0. Make sure the database cart matches the browser cart
        if (getCart().length === 0 || !(await saveCart())) {
            alert("Your cart is empty or could not be saved.");
            if (payButton) payButton.disabled = false;
            return;
        }

        // 1. Ask the server to create the order (it calculates the total)
        const orderData = await api("/checkout", "POST", { UserId: user.id });

        if (!orderData.success) {
            alert(orderData.message);
            if (payButton) payButton.disabled = false;
            return;
        }

        if (typeof Razorpay === "undefined") {
            throw new Error("Razorpay script not loaded. Add checkout.js before main.js.");
        }

        // 2. Open Razorpay
        const rzp = new Razorpay({
            key: orderData.key,
            order_id: orderData.orderId,
            amount: orderData.amount,
            currency: orderData.currency,
            name: "Monkeyz",
            prefill: {
                name: user.name || "",
                email: user.email || ""
            },

            // 3. Payment done -> verify on server
            handler: async (paymentResponse) => {

                try {

                    const result = await api("/payment/success", "POST", paymentResponse);

                    if (result.success) {
                        localStorage.removeItem("cart");
                        window.location.href = `success.html?order=${encodeURIComponent(result.orderId)}`;
                        return;
                    }

                    alert(result.message || "Payment could not be verified.");

                } catch (error) {
                    alert("Payment verification failed: " + error.message);
                }

                if (payButton) payButton.disabled = false;
            },

            modal: {
                ondismiss: () => {
                    if (payButton) payButton.disabled = false;
                }
            }
        });

        rzp.on("payment.failed", async (e) => {

            try {
                await api("/payment/failed", "POST", {
                    razorpay_order_id: e.error.metadata.order_id
                });
            } catch (error) {
                console.error("[PAYMENT]", error);
            }

            alert("Payment failed: " + (e.error.description || "Please try again."));

            if (payButton) payButton.disabled = false;
        });

        rzp.open();

    } catch (error) {

        alert("Checkout failed: " + error.message);

        if (payButton) payButton.disabled = false;
    }
}

function setupPayButton() {
    document.getElementById("pay-btn")?.addEventListener("click", payNow);
}

function setupLogoutButton() {
    document.getElementById("logout-btn")?.addEventListener("click", logout);
}

/* =========================================================
   SUCCESS PAGE
   Add <div id="order-details"></div> to success.html
   ========================================================= */

async function loadSuccessPage() {

    const box = document.getElementById("order-details");
    if (!box) return;

    const orderId = new URLSearchParams(window.location.search).get("order");

    if (!orderId) {
        box.textContent = "No order found.";
        return;
    }

    try {

        const { order } = await api(`/orders/${encodeURIComponent(orderId)}`);

        box.innerHTML = `
            <h2>Thank you! Payment ${escapeHtml(order.Status)}.</h2>
            <p>Order #${escapeHtml(order.OrderId)}</p>
            <p>Payment ID: ${escapeHtml(order.PaymentId || "-")}</p>
            <p>Amount: ₹${escapeHtml(order.Amount)}</p>
        `;

    } catch (error) {
        box.textContent = "Could not load order: " + error.message;
    }
}

/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    setupLoginForm();
    setupSignupForm();
    setupProductForm();
    setupPayButton();
    setupLogoutButton();
    loadStore();
    loadSuccessPage();
});
