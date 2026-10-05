// TaskFlow - Modern To-Do Application Logic
(() => {
  const STORAGE_KEY = "todo-tasks";
  const THEME_KEY = "todo-theme";

  // State
  let tasks = loadTasks();
  let currentFilter = "all"; // 'all' | 'active' | 'completed'
  let searchQuery = "";
  let editingTaskId = null;
  let lastDeletedTask = null;
  let toastTimeout = null;

  // DOM Elements
  const inputEl = document.getElementById("input");
  const addBtn = document.getElementById("addBtn");
  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  const clearBtn = document.getElementById("clearBtn");
  const themeToggle = document.getElementById("themeToggle");
  const currentDateEl = document.getElementById("current-date");
  const progressBar = document.getElementById("progressBar");
  const progressPercent = document.getElementById("progressPercent");
  const completedRatio = document.getElementById("completedRatio");
  const streakBadge = document.getElementById("streakBadge");
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const toastContainer = document.getElementById("toastContainer");
  const filterTabs = document.querySelectorAll(".filter-tab");
  const badgeAll = document.getElementById("badgeAll");
  const badgeActive = document.getElementById("badgeActive");
  const badgeCompleted = document.getElementById("badgeCompleted");
  const confettiCanvas = document.getElementById("confettiCanvas");

  // =========================================================================
  // Theme Management
  // =========================================================================
  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }

  // =========================================================================
  // Storage & Helpers
  // =========================================================================
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(t => ({
        id: t.id || Date.now(),
        text: t.text || "",
        done: Boolean(t.done),
        priority: t.priority || "medium",
        createdAt: t.createdAt || t.id || Date.now()
      }));
    } catch (e) {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error("Failed to save tasks", e);
    }
  }

  function updateDateDisplay() {
    if (!currentDateEl) return;
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    currentDateEl.textContent = `${now.toLocaleDateString(undefined, options)} • Stay organized & productive`;
  }

  function getSelectedPriority() {
    const checked = document.querySelector('input[name="priority"]:checked');
    return checked ? checked.value : "medium";
  }

  function formatRelativeDate(timestamp) {
    if (!timestamp) return "";
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // =========================================================================
  // Core Task Operations
  // =========================================================================
  function addTask() {
    const text = inputEl.value.trim();
    if (!text) {
      inputEl.focus();
      showToast("Please enter a task description!");
      return;
    }

    const priority = getSelectedPriority();
    const newTask = {
      id: Date.now(),
      text,
      done: false,
      priority,
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    inputEl.value = "";
    saveTasks();
    render();
    showToast("Task added successfully ✨");
  }

  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.done = !task.done;
    saveTasks();
    render();

    if (task.done) {
      const allDone = tasks.length > 0 && tasks.every(t => t.done);
      if (allDone) {
        triggerConfetti();
        showToast("Incredible! All tasks completed! 🎉");
      }
    }
  }

  function removeTask(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;

    lastDeletedTask = { task: tasks[index], index };
    tasks.splice(index, 1);
    
    if (editingTaskId === id) {
      editingTaskId = null;
    }

    saveTasks();
    render();
    showToast("Task deleted", true);
  }

  function undoDelete() {
    if (!lastDeletedTask) return;
    tasks.splice(lastDeletedTask.index, 0, lastDeletedTask.task);
    lastDeletedTask = null;
    saveTasks();
    render();
    showToast("Task restored! ↩️");
  }

  function startEditing(id) {
    editingTaskId = id;
    render();
    // Focus the edit input
    setTimeout(() => {
      const editInput = document.getElementById(`edit-input-${id}`);
      if (editInput) {
        editInput.focus();
        editInput.select();
      }
    }, 50);
  }

  function saveEdit(id, newText, newPriority) {
    const cleanText = newText.trim();
    if (!cleanText) {
      showToast("Task text cannot be empty");
      return;
    }

    const task = tasks.find(t => t.id === id);
    if (task) {
      task.text = cleanText;
      if (newPriority) task.priority = newPriority;
    }

    editingTaskId = null;
    saveTasks();
    render();
    showToast("Task updated ✏️");
  }

  function cancelEdit() {
    editingTaskId = null;
    render();
  }

  function clearCompleted() {
    const completedCount = tasks.filter(t => t.done).length;
    if (completedCount === 0) {
      showToast("No completed tasks to clear");
      return;
    }

    tasks = tasks.filter(t => !t.done);
    saveTasks();
    render();
    showToast(`Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}`);
  }

  // =========================================================================
  // Toast Notifications
  // =========================================================================
  function showToast(message, allowUndo = false) {
    if (!toastContainer) return;
    toastContainer.innerHTML = "";
    if (toastTimeout) clearTimeout(toastTimeout);

    const toast = document.createElement("div");
    toast.className = "toast";

    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (allowUndo && lastDeletedTask) {
      const undoBtn = document.createElement("button");
      undoBtn.className = "toast-undo-btn";
      undoBtn.textContent = "Undo";
      undoBtn.onclick = () => {
        undoDelete();
        toast.remove();
      };
      toast.appendChild(undoBtn);
    }

    toastContainer.appendChild(toast);

    toastTimeout = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // =========================================================================
  // Confetti Particle System (Pure Vanilla Canvas)
  // =========================================================================
  function triggerConfetti() {
    if (!confettiCanvas) return;
    const ctx = confettiCanvas.getContext("2d");
    const width = (confettiCanvas.width = window.innerWidth);
    const height = (confettiCanvas.height = window.innerHeight);

    const colors = ["#6366f1", "#a855f7", "#10b981", "#fbbf24", "#f43f5e", "#38bdf8"];
    const particles = [];
    const count = 75;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: width / 2,
        y: height / 2 + 50,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.8) * 15,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 8,
        alpha: 1
      });
    }

    let animationId;
    function renderConfetti() {
      ctx.clearRect(0, 0, width, height);
      let alive = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.rotation += p.rSpeed;
        p.alpha -= 0.012;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
        }
      });

      if (alive) {
        animationId = requestAnimationFrame(renderConfetti);
      } else {
        cancelAnimationFrame(animationId);
        ctx.clearRect(0, 0, width, height);
      }
    }

    renderConfetti();
  }

  // =========================================================================
  // Rendering UI
  // =========================================================================
  function render() {
    // 1. Calculate counts
    const totalCount = tasks.length;
    const completedCount = tasks.filter(t => t.done).length;
    const activeCount = totalCount - completedCount;

    // Badges in filter tabs
    if (badgeAll) badgeAll.textContent = totalCount;
    if (badgeActive) badgeActive.textContent = activeCount;
    if (badgeCompleted) badgeCompleted.textContent = completedCount;

    // Footer task counter
    if (countEl) {
      countEl.textContent = `${activeCount} ${activeCount === 1 ? "task" : "tasks"} left`;
    }

    // Clear completed button state
    if (clearBtn) {
      clearBtn.style.opacity = completedCount > 0 ? "1" : "0.4";
      clearBtn.style.pointerEvents = completedCount > 0 ? "auto" : "none";
    }

    // 2. Progress Bar & Motivation
    const pct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPercent) progressPercent.textContent = `${pct}%`;
    if (completedRatio) completedRatio.textContent = `${completedCount} of ${totalCount} tasks completed`;

    if (streakBadge) {
      if (totalCount === 0) {
        streakBadge.textContent = "🌱 Start your day";
        streakBadge.style.color = "var(--text-muted)";
      } else if (pct === 100) {
        streakBadge.textContent = "🎉 All caught up!";
        streakBadge.style.color = "var(--success)";
      } else if (pct >= 50) {
        streakBadge.textContent = "🚀 Over halfway there!";
        streakBadge.style.color = "var(--primary)";
      } else {
        streakBadge.textContent = "⚡ Keep going!";
        streakBadge.style.color = "var(--warning)";
      }
    }

    // 3. Filter & Search logic
    let filteredTasks = tasks.filter(t => {
      // Filter tab
      if (currentFilter === "active" && t.done) return false;
      if (currentFilter === "completed" && !t.done) return false;

      // Search query
      if (searchQuery) {
        return t.text.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });

    // 4. Populate Task List
    listEl.innerHTML = "";

    if (filteredTasks.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "empty-state";

      let emptyTitle = "No tasks yet";
      let emptyDesc = "Add a task using the input above to get organized and stay on track!";
      let emptyIconSvg = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      `;

      if (searchQuery) {
        emptyTitle = "No matching tasks";
        emptyDesc = `No tasks matched "${searchQuery}". Try a different keyword or clear search.`;
        emptyIconSvg = `
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        `;
      } else if (currentFilter === "active" && totalCount > 0) {
        emptyTitle = "Zero active tasks!";
        emptyDesc = "You have completed all active items. Fantastic productivity!";
      } else if (currentFilter === "completed" && totalCount > 0) {
        emptyTitle = "No completed tasks";
        emptyDesc = "Finish some tasks and check them off to see them here.";
      }

      emptyDiv.innerHTML = `
        <div class="empty-icon">${emptyIconSvg}</div>
        <div class="empty-title">${emptyTitle}</div>
        <div class="empty-desc">${emptyDesc}</div>
      `;
      listEl.appendChild(emptyDiv);
      return;
    }

    filteredTasks.forEach(task => {
      const isEditing = editingTaskId === task.id;
      const li = document.createElement("li");
      li.className = `task-item ${task.done ? "done" : ""} ${isEditing ? "editing" : ""}`;
      li.dataset.id = task.id;

      if (isEditing) {
        // Render Inline Edit Mode
        const editForm = document.createElement("div");
        editForm.className = "edit-form";

        const inputWrap = document.createElement("div");
        inputWrap.className = "edit-input-wrapper";
        const editInput = document.createElement("input");
        editInput.type = "text";
        editInput.className = "edit-input";
        editInput.id = `edit-input-${task.id}`;
        editInput.value = task.text;
        editInput.maxLength = 140;
        inputWrap.appendChild(editInput);

        const controls = document.createElement("div");
        controls.className = "edit-controls";

        // Priority chooser inside edit mode
        const prioDiv = document.createElement("div");
        prioDiv.className = "priority-selector";
        ["low", "medium", "high"].forEach(p => {
          const lbl = document.createElement("label");
          lbl.className = `priority-label priority-${p}`;
          const rdo = document.createElement("input");
          rdo.type = "radio";
          rdo.name = `edit-prio-${task.id}`;
          rdo.value = p;
          if (task.priority === p) rdo.checked = true;
          const sp = document.createElement("span");
          sp.textContent = p.charAt(0).toUpperCase() + p.slice(1);
          lbl.append(rdo, sp);
          prioDiv.appendChild(lbl);
        });

        const btnGroup = document.createElement("div");
        btnGroup.className = "edit-buttons";

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "btn btn-save";
        saveBtn.textContent = "Save";
        saveBtn.onclick = () => {
          const checked = prioDiv.querySelector(`input[name="edit-prio-${task.id}"]:checked`);
          const newPrio = checked ? checked.value : task.priority;
          saveEdit(task.id, editInput.value, newPrio);
        };

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn btn-cancel";
        cancelBtn.textContent = "Cancel";
        cancelBtn.onclick = () => cancelEdit();

        btnGroup.append(cancelBtn, saveBtn);
        controls.append(prioDiv, btnGroup);
        editForm.append(inputWrap, controls);
        li.appendChild(editForm);

        // Edit input keyboard handlers
        editInput.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            const checked = prioDiv.querySelector(`input[name="edit-prio-${task.id}"]:checked`);
            const newPrio = checked ? checked.value : task.priority;
            saveEdit(task.id, editInput.value, newPrio);
          } else if (e.key === "Escape") {
            cancelEdit();
          }
        });
      } else {
        // Standard Task Row
        // 1. Custom Checkbox
        const checkBtn = document.createElement("button");
        checkBtn.className = "checkbox-btn";
        checkBtn.setAttribute("aria-label", task.done ? "Mark as uncompleted" : "Mark as completed");
        checkBtn.title = task.done ? "Mark as uncompleted" : "Mark as completed";
        checkBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
        checkBtn.onclick = () => toggleTask(task.id);

        // 2. Task Text & Meta
        const contentDiv = document.createElement("div");
        contentDiv.className = "task-content";

        const textSpan = document.createElement("span");
        textSpan.className = "task-text";
        textSpan.textContent = task.text;
        textSpan.title = "Double-click to edit";
        textSpan.ondblclick = () => startEditing(task.id);

        const metaDiv = document.createElement("div");
        metaDiv.className = "task-meta";

        const prioTag = document.createElement("span");
        prioTag.className = `priority-tag ${task.priority || "medium"}`;
        prioTag.textContent = task.priority || "medium";

        const dateTag = document.createElement("span");
        dateTag.className = "task-date";
        dateTag.textContent = formatRelativeDate(task.createdAt);

        metaDiv.append(prioTag, dateTag);
        contentDiv.append(textSpan, metaDiv);

        // 3. Action Buttons: Edit & Delete
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "task-actions";

        // EDIT BUTTON (Requested specifically by user)
        const editBtn = document.createElement("button");
        editBtn.className = "action-btn edit-btn";
        editBtn.title = "Edit task";
        editBtn.setAttribute("aria-label", "Edit task");
        editBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        `;
        editBtn.onclick = () => startEditing(task.id);

        // DELETE BUTTON
        const delBtn = document.createElement("button");
        delBtn.className = "action-btn del-btn";
        delBtn.title = "Delete task";
        delBtn.setAttribute("aria-label", "Delete task");
        delBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        `;
        delBtn.onclick = () => removeTask(task.id);

        actionsDiv.append(editBtn, delBtn);
        li.append(checkBtn, contentDiv, actionsDiv);
      }

      listEl.appendChild(li);
    });
  }

  // =========================================================================
  // Event Listeners
  // =========================================================================
  addBtn.addEventListener("click", addTask);
  
  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  });

  clearBtn.addEventListener("click", clearCompleted);

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  // Filter tabs
  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      filterTabs.forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      currentFilter = tab.dataset.filter;
      render();
    });
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      searchQuery = e.target.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.style.display = searchQuery ? "inline-block" : "none";
      }
      render();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      clearSearchBtn.style.display = "none";
      render();
    });
  }

  // Window resize confetti canvas adjustment
  window.addEventListener("resize", () => {
    if (confettiCanvas) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
  });

  // =========================================================================
  // Initialization
  // =========================================================================
  initTheme();
  updateDateDisplay();

  // If initial list is completely empty, populate 2 friendly starter tasks to showcase the app
  if (tasks.length === 0) {
    tasks = [
      { id: Date.now() - 3600000, text: "Try editing this task by clicking the pencil icon ✏️", done: false, priority: "high", createdAt: Date.now() - 3600000 },
      { id: Date.now() - 1800000, text: "Check this task off to see the progress bar update! 🚀", done: false, priority: "medium", createdAt: Date.now() - 1800000 }
    ];
    saveTasks();
  }

  render();
})();
