/* =========================================================
   SWARAJ ADMIN
========================================================= */

function setupAdmin() {
    const loginBtn = $("#adminLoginBtn");
    const logoutBtn = $("#adminLogoutBtn");
    const refreshBtn = $("#refreshAdminSongs");

    loginBtn?.addEventListener("click", adminLogin);

    logoutBtn?.addEventListener("click", () => {
        localStorage.removeItem("swaraj_admin_key");
        state.adminKey = "";

        $("#adminLoginPanel")?.classList.remove("hidden");
        $("#adminDashboard")?.classList.add("hidden");

        showToast("Admin logged out", "success");
    });

    refreshBtn?.addEventListener(
        "click",
        loadAdminSongs
    );

    $("#uploadForm")?.addEventListener(
        "submit",
        uploadMP3File
    );

    $("#mp3UrlForm")?.addEventListener(
        "submit",
        addMP3URL
    );

    $("#youtubeForm")?.addEventListener(
        "submit",
        addYouTubeSong
    );

    if (state.adminKey) {
        verifyAdmin();
    }
}

async function verifyAdmin() {
    try {
        const response = await fetch(
            "/api/admin/songs",
            {
                headers: {
                    "x-admin-key": state.adminKey
                }
            }
        );

        if (!response.ok) {
            throw new Error("Invalid admin session");
        }

        $("#adminLoginPanel")?.classList.add("hidden");
        $("#adminDashboard")?.classList.remove("hidden");

        renderAdminSongs(
            (await response.json()).songs || []
        );

    } catch {
        localStorage.removeItem("swaraj_admin_key");
        state.adminKey = "";

        $("#adminLoginPanel")?.classList.remove("hidden");
        $("#adminDashboard")?.classList.add("hidden");
    }
}

async function adminLogin() {
    const input = $("#adminKey");

    const key = input?.value.trim();

    if (!key) {
        showToast(
            "Enter admin key",
            "error"
        );
        return;
    }

    try {
        const response = await fetch(
            "/api/admin/login",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    adminKey: key
                })
            }
        );

        const data =
            await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                "Invalid admin key"
            );
        }

        state.adminKey = key;

        localStorage.setItem(
            "swaraj_admin_key",
            key
        );

        $("#adminLoginPanel")?.classList.add("hidden");
        $("#adminDashboard")?.classList.remove("hidden");

        showToast(
            "Admin login successful",
            "success"
        );

        await loadAdminSongs();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

async function loadAdminSongs() {
    if (!state.adminKey) {
        return;
    }

    const container =
        $("#adminSongList");

    if (container) {
        container.innerHTML =
            "<div>Loading...</div>";
    }

    try {
        const response = await fetch(
            "/api/admin/songs",
            {
                headers: {
                    "x-admin-key":
                        state.adminKey
                }
            }
        );

        const data =
            await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                "Unable to load admin songs"
            );
        }

        renderAdminSongs(
            data.songs || []
        );

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

function renderAdminSongs(songs) {
    const container =
        $("#adminSongList");

    if (!container) return;

    container.innerHTML = "";

    if (!songs.length) {
        container.innerHTML =
            "<p>No songs in database.</p>";
        return;
    }

    songs.forEach(song => {
        const row =
            document.createElement("div");

        row.className =
            "admin-song-row";

        row.innerHTML = `
            <div>
                <strong>
                    ${escapeHtml(
                        song.title
                    )}
                </strong>

                <small>
                    ${escapeHtml(
                        song.artist || "SwarAJ"
                    )}
                    •
                    ${escapeHtml(
                        song.category || "Other"
                    )}
                    •
                    ${escapeHtml(
                        song.source_type
                    )}
                </small>
            </div>

            <button
                type="button"
                class="secondary-btn delete-song-btn"
            >
                Delete
            </button>
        `;

        row.querySelector(
            ".delete-song-btn"
        ).addEventListener(
            "click",
            () => deleteAdminSong(song.id)
        );

        container.appendChild(row);
    });
}

async function uploadMP3File(event) {
    event.preventDefault();

    if (!state.adminKey) {
        showToast(
            "Please login first",
            "error"
        );
        return;
    }

    const form =
        event.currentTarget;

    const button =
        form.querySelector(
            "button[type=submit]"
        );

    const originalText =
        button?.textContent;

    if (button) {
        button.disabled = true;
        button.textContent =
            "Uploading...";
    }

    try {
        const formData =
            new FormData(form);

        const response =
            await fetch(
                "/api/admin/songs/upload",
                {
                    method: "POST",
                    headers: {
                        "x-admin-key":
                            state.adminKey
                    },
                    body: formData
                }
            );

        const data =
            await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                "Upload failed"
            );
        }

        form.reset();

        showToast(
            "MP3 uploaded successfully",
            "success"
        );

        await loadSongs();
        await loadCategories();
        await loadAdminSongs();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                originalText;
        }
    }
}

async function addMP3URL(event) {
    event.preventDefault();

    await submitAdminJSON(
        event.currentTarget,
        "/api/admin/songs/mp3-url",
        "MP3 URL added successfully"
    );
}

async function addYouTubeSong(event) {
    event.preventDefault();

    await submitAdminJSON(
        event.currentTarget,
        "/api/admin/songs/youtube",
        "YouTube song added successfully"
    );
}

async function submitAdminJSON(
    form,
    endpoint,
    successMessage
) {
    if (!state.adminKey) {
        showToast(
            "Please login first",
            "error"
        );
        return;
    }

    const button =
        form.querySelector(
            "button[type=submit]"
        );

    const originalText =
        button?.textContent;

    if (button) {
        button.disabled = true;
        button.textContent =
            "Saving...";
    }

    try {
        const data =
            Object.fromEntries(
                new FormData(form)
            );

        const response =
            await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json",
                    "x-admin-key":
                        state.adminKey
                },
                body: JSON.stringify(
                    data
                )
            });

        const result =
            await response.json();

        if (!response.ok ||
            !result.success) {
            throw new Error(
                result.error ||
                "Request failed"
            );
        }

        form.reset();

        showToast(
            successMessage,
            "success"
        );

        await loadSongs();
        await loadCategories();
        await loadAdminSongs();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                originalText;
        }
    }
}

async function deleteAdminSong(id) {
    if (!state.adminKey) {
        showToast(
            "Please login first",
            "error"
        );
        return;
    }

    if (!confirm(
        "Delete this song permanently?"
    )) {
        return;
    }

    try {
        const response =
            await fetch(
                `/api/admin/songs/${id}`,
                {
                    method: "DELETE",
                    headers: {
                        "x-admin-key":
                            state.adminKey
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok ||
            !data.success) {
            throw new Error(
                data.error ||
                "Delete failed"
            );
        }

        showToast(
            "Song deleted successfully",
            "success"
        );

        await loadSongs();
        await loadCategories();
        await loadAdminSongs();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}