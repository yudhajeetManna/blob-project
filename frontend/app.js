function loadFiles() {
    fetch("/files")
        .then(r => {
            if (r.status === 401) {
                window.location.href = "/login.html";
                return null;
            }
            return r.json();
        })
        .then(files => {
            if (!files) return;
            const container = document.getElementById("files");
            container.innerHTML = "";

            if (files.length === 0) {
                container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 2rem;">
                    <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>No files uploaded yet</p>
                </div>`;
                return;
            }

            files.forEach(f => {
                const icon = getFileIcon(f);
                container.innerHTML += `
                <div class="file-card" onclick="previewFile('${f}')">
                    <div class="file-icon"><i class="${icon}"></i></div>
                    <div class="file-name" title="${f}">${f}</div>
                    <div class="file-meta">Just now</div>
                    <div class="file-actions">
                        <a href="/download/${f}" class="btn-action" title="Download" onclick="event.stopPropagation()">
                            <i class="fa-solid fa-download"></i>
                        </a>
                        <button onclick="del('${f}', event)" class="btn-action btn-delete" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>`;
            });
        });
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
        case 'pdf': return 'fa-solid fa-file-pdf';
        case 'doc':
        case 'docx': return 'fa-solid fa-file-word';
        case 'txt': return 'fa-solid fa-file-lines';
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif': return 'fa-solid fa-file-image';
        case 'mp4':
        case 'webm': return 'fa-solid fa-file-video';
        case 'mp3':
        case 'wav': return 'fa-solid fa-file-audio';
        case 'zip': return 'fa-solid fa-file-zipper';
        default: return 'fa-solid fa-file';
    }
}

function handleFileSelect() {
    upload();
}

function upload() {
    const fileInput = document.getElementById("file");
    if (fileInput.files.length === 0) return;

    const data = new FormData();
    data.append("file", fileInput.files[0]);

    // Show loading state could be added here

    fetch("/upload", { method: "POST", body: data })
        .then(r => {
            if (r.ok) {
                // alert("File uploaded"); // Removed alert for smoother UX
                loadFiles();
                fileInput.value = "";
            } else {
                alert("Upload failed");
            }
        });
}

function del(name, event) {
    if (event) event.stopPropagation();
    if (!confirm("Delete " + name + "?")) return;
    fetch("/delete/" + name, { method: "DELETE" })
        .then(loadFiles);
}

function logout() {
    fetch("/logout", { method: "POST" })
        .then(() => window.location.href = "/login.html");
}

function previewFile(name) {
    const ext = name.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(ext);
    const isPdf = ext === 'pdf';

    if (!isImage && !isPdf) return; // Only preview images and PDFs

    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center;
        z-index: 1000; cursor: pointer;
    `;

    let content;
    if (isImage) {
        content = `<img src="/preview/${name}" style="max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">`;
    } else {
        content = `<iframe src="/preview/${name}" style="width: 80%; height: 90%; background: white; border-radius: 8px;"></iframe>`;
    }

    modal.innerHTML = content;
    modal.onclick = () => document.body.removeChild(modal);
    document.body.appendChild(modal);
}

function toggleChat() {
    const chatWindow = document.getElementById("chat-window");
    if (chatWindow.style.display === "none") {
        chatWindow.style.display = "flex";
        document.getElementById("chat-input").focus();
    } else {
        chatWindow.style.display = "none";
    }
}

function sendMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    div.id = id;

    const isUser = sender === "user";
    div.style.cssText = `
        align-self: ${isUser ? 'flex-end' : 'flex-start'};
        background: ${isUser ? 'var(--primary)' : 'white'};
        color: ${isUser ? 'white' : 'var(--text-main)'};
        padding: 0.75rem;
        border-radius: ${isUser ? '12px 12px 0 12px' : '12px 12px 12px 0'};
        border: ${isUser ? 'none' : '1px solid var(--border)'};
        max-width: 80%;
        word-wrap: break-word;
    `;
    div.innerText = text;

    if (isTyping) {
        div.style.fontStyle = "italic";
        div.style.color = "var(--text-muted)";
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

loadFiles();
