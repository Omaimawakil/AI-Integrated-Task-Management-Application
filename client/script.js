// Opening the page from your computer uses your local server; the deployed site uses Render.
const BASE = (location.protocol === "file:" || location.hostname === "localhost")
    ? "http://localhost:5000"
    : "https://task-management-app-ayny.onrender.com";
const API = `${BASE}/tasks`;

// Accepts name@domain.tld. The server checks this again, so it can't be bypassed.
// Show the login card when logged out, and the full app when logged in.
function updateAuthUI() {
  document.body.classList.toggle("logged-in", !!localStorage.getItem("token"));
}

function isValidEmail(email) {
  return /^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email) && email.length <= 254;
}
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");

registerBtn.addEventListener("click", registerUser);
loginBtn.addEventListener("click", loginUser);

async function registerUser() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!isValidEmail(email)) {
    alert("Please enter a valid email address, e.g. name@example.com");
    return;
  }
  if (!name || !password) {
    alert("Please fill in your name and password");
    return;
  }

  const res=await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      email,
      password
    })
  });
  if(!res.ok){
    const err = await res.json().catch(() => ({}));
    alert(err.message || "Registration failed");
    return;
  }
  document.getElementById("name").value = "";
document.getElementById("email").value = "";
document.getElementById("password").value = "";

  alert("Registration Successful");
  
  return;
}

async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!isValidEmail(email)) {
    alert("Please enter a valid email address, e.g. name@example.com");
    return;
  }

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password
    })
  });
   if(!res.ok){
    alert("Login failed. Check email and Password");
    return;
   }
  const data = await res.json();
  
  if(!data.token){
    alert("Token not recieved from server");
    return;
  }

  localStorage.setItem("token", data.token);
  updateAuthUI();
  document.getElementById("email").value = "";
document.getElementById("password").value = "";

  alert("Login Successful");
  loadTasks();
}

async function loadTasks() {

    const token = localStorage.getItem("token");
    if(!token){
        return;
    }

const response = await fetch(API, {
    headers: {
        Authorization:`Bearer ${token}`
    }
});
if(!response.ok){
    console.error("Failed to load tasks");
    return;
}
    const tasks = await response.json();

   const list = document.getElementById("tasks");

    if (!tasks.length) {
        list.innerHTML = '<p class="empty">No tasks yet. Add your first one on the left.</p>';
        return;
    }

    list.innerHTML = tasks.map(task => {
        const done = task.status === "Completed";
        return `
    <div class="task ${done ? "done" : ""}">
        <div class="task-top">
            <h3>${escapeHtml(task.title)}</h3>
            <span class="badge ${done ? "badge-done" : "badge-pending"}">${escapeHtml(task.status)}</span>
        </div>
        ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
        <div class="task-actions">
            ${done ? "" : `<button class="btn-complete" onclick="completeTask('${task._id}')">&#10003; Complete</button>`}
            <button class="btn-soft" onclick="editTask('${task._id}')">Edit</button>
            <button class="btn-delete" onclick="deleteTask('${task._id}')">Delete</button>
            <button class="ai-btn" onclick="breakDownTask('${task._id}', this)">&#10024; AI Break Down</button>
        </div>
    </div>`;
    }).join("");
}

async function addTask() {

    const title =
        document.getElementById("title").value;

    const description =
        document.getElementById("description").value;

    const token = localStorage.getItem("token");
    if(!token){
        alert("Please log in first");
        return;
    }

    const  res =await fetch(API,{
        method:"POST",
        headers:{
    "Content-Type":"application/json",
    Authorization:`Bearer ${token}`
    },
        body:JSON.stringify({
            title,
            description
        })
    });
    if(!res.ok){
      alert("Failed to add task");
      return;
    }
    document.getElementById("title").value = "";
document.getElementById("description").value = "";

    loadTasks();
}
async function editTask(id){

    const newTitle =
    prompt("Enter new task title");

    if(!newTitle) return;

    const token = localStorage.getItem("token");
    if(!token){
        alert("Please log in first");
        return;
    }


    await fetch(`${API}/${id}`,{
        method:"PUT",
        headers:{
            "Content-Type":"application/json",
           Authorization:`Bearer ${token}`
        },
        body:JSON.stringify({
            title:newTitle
        })
    });

    loadTasks();
}

async function deleteTask(id){
    const token = localStorage.getItem("token");
    if(!token){
        alert("Please log in first");
        return;
    }

    await fetch(`${API}/${id}`,{
        method:"DELETE",
    headers:{
     Authorization:`Bearer ${token}`
    },
    });

    loadTasks();
}

async function completeTask(id){
    const token = localStorage.getItem("token");
    if(!token){
        alert("Please log in first");
        return;
    }

    await fetch(`${API}/${id}`,{
        method:"PUT",
        headers:{
            "Content-Type":"application/json",
            Authorization:`Bearer ${token}`
        },
        body:JSON.stringify({
            status:"Completed"
        })
    });

    loadTasks();
}
function logout() {
    localStorage.removeItem("token");
    location.reload();
}
/* ---------------- AI features ---------------- */

const AI_API = API.replace(/\/tasks$/, "/ai");
let suggestions = [];
let suggestionsHeading = "";

// Task text is rendered with innerHTML, so always escape it.
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

async function aiCall(path, method = "GET", body) {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please log in first");
        return null;
    }
    try {
        const res = await fetch(`${AI_API}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(data.message || "AI request failed");
            return null;
        }
        return data;
    } catch (err) {
        alert("Could not reach the server. Please try again.");
        return null;
    }
}

// Disables a button and shows "Thinking..." while the AI works.
async function withBusy(btn, fn) {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Thinking...";
    try {
        await fn();
    } finally {
        btn.disabled = false;
        btn.textContent = label;
    }
}

function showOutput(text) {
    const box = document.getElementById("aiOutput");
    box.textContent = text;
    box.style.display = "block";
}

function renderSuggestions() {
    const box = document.getElementById("ai-suggestions");
    if (!suggestions.length) {
        box.innerHTML = "";
        return;
    }
    box.innerHTML = `
        <div class="suggestions-box">
            <h4>${escapeHtml(suggestionsHeading)}</h4>
            ${suggestions.map((s, i) => `
                <div class="suggestion">
                    <div>
                        <strong>${escapeHtml(s.title)}</strong>
                        <p>${escapeHtml(s.description)}</p>
                    </div>
                    <button data-action="add" data-index="${i}">Add</button>
                </div>
            `).join("")}
            <div class="suggestions-actions">
                <button class="ai-btn" data-action="addAll">Add All</button>
                <button data-action="dismiss">Dismiss</button>
            </div>
        </div>
    `;
}

async function saveSuggestion(s) {
    const token = localStorage.getItem("token");
    const res = await fetch(API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: s.title, description: s.description })
    });
    return res.ok;
}

document.getElementById("ai-suggestions").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "dismiss") {
        suggestions = [];
    } else if (action === "add") {
        const i = Number(btn.dataset.index);
        if (await saveSuggestion(suggestions[i])) {
            suggestions.splice(i, 1);
        } else {
            alert("Failed to add task");
        }
    } else if (action === "addAll") {
        const failed = [];
        for (const s of suggestions) {
            if (!(await saveSuggestion(s))) failed.push(s);
        }
        suggestions = failed;
        if (failed.length) alert("Some tasks could not be added");
    }

    renderSuggestions();
    loadTasks();
});

document.getElementById("aiGenerateBtn").addEventListener("click", (e) => {
    const goal = document.getElementById("aiGoal").value.trim();
    if (!goal) {
        alert("Describe a goal first");
        return;
    }
    withBusy(e.target, async () => {
        const data = await aiCall("/generate", "POST", { prompt: goal });
        if (!data) return;
        suggestions = data.tasks;
        suggestionsHeading = "Suggested tasks";
        renderSuggestions();
    });
});

function breakDownTask(id, btn) {
    withBusy(btn, async () => {
        const data = await aiCall("/breakdown", "POST", { taskId: id });
        if (!data) return;
        suggestions = data.subtasks;
        suggestionsHeading = "Suggested subtasks";
        renderSuggestions();
        document.getElementById("ai-section").scrollIntoView({ behavior: "smooth" });
    });
}

document.getElementById("aiSummaryBtn").addEventListener("click", (e) => {
    withBusy(e.target, async () => {
        const data = await aiCall("/summary");
        if (data) showOutput(data.summary);
    });
});

document.getElementById("aiAskBtn").addEventListener("click", (e) => {
    const question = document.getElementById("aiQuestion").value.trim();
    if (!question) {
        alert("Type a question first");
        return;
    }
    withBusy(e.target, async () => {
        const data = await aiCall("/ask", "POST", { message: question });
        if (data) showOutput(data.answer);
    });
});

// Press Enter in a field to submit it.
function onEnter(id, handler) {
    document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") handler();
    });
}
onEnter("password", loginUser);
onEnter("description", addTask);
onEnter("aiGoal", () => document.getElementById("aiGenerateBtn").click());
onEnter("aiQuestion", () => document.getElementById("aiAskBtn").click());

updateAuthUI();
loadTasks();
