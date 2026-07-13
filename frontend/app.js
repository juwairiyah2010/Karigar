// Central frontend logic for Kaarigar

const API_BASE = "/api";

// Auth Session Management
function getToken() {
  return localStorage.getItem("kaarigar_token");
}

function getUser() {
  const userStr = localStorage.getItem("kaarigar_user");
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem("kaarigar_token", token);
  localStorage.setItem("kaarigar_user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("kaarigar_token");
  localStorage.removeItem("kaarigar_user");
}

// Global API request wrapper
async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }

  return res.json();
}

// Render dynamic site header
function renderHeader() {
  const headerContainer = document.getElementById("site-header");
  if (!headerContainer) return;

  const user = getUser();
  const isLoggedIn = !!user;

  headerContainer.className = "sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur";
  headerContainer.innerHTML = `
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <a href="/" class="flex items-center gap-2">
        <img src="/assets/logo.png" alt="Kaarigar Logo" class="h-9 w-9 rounded-lg object-cover">
        <span class="font-display text-xl font-semibold tracking-tight text-foreground">Kaarigar</span>
      </a>

      <!-- Desktop Nav -->
      <nav class="hidden items-center gap-8 md:flex">
        <a href="/browse.html" class="text-sm font-medium text-foreground/80 hover:text-primary transition">Browse artisans</a>
        <a href="/how-it-works.html" class="text-sm font-medium text-foreground/80 hover:text-primary transition">How it works</a>
        <a href="/about.html" class="text-sm font-medium text-foreground/80 hover:text-primary transition">About</a>
      </nav>

      <!-- Desktop User Auth Controls -->
      <div class="hidden items-center gap-3 md:flex">
        ${
          isLoggedIn
            ? `
          <div class="relative">
            <button id="bell-btn" class="relative rounded-lg p-2 hover:bg-accent text-foreground/80 hover:text-foreground transition focus:outline-none">
              <i data-lucide="bell" class="h-5 w-5"></i>
              <span id="bell-badge" class="absolute right-1.5 top-1.5 hidden h-2.5 w-2.5 rounded-full bg-red-500 border border-white"></span>
            </button>
            <div id="bell-dropdown" class="absolute right-0 mt-2 hidden w-80 origin-top-right rounded-xl border border-border bg-card p-4 shadow-soft ring-1 ring-black/5 focus:outline-none z-50">
              <div class="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
                <h4 class="text-xs font-semibold text-foreground">Notifications</h4>
                <button id="bell-clear-btn" class="text-[10px] font-semibold text-primary hover:underline">Mark all read</button>
              </div>
              <div id="bell-list" class="max-h-60 overflow-y-auto space-y-2.5 text-xs text-muted-foreground">
                <div class="py-4 text-center">Loading...</div>
              </div>
            </div>
          </div>
          <a href="/dashboard.html" class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent text-foreground transition">
            <i data-lucide="user" class="h-4 w-4"></i> Dashboard
          </a>
          <button id="signout-btn" class="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent text-foreground transition">
            <i data-lucide="log-out" class="h-4 w-4"></i> Sign out
          </button>
        `
            : `
          <a href="/auth.html?mode=login" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent text-foreground transition">Sign in</a>
          <a href="/auth.html?mode=signup" class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90 transition">Join Kaarigar</a>
        `
        }
      </div>

      <!-- Mobile menu button -->
      <button id="mobile-menu-btn" class="md:hidden p-2 text-foreground/80 hover:text-foreground focus:outline-none">
        <i data-lucide="menu" class="h-6 w-6"></i>
      </button>
    </div>

    <!-- Mobile Nav Panel -->
    <div id="mobile-menu-panel" class="hidden border-t border-border bg-background md:hidden">
      <div class="flex flex-col gap-1 px-4 py-4">
        <a href="/browse.html" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent text-foreground">Browse artisans</a>
        <a href="/how-it-works.html" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent text-foreground">How it works</a>
        <a href="/about.html" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent text-foreground">About</a>
        <div class="my-2 h-px bg-border"></div>
        ${
          isLoggedIn
            ? `
          <a href="/dashboard.html" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent text-foreground">Dashboard</a>
          <button id="mobile-signout-btn" class="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Sign out</button>
        `
            : `
          <a href="/auth.html?mode=login" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent text-foreground">Sign in</a>
          <a href="/auth.html?mode=signup" class="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground text-center">Join Kaarigar</a>
        `
        }
      </div>
    </div>
  `;

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenuPanel = document.getElementById("mobile-menu-panel");
  if (mobileMenuBtn && mobileMenuPanel) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileMenuPanel.classList.toggle("hidden");
    });
  }

  // Bind logout buttons
  const signoutBtn = document.getElementById("signout-btn");
  const mobileSignoutBtn = document.getElementById("mobile-signout-btn");
  const performSignout = () => {
    clearSession();
    window.location.href = "/";
  };
  if (signoutBtn) signoutBtn.addEventListener("click", performSignout);
  if (mobileSignoutBtn) mobileSignoutBtn.addEventListener("click", performSignout);

  // Bind notifications logic if logged in
  if (isLoggedIn) {
    const bellBtn = document.getElementById("bell-btn");
    const bellDropdown = document.getElementById("bell-dropdown");
    const bellList = document.getElementById("bell-list");
    const bellBadge = document.getElementById("bell-badge");
    const bellClearBtn = document.getElementById("bell-clear-btn");

    let notifications = [];

    async function fetchNotifications() {
      try {
        notifications = await apiRequest("/notifications");
        renderNotificationsList();
      } catch (err) {
        console.warn("Failed to fetch notifications:", err.message);
      }
    }

    function renderNotificationsList() {
      if (!bellList) return;
      const unread = notifications.filter(n => !n.read);
      if (unread.length > 0) {
        bellBadge.classList.remove("hidden");
      } else {
        bellBadge.classList.add("hidden");
      }

      if (notifications.length === 0) {
        bellList.innerHTML = `<div class="py-4 text-center text-muted-foreground/60">No notifications yet.</div>`;
        return;
      }

      bellList.innerHTML = notifications.map(n => `
        <div class="p-2 rounded-lg border border-transparent hover:bg-accent/40 transition ${!n.read ? 'bg-amber-50/20 border-amber-50/50' : ''}">
          <div class="flex items-start justify-between gap-2">
            <span class="font-semibold text-foreground ${!n.read ? 'text-[#B54F2A]' : ''}">${n.title}</span>
            <span class="text-[9px] text-muted-foreground/60 flex-shrink-0">${new Date(n.created_at).toLocaleDateString()}</span>
          </div>
          <p class="mt-1 text-muted-foreground/95 font-sans leading-relaxed text-[11px]">${n.message}</p>
        </div>
      `).join('');
    }

    if (bellBtn && bellDropdown) {
      bellBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        bellDropdown.classList.toggle("hidden");
        fetchNotifications();
      });
      document.addEventListener("click", () => {
        bellDropdown.classList.add("hidden");
      });
      bellDropdown.addEventListener("click", (e) => e.stopPropagation());
    }

    if (bellClearBtn) {
      bellClearBtn.addEventListener("click", async () => {
        const unread = notifications.filter(n => !n.read);
        if (unread.length === 0) return;
        
        try {
          await Promise.all(unread.map(n => apiRequest(`/notifications/${n._id}/read`, { method: "PATCH" })));
          await fetchNotifications();
        } catch (err) {
          console.warn("Failed to mark notifications as read:", err.message);
        }
      });
    }

    // Initial fetch on load
    fetchNotifications();
  }

  // Initialize Lucide icons inside header
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Render dynamic site footer
function renderFooter() {
  const footerContainer = document.getElementById("site-footer");
  if (!footerContainer) return;

  footerContainer.className = "mt-24 border-t border-border/60 bg-gradient-cream";
  footerContainer.innerHTML = `
    <div class="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
      <div class="md:col-span-2">
        <div class="flex items-center gap-2">
          <img src="/assets/logo.png" alt="Kaarigar Logo" class="h-9 w-9 rounded-lg object-cover">
          <span class="font-display text-xl font-semibold text-foreground">Kaarigar</span>
        </div>
        <p class="mt-4 max-w-md text-sm text-muted-foreground">
          A digital home for India's cobblers, potters, tailors, and artisans. Discover local talent, book services, and buy handmade — directly from the maker.
        </p>
      </div>
      <div>
        <h4 class="font-display text-sm font-semibold uppercase tracking-wider text-foreground/70">Marketplace</h4>
        <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
          <li><a href="/browse.html" class="hover:text-primary">Browse artisans</a></li>
          <li><a href="/how-it-works.html" class="hover:text-primary">How it works</a></li>
          <li><a href="/auth.html?mode=signup" class="hover:text-primary">Join as artisan</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-display text-sm font-semibold uppercase tracking-wider text-foreground/70">Company</h4>
        <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
          <li><a href="/about.html" class="hover:text-primary">About</a></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-border/60">
      <div class="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>© ${new Date().getFullYear()} Kaarigar. Handmade with intention.</span>
        <span>Supporting local craft, one order at a time.</span>
      </div>
    </div>
  `;
}

// Initialise common components
document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
