document.addEventListener('DOMContentLoaded', () => {

    // --- Global Variables & State ---
    let quill;
    let selectedFile = null;
    let currentImageTags = [];
    let currentFanficTags = [];
    const predefinedTags = [
        'Ranma', 'Akane', 'Ryoga', 'Shampoo', 'Ukyo', 'Mousse', 'Genma', 'Soun',
        'Happosai', 'Kodachi', 'P-Chan', 'Anime', 'Manga', 'FanArt', 'Digital', 'Tradicional', 'Comedia', 'Romance'
    ];

    // --- Utility Functions ---
    function showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        notification.textContent = message;
        notification.className = `show ${type}`;
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    function showConfirmationModal(title, message, onConfirm) {
        const modal = document.getElementById('modal-confirm');
        if (!modal) return;

        modal.querySelector('#confirm-title').textContent = title;
        modal.querySelector('#confirm-message').textContent = message;

        const confirmBtn = modal.querySelector('#confirm-btn');
        const cancelBtn = modal.querySelector('#cancel-btn');
        const closeBtn = modal.querySelector('.cerrar-confirm');

        const confirmHandler = () => {
            onConfirm();
            closeModal();
        };

        const closeModal = () => {
            modal.classList.remove('is-visible');
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', closeModal);
            closeBtn.removeEventListener('click', closeModal);
        };

        // Usa {once: true} para que los listeners se limpien automáticamente después de un clic
        confirmBtn.addEventListener('click', confirmHandler, { once: true });
        cancelBtn.addEventListener('click', closeModal, { once: true });
        closeBtn.addEventListener('click', closeModal, { once: true });

        modal.classList.add('is-visible');
    }

    function safeSetLocalStorage(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                showNotification('Error: El almacenamiento del navegador está lleno.', 'error');
            } else {
                showNotification('Error inesperado al guardar datos.', 'error');
                console.error(e);
            }
            return false;
        }
    }

    const sanitizeHTML = (str) => {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    };

    // --- NEW: Function to process avatars after comments are rendered ---
    function processCommentAvatars() {
        const commentAvatars = document.querySelectorAll('.comment-avatar');

        commentAvatars.forEach(avatar => {
            // Solo procesamos si el avatar no tiene ya una imagen cargada
            if (!avatar.querySelector('img')) {
                const initial = avatar.getAttribute('data-initial');

                // Limpiamos cualquier contenido previo para evitar duplicados si se llama varias veces
                // (e.g., si el modal se reabre sin un reset completo)
                avatar.innerHTML = ''; 

                if (initial) {
                    // Si hay una inicial, la mostramos como texto
                    avatar.textContent = initial;
                } else {
                    // Si no hay inicial, y no hay imagen, mostramos un icono por defecto
                    const icon = document.createElement('i');
                    icon.classList.add('fas', 'fa-user'); // Clase para un icono de usuario de Font Awesome
                    avatar.appendChild(icon);
                }
            }
        });
    }

    // --- App Initialization ---
    function initialize() {
        const usuarioActivo = localStorage.getItem('usuarioActivo');
        const loader = document.getElementById('loader');

        if (!usuarioActivo && !window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
            return;
        }

        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.style.display = 'none';
                const app = document.getElementById('app');
                if(app) app.style.display = 'block';
            }, 500);
        }

        if (usuarioActivo) {
            setupUserInterface(usuarioActivo);
            setupGlobalEventListeners();
            initializePageContent();
        }
    }

    function setupUserInterface(usuario) {
        const rol = localStorage.getItem('rolActivo');
        document.getElementById('dropdown-username').textContent = usuario;
        
        const usersData = JSON.parse(localStorage.getItem('usersData') || '{}');
        const userData = usersData[usuario] || {};
        const avatarUrl = userData.avatar; // Puede ser undefined si no hay avatar

        const profileAvatarIcon = document.getElementById('profile-avatar-icon');
        const dropdownAvatarImg = document.getElementById('dropdown-avatar-img');

        // Lógica unificada para el avatar del perfil
        if (profileAvatarIcon) {
            if (avatarUrl) {
                profileAvatarIcon.src = avatarUrl;
                profileAvatarIcon.removeAttribute('data-initial');
            } else {
                profileAvatarIcon.src = ''; // Limpiar src si no hay imagen
                profileAvatarIcon.setAttribute('data-initial', usuario.charAt(0).toUpperCase());
                // Asegurarse de que el icono o la inicial se muestre vía CSS
                // El CSS con `comment-avatar:empty::before` ya lo maneja
            }
        }
        if (dropdownAvatarImg) {
            if (avatarUrl) {
                dropdownAvatarImg.src = avatarUrl;
                dropdownAvatarImg.removeAttribute('data-initial');
            } else {
                dropdownAvatarImg.src = ''; // Limpiar src si no hay imagen
                dropdownAvatarImg.setAttribute('data-initial', usuario.charAt(0).toUpperCase());
            }
        }
        
        // Ejecutar processCommentAvatars para el avatar del perfil si no es una imagen
        // Esto es necesario porque profileAvatarIcon y dropdownAvatarImg son imágenes
        // y nuestro CSS fallback es para divs vacíos con data-initial.
        // Si quieres que el avatar del perfil use la misma lógica de "div vacío",
        // cambiarías profileAvatarIcon y dropdownAvatarImg de <img> a <div> y aplicarías la misma lógica que en comments.
        // Por ahora, asumimos que son <img> y se les asigna src o placeholder.
        // Si el avatarUrl es un placeholder de texto (como el antiguo "https://placehold.co/..."),
        // entonces el atributo src ya lo mostrará y no se necesita processCommentAvatars para esos.
        // La lógica de processCommentAvatars es específicamente para divs `.comment-avatar` sin `<img>` dentro.

        const profileDropdown = document.querySelector('.profile-dropdown');
        if(profileDropdown) profileDropdown.style.display = 'block';

        const btnVerUsuarios = document.getElementById('btn-ver-usuarios');
        if (rol === 'admin') {
            document.body.classList.add('admin-mode');
            if(btnVerUsuarios) {
                btnVerUsuarios.style.display = 'block';
                btnVerUsuarios.addEventListener('click', () => {
                    const usuariosSection = document.getElementById('usuarios-registrados');
                    if(!usuariosSection) return;
                    const isVisible = usuariosSection.style.display === 'block';
                    usuariosSection.style.display = isVisible ? 'none' : 'block';
                    btnVerUsuarios.textContent = isVisible ? '👥 Ver Usuarios Registrados' : 'Ocultar Usuarios';
                    if (!isVisible) loadRegisteredUsers();
                });
            }
            const adminPanelLink = document.getElementById('admin-panel-link');
            if(adminPanelLink) adminPanelLink.style.display = 'block';
        }
    }

    function setupGlobalEventListeners() {
        const profileIcon = document.getElementById('profile-avatar-icon');
        const profileMenu = document.getElementById('profile-menu');
        if (profileIcon && profileMenu) {
            profileIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                profileMenu.classList.toggle('show');
            });
            window.addEventListener('click', () => {
                if (profileMenu.classList.contains('show')) {
                    profileMenu.classList.remove('show');
                }
            });
        }

        document.getElementById('logout-link')?.addEventListener('click', logout);
        document.getElementById('change-photo-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('avatar-upload-input')?.click();
        });
        document.getElementById('avatar-upload-input')?.addEventListener('change', handleAvatarChange);
        document.getElementById('delete-account-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            showConfirmationModal(
                '¿Eliminar cuenta?',
                'Esta acción es permanente y no se puede deshacer. Se borrarán todos tus datos (fanfics, imágenes, comentarios y likes). ¿Estás seguro?',
                deleteAccount
            );
        });
        document.getElementById('report-problem-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            showReportModal();
        });
        document.getElementById('admin-panel-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            showAdminPanel();
        });
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.querySelector('.nav-links');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', () => {
                navLinks.classList.toggle('active');
            });
        }
    }

    function initializePageContent() {
        const path = window.location.pathname;
        if (path.includes('index.html') || path.endsWith('/')) {
            initHomePage();
        } else if (path.includes('galeria.html')) {
            initGalleryPage();
        } else if (path.includes('fanfics.html')) {
            initFanficsPage();
        }
    }

    function logout(e) {
        if(e) e.preventDefault();
        showConfirmationModal('¿Cerrar sesión?', '¿Estás seguro de que quieres cerrar sesión?', () => {
            localStorage.removeItem('usuarioActivo');
            localStorage.removeItem('rolActivo');
            showNotification('Has cerrado sesión.', 'info');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        });
    }

    function handleAvatarChange(event) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const usuario = localStorage.getItem('usuarioActivo');
            let usersData = JSON.parse(localStorage.getItem('usersData') || '{}');
            if (!usersData[usuario]) {
                usersData[usuario] = {};
            }
            usersData[usuario].avatar = e.target.result;
            if (safeSetLocalStorage('usersData', JSON.stringify(usersData))) {
                showNotification('Foto de perfil actualizada.', 'success');
                // Vuelve a configurar la UI para que el avatar se actualice
                setupUserInterface(usuario); 
            }
        };
        reader.readAsDataURL(file);
    }

    function deleteAccount() {
        const usuario = localStorage.getItem('usuarioActivo');
        let fanfics = JSON.parse(localStorage.getItem('fanfics') || '[]');
        let imagenes = JSON.parse(localStorage.getItem('imagenesGaleria') || '[]');

        const remainingFanfics = fanfics.filter(f => f.autor !== usuario);
        const remainingImages = imagenes.filter(i => i.autor !== usuario);

        remainingImages.forEach(img => {
            img.likes = img.likes.filter(like => like !== usuario);
            img.comentarios = img.comentarios.filter(comment => comment.autor !== usuario);
        });
        remainingFanfics.forEach(fanfic => {
            fanfic.likes = fanfic.likes.filter(like => like !== usuario);
        });
        safeSetLocalStorage('fanfics', JSON.stringify(remainingFanfics));
        safeSetLocalStorage('imagenesGaleria', JSON.stringify(remainingImages));

        let usuarios = JSON.parse(localStorage.getItem('usuarios') || '{}');
        let usersData = JSON.parse(localStorage.getItem('usersData') || '{}');
        delete usuarios[usuario];
        delete usersData[usuario];
        
        safeSetLocalStorage('usuarios', JSON.stringify(usuarios));
        safeSetLocalStorage('usersData', JSON.stringify(usersData));

        localStorage.removeItem('usuarioActivo');
        localStorage.removeItem('rolActivo');
        showNotification('Cuenta eliminada con éxito.', 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    }

    // --- Report System ---
    function showReportModal() {
        const modal = document.getElementById('modal-report');
        if (!modal) return;
        
        const form = modal.querySelector('#report-form');
        const closeBtn = modal.querySelector('.cerrar-report');
        form.onsubmit = (e) => {
            e.preventDefault();
            const description = modal.querySelector('#report-description').value;
            if (description.trim()) {
                submitReport(description.trim());
                form.reset();
                modal.classList.remove('is-visible');
            } else {
                showNotification('Por favor, describe el problema.', 'error');
            }
        };
        
        closeBtn.onclick = () => modal.classList.remove('is-visible');
        modal.classList.add('is-visible');
    }

    function submitReport(description) {
        let reports = JSON.parse(localStorage.getItem('reports') || '[]');
        const newReport = {
            id: Date.now().toString(),
            user: localStorage.getItem('usuarioActivo'),
            date: new Date().toISOString(),
            text: description,
            status: 'new'
        };
        reports.push(newReport);
        if(safeSetLocalStorage('reports', JSON.stringify(reports))) {
            showNotification('Reporte enviado. Gracias por tu ayuda.', 'success');
        }
    }

    // --- Admin Panel ---
    function showAdminPanel() {
        const modal = document.getElementById('modal-admin');
        if (!modal) return;
        loadReportsForAdmin();
        modal.classList.add('is-visible');
        modal.querySelector('.cerrar-admin').onclick = () => modal.classList.remove('is-visible');
    }

    function loadReportsForAdmin() {
        const reports = JSON.parse(localStorage.getItem('reports') || '[]').sort((a,b) => new Date(b.date) - new Date(a.date));
        const list = document.getElementById('admin-reports-list');
        if (!list) return;

        list.innerHTML = '';
        if (reports.length === 0) {
            list.innerHTML = '<p>No hay reportes pendientes.</p>';
            return;
        }

        reports.forEach(report => {
            const item = document.createElement('li');
            item.className = `report-item status-${report.status}`;
            item.innerHTML = `
                <div class="report-header">
                    <strong>Reporte de: ${sanitizeHTML(report.user)}</strong>
                    <span class="report-status status-${report.status}">${report.status.toUpperCase()}</span>
                </div>
                <small>${new Date(report.date).toLocaleString()}</small>
                <p class="report-body">${sanitizeHTML(report.text)}</p>
                <div class="report-actions">
                    ${report.status !== 'read' ? `<button class="btn-secondary" data-id="${report.id}" data-status="read">Marcar como Leído</button>` : ''}
                    ${report.status !== 'resolved' ? `<button class="btn-primary" data-id="${report.id}" data-status="resolved">Marcar como Resuelto</button>` : ''}
                </div>
            `;
            list.appendChild(item);
        });

        list.querySelectorAll('.report-actions button').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const status = e.target.dataset.status;
                updateReportStatus(id, status);
            });
        });
    }


    // --- Page Initializers ---
    function initHomePage() {
        loadRecentFanfics();
    }

    function initGalleryPage() {
        loadGalleryImages();
        setupGalleryEventListeners();
    }

    function initFanficsPage() {
        initializeFanficEditor();
        loadFanfics();
        setupFanficEventListeners();
    }

    // --- Home Page Logic ---
    function loadRecentFanfics() {
        const fanfics = JSON.parse(localStorage.getItem('fanfics') || '[]');
        const latest = fanfics.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 3);
        const container = document.getElementById('fanfics-recientes-grid');
        const noContentMsg = document.getElementById('no-fanfics-index');
        if (!container || !noContentMsg) return;

        container.innerHTML = '';
        if (latest.length === 0) {
            noContentMsg.style.display = 'block';
            container.style.display = 'none';
        } else {
            noContentMsg.style.display = 'none';
            container.style.display = 'grid';
            latest.forEach(fanfic => {
                const card = document.createElement('div');
                card.className = 'fanfic-card';
                card.innerHTML = `
                    <img src="${fanfic.portada || 'https://placehold.co/300x200/cccccc/ffffff?text=Sin+Portada'}" alt="Portada de ${fanfic.titulo}" class="fanfic-card-cover">
                    <div class="fanfic-card-content">
                        <h3>${sanitizeHTML(fanfic.titulo)}</h3>
                        <p class="fanfic-meta">Por: ${sanitizeHTML(fanfic.autor)}</p>
                        <p class="fanfic-snippet">${fanfic.contenido.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                        <a href="fanfics.html" class="leer-mas">Ver más</a>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    }
    
    // --- Fanfics Page Logic ---
    function initializeFanficEditor() {
        const editorElement = document.getElementById('fanfic-contenido-editor');
        if (editorElement) {
            quill = new Quill(editorElement, {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        ['blockquote', { 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['link', 'image'], ['clean']
                    ]
                }
            });
        }
    }

    function setupFanficEventListeners() {
        document.getElementById('fanfic-form')?.addEventListener('submit', saveFanfic);
        document.getElementById('fab-write-fanfic')?.addEventListener('click', toggleFanficForm);
        document.getElementById('fanfic-search-input')?.addEventListener('keyup', (e) => loadFanfics(e.target.value));
        document.getElementById('fanfic-portada')?.addEventListener('change', previewFanficCover);
        
        const tagInput = document.getElementById('fanfic-nueva-etiqueta');
        if(tagInput) {
            tagInput.addEventListener('keyup', e => {
                if ((e.key === 'Enter' || e.key === ',') && tagInput.value.trim()) {
                    e.preventDefault();
                    addTag(tagInput.value.trim().replace(/,/g, ''), 'fanfic');
                    tagInput.value = '';
                }
            });
        }
    }

    function toggleFanficForm(e) {
        e.preventDefault();
        const uploadSection = document.getElementById('fanfic-upload-section');
        if(!uploadSection) return;
        const isHidden = uploadSection.style.display === 'none' || !uploadSection.style.display;
        uploadSection.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            uploadSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function saveFanfic(e) {
        e.preventDefault();
        const titulo = document.getElementById('fanfic-titulo').value;
        const autor = localStorage.getItem('usuarioActivo');
        const portadaInput = document.getElementById('fanfic-portada');
        const contenido = quill.root.innerHTML;
        if (!titulo || !contenido.trim() || !autor) {
            showNotification('Por favor, completa el título y el contenido.', 'error');
            return;
        }

        const fanfics = JSON.parse(localStorage.getItem('fanfics') || '[]');
        const nuevoFanfic = {
            id: Date.now().toString(),
            titulo, autor, contenido,
            fecha: new Date().toISOString(),
            portada: '', vistas: 0, likes: [],
            comentarios: [], // Añadido para fanfics también
            tags: [...currentFanficTags]
        };
        const finalizeSave = () => {
            fanfics.push(nuevoFanfic);
            if (safeSetLocalStorage('fanfics', JSON.stringify(fanfics))) {
                showNotification('Fanfic guardado con éxito!', 'success');
                document.getElementById('fanfic-form').reset();
                quill.setContents([]);
                document.getElementById('fanfic-portada-preview').style.display = 'none';
                document.getElementById('fanfic-upload-section').style.display = 'none';
                currentFanficTags = [];
                renderTags('fanfic'); // Asegura que los tags se reseteen
                loadFanfics();
            }
        };

        if (portadaInput.files && portadaInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = function(e) {
                nuevoFanfic.portada = e.target.result;
                finalizeSave();
            };
            reader.readAsDataURL(portadaInput.files[0]);
        } else {
            finalizeSave();
        }
    }

    function loadFanfics(query = '') {
        const grid = document.getElementById('fanfics-grid');
        const noMsg = document.querySelector('.no-fanfics-message');
        if (!grid || !noMsg) return;

        const fanfics = JSON.parse(localStorage.getItem('fanfics') || '[]');
        const lowerQuery = query.toLowerCase();
        const filtered = fanfics.filter(f =>
            f.titulo.toLowerCase().includes(lowerQuery) ||
            f.autor.toLowerCase().includes(lowerQuery) ||
            (f.tags && f.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
        ).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        grid.innerHTML = '';
        if (filtered.length === 0) {
            noMsg.style.display = 'block';
            noMsg.textContent = query ? `No se encontraron fanfics para "${query}".` : 'Aún no hay fanfics. ¡Sé el primero en escribir uno!';
        } else {
            noMsg.style.display = 'none';
            grid.style.display = 'grid';
            filtered.forEach(fanfic => {
                const card = document.createElement('div');
                card.className = 'fanfic-card';
                card.innerHTML = `
                    <img src="${fanfic.portada || 'https://placehold.co/300x200/cccccc/ffffff?text=Sin+Portada'}" alt="Portada de ${fanfic.titulo}" class="fanfic-card-cover">
                    <div class="fanfic-card-content">
                        <h3>${sanitizeHTML(fanfic.titulo)}</h3>
                        <p class="fanfic-meta">Por: ${sanitizeHTML(fanfic.autor)} | ${new Date(fanfic.fecha).toLocaleDateString()}</p>
                        <p class="fanfic-snippet">${fanfic.contenido.replace(/<[^>]*>/g, '').substring(0, 150)}...</p>
                        <button class="leer-mas" data-id="${fanfic.id}">Leer Más</button>
                    </div>
                `;
                grid.appendChild(card);
            });
            grid.querySelectorAll('.leer-mas').forEach(button => {
                button.addEventListener('click', (e) => openFanficModal(e.target.dataset.id));
            });
        }
    }

    function openFanficModal(id) {
        let fanfics = JSON.parse(localStorage.getItem('fanfics') || '[]');
        const fanficIndex = fanfics.findIndex(f => f.id === id);
        if (fanficIndex === -1) return;
        
        const fanfic = fanfics[fanficIndex];
        fanfic.vistas = (fanfic.vistas || 0) + 1;
        safeSetLocalStorage('fanfics', JSON.stringify(fanfics)); // Guarda la actualización de vistas

        const modal = document.getElementById('modal-fanfic');
        if (!modal) return;
        
        document.getElementById('fanfic-modal-titulo').textContent = fanfic.titulo;
        document.getElementById('fanfic-modal-autor').textContent = fanfic.autor;
        document.getElementById('fanfic-modal-texto').innerHTML = fanfic.contenido;
        document.getElementById('fanfic-modal-portada').src = fanfic.portada || 'https://placehold.co/800x400/cccccc/ffffff?text=Sin+Portada';
        document.getElementById('fanfic-modal-views').textContent = fanfic.vistas;
        
        const likeButton = modal.querySelector('.fanfic-like-button');
        likeButton.dataset.fanficId = id;
        likeButton.onclick = () => toggleFanficLike(id);

        updateFanficLikesUI(id);
        updateFanficTagsUI(id);
        renderCommentsForFanfic(id); // Renderiza los comentarios del fanfic
        processCommentAvatars(); // Procesa los avatares DESPUÉS de renderizar los comentarios

        modal.classList.add('is-visible');
        const closeModal = () => modal.classList.remove('is-visible');
        modal.querySelector('.cerrar-fanfic').onclick = closeModal;
        window.addEventListener('click', e => { if (e.target === modal) closeModal(); }, { once: true });
    }

    function toggleFanficLike(fanficId) {
        let fanfics = JSON.parse(localStorage.getItem('fanfics') || '[]');
        const fanfic = fanfics.find(f => f.id === fanficId);
        if (!fanfic) return;

        const usuario = localStorage.getItem('usuarioActivo');
        const likeIndex = fanfic.likes.indexOf(usuario);
        if (likeIndex === -1) {
            fanfic.likes.push(usuario);
        } else {
            fanfic.likes.splice(likeIndex, 1);
        }
        safeSetLocalStorage('fanfics', JSON.stringify(fanfics));
        updateFanficLikesUI(fanficId);
    }

    function updateFanficLikesUI(fanficId) {
        const fanfic = JSON.parse(localStorage.getItem('fanfics') || '[]').find(f => f.id === fanficId);
        const modal = document.getElementById('modal-fanfic');
        if (!fanfic || !modal || !modal.classList.contains('is-visible')) return;
        
        const likeButton = modal.querySelector('.fanfic-like-button');
        const likeCountSpan = modal.querySelector('#fanfic-modal-likes');
        const likeIcon = likeButton.querySelector('i');
        const usuario = localStorage.getItem('usuarioActivo');

        likeCountSpan.textContent = fanfic.likes.length;
        if (fanfic.likes.includes(usuario)) {
            likeButton.classList.add('liked');
            likeIcon.classList.replace('fa-regular', 'fa-solid');
        } else {
            likeButton.classList.remove('liked');
            likeIcon.classList.replace('fa-solid', 'fa-regular');
        }
    }
    
    function updateFanficTagsUI(fanficId) {
        const fanfic = JSON.parse(localStorage.getItem('fanfics') || '[]').find(f => f.id === fanficId);
        const modal = document.getElementById('modal-fanfic');
        if (!fanfic || !modal || !modal.classList.contains('is-visible')) return;

        const tagsContainer = document.getElementById('fanfic-modal-tags');
        tagsContainer.innerHTML = '';
        if (fanfic.tags) {
            fanfic.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.textContent = tag;
                tagsContainer.appendChild(span);
            });
        }
    }

    function previewFanficCover(event) {
        const preview = document.getElementById('fanfic-portada-preview');
        if (event.target.files && event.target.files.length > 0) {
            preview.src = URL.createObjectURL(event.target.files[0]);
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
            preview.src = '';
        }
    }

    // --- Gallery Page Logic ---
    function setupGalleryEventListeners() {
        const uploadModal = document.getElementById('image-upload-modal');
        if(!uploadModal) return;

        document.getElementById('fab-upload-image').addEventListener('click', (e) => { e.preventDefault(); uploadModal.classList.add('is-visible'); resetUploadForm(); });
        uploadModal.querySelector('.cerrar-upload').addEventListener('click', () => uploadModal.classList.remove('is-visible'));
        document.getElementById('image-upload-form').addEventListener('submit', uploadImage);
        document.getElementById('image-search-input')?.addEventListener('keyup', (e) => loadGalleryImages(e.target.value));
        
        const dropArea = document.getElementById('drop-area');
        const fileInput = document.getElementById('image-archivo');
        const selectFileButton = document.getElementById('select-file-button');
        if(dropArea && fileInput && selectFileButton) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eName => dropArea.addEventListener(eName, e => {e.preventDefault(); e.stopPropagation();}));
            ['dragenter', 'dragover'].forEach(eName => dropArea.addEventListener(eName, () => dropArea.classList.add('highlight')));
            ['dragleave', 'drop'].forEach(eName => dropArea.addEventListener(eName, () => dropArea.classList.remove('highlight')));
            dropArea.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
            selectFileButton.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', e => handleFiles(e.target.files));
        }

        const tagInput = document.getElementById('tag-input');
        if(tagInput) {
            tagInput.addEventListener('keyup', e => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    e.preventDefault();
                    addTag(e.target.value.trim(), 'image');
                    e.target.value = '';
                }
            });
        }
        
        const suggestedTagsContainer = document.getElementById('suggested-tags-container');
        if(suggestedTagsContainer) {
            suggestedTagsContainer.innerHTML = '';
            predefinedTags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'suggested-tag';
                tagSpan.textContent = tag;
                tagSpan.addEventListener('click', () => toggleSuggestedTag(tag));
                suggestedTagsContainer.appendChild(tagSpan);
            });
        }
    }

    function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith('image/')) {
            showNotification('Por favor, selecciona un archivo de imagen.', 'error');
            return;
        }
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('file-preview').innerHTML = `<img src="${e.target.result}" alt="Previsualización">`;
        };
        reader.readAsDataURL(file);
    }

    function uploadImage(e) {
        e.preventDefault();
        const titulo = document.getElementById('image-titulo').value;
        const apiKey = 'fba61d33034366d8dabc59ba3677e08b'; // Tu API Key de ImgBB

        if (!titulo || !selectedFile || currentImageTags.length === 0) {
            showNotification('Completa el título, selecciona una imagen y añade al menos una etiqueta.', 'error');
            return;
        }

        showNotification('Subiendo imagen, por favor espera...', 'info');

        const formData = new FormData();
        formData.append('image', selectedFile);

        fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                const imageUrl = result.data.url;
                let imagenes = JSON.parse(localStorage.getItem('imagenesGaleria') || '[]');
                const nuevaImagen = {
                    id: Date.now().toString(),
                    titulo,
                    url: imageUrl,
                    autor: localStorage.getItem('usuarioActivo'),
                    fecha: new Date().toISOString(),
                    likes: [],
                    comentarios: [],
                    tags: [...currentImageTags]
                };
                imagenes.push(nuevaImagen);
                if (safeSetLocalStorage('imagenesGaleria', JSON.stringify(imagenes))) {
                    showNotification('Imagen subida y guardada en la galería.', 'success');
                    document.getElementById('image-upload-modal').classList.remove('is-visible');
                    resetUploadForm();
                    loadGalleryImages();
                }
            } else {
                showNotification(`Error al subir la imagen: ${result.status_txt || 'Error desconocido'}`, 'error');
                console.error('Error al subir la imagen a ImgBB:', result);
            }
        })
        .catch(error => {
            showNotification('Error de red o conexión al subir la imagen.', 'error');
            console.error('Error de red o ImgBB:', error);
        });
    }

    function resetUploadForm() {
        document.getElementById('image-upload-form').reset();
        selectedFile = null;
        document.getElementById('file-preview').innerHTML = '';
        currentImageTags = [];
        renderTags('image');
        document.querySelectorAll('.suggested-tag.selected').forEach(tag => tag.classList.remove('selected'));
    }

    function loadGalleryImages(query = '') {
        const grid = document.getElementById('galeria-grid');
        const noContentMsg = document.querySelector('.no-galeria-message');
        if (!grid || !noContentMsg) return;

        const imagenes = JSON.parse(localStorage.getItem('imagenesGaleria') || '[]');
        const lowerQuery = query.toLowerCase();
        const filtered = imagenes.filter(img =>
            img.titulo.toLowerCase().includes(lowerQuery) ||
            img.autor.toLowerCase().includes(lowerQuery) ||
            (img.tags && img.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
        ).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        grid.innerHTML = '';
        if (filtered.length === 0) {
            noContentMsg.style.display = 'block';
            noContentMsg.textContent = query ? `No se encontraron imágenes para "${query}".` : 'Aún no hay imágenes en la galería. ¡Sé el primero en subir una!';
        } else {
            noContentMsg.style.display = 'none';
            grid.style.display = 'grid';
            filtered.forEach(img => {
                const card = document.createElement('div');
                card.className = 'galeria-card';
                card.dataset.id = img.id;
                card.innerHTML = `
                    <img src="${img.url}" alt="${sanitizeHTML(img.titulo)}" class="galeria-image">
                `;
                card.addEventListener('click', () => openImageModal(img.id));
                grid.appendChild(card);
            });
        }
    }

    function openImageModal(id) {
        let imagenes = JSON.parse(localStorage.getItem('imagenesGaleria') || '[]');
        const imagenIndex = imagenes.findIndex(img => img.id === id);
        if (imagenIndex === -1) return;

        const imagen = imagenes[imagenIndex];
        const modal = document.getElementById('modal-image-detail');
        if (!modal) return;

        document.getElementById('modal-detail-image').src = imagen.url;
        document.getElementById('image-modal-title').textContent = imagen.titulo;
        document.getElementById('image-modal-author').textContent = imagen.autor;
        document.getElementById('image-modal-date').textContent = new Date(imagen.fecha).toLocaleDateString();

        const likeButton = modal.querySelector('.image-like-button');
        likeButton.dataset.imageId = id;
        likeButton.onclick = () => toggleImageLike(id);

        updateImageLikesUI(id);
        updateImageTagsUI(id);
        renderCommentsForImage(id); // Renderiza los comentarios para la imagen
        processCommentAvatars(); // Procesa los avatares DESPUÉS de que los comentarios se renderizan

        modal.classList.add('is-visible');
        const closeModal = () => modal.classList.remove('is-visible');
        modal.querySelector('.cerrar-image-modal').onclick = closeModal;
        window.addEventListener('click', e => { if (e.target === modal) closeModal(); }, { once: true });
    }

    function toggleImageLike(imageId) {
        let imagenes = JSON.parse(localStorage.getItem('imagenesGaleria') || '[]');
        const imagen = imagenes.find(img => img.id === imageId);
        if (!imagen) return;

        const usuario = localStorage.getItem('usuarioActivo');
        const likeIndex = imagen.likes.indexOf(usuario);
        if (likeIndex === -1) {
            imagen.likes.push(usuario);
        } else {
            imagen.likes.splice(likeIndex, 1);
        }
        safeSetLocalStorage('imagenesGaleria', JSON.stringify(imagenes));
        updateImageLikesUI(imageId);
    }

    function updateImageLikesUI(imageId) {
        const imagen = JSON.parse(localStorage.getItem('imagenesGaleria') || '[]').find(img => img.id === imageId);
        const modal = document.getElementById('modal-image-detail');
        if (!imagen || !modal || !modal.classList.contains('is-visible')) return;
        
        const likeButton = modal.querySelector('.image-like-button');
        const likeCountSpan = modal.querySelector('#image-modal-likes');
        const likeIcon = likeButton.querySelector('i');
        const usuario = localStorage.getItem('usuarioActivo');

        likeCountSpan.textContent = imagen.likes.length;
        if (imagen.likes.includes(usuario)) {
            likeButton.classList.add('liked');
            likeIcon.classList.replace('fa-regular', 'fa-solid');
        } else {
            likeButton.classList.remove('liked');
            likeIcon.classList.replace('fa-solid', 'fa-regular');
        }
    }

    function updateImageTagsUI(imageId) {
        const imagen = JSON.parse(localStorage.getItem('imagenesGaleria') || '[]').find(img => img.id === imageId);
        const modal = document.getElementById('modal-image-detail');
        if (!imagen || !modal || !modal.classList.contains('is-visible')) return;

        const tagsContainer = modal.querySelector('.tags-container-modal');
        tagsContainer.innerHTML = '';
        if (imagen.tags) {
            imagen.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.textContent = tag;
                tagsContainer.appendChild(span);
            });
        }
    }

    // --- Tags Management ---
    function addTag(tagText, type) {
        const tag = tagText.toLowerCase();
        if (type === 'image') {
            if (!currentImageTags.includes(tag)) {
                currentImageTags.push(tag);
                renderTags('image');
            }
        } else if (type === 'fanfic') {
            if (!currentFanficTags.includes(tag)) {
                currentFanficTags.push(tag);
                renderTags('fanfic');
            }
        }
    }

    function removeTag(tagText, type) {
        if (type === 'image') {
            currentImageTags = currentImageTags.filter(t => t !== tagText);
            renderTags('image');
            // Deseleccionar de sugeridos si estaba seleccionado
            const suggestedTagElement = document.querySelector(`#suggested-tags-container .suggested-tag[data-tag="${tagText}"]`);
            if (suggestedTagElement) {
                suggestedTagElement.classList.remove('selected');
            }
        } else if (type === 'fanfic') {
            currentFanficTags = currentFanficTags.filter(t => t !== tagText);
            renderTags('fanfic');
        }
    }

    function renderTags(type) {
        const containerId = type === 'image' ? 'current-tags-container' : 'fanfic-current-tags-container';
        const tagsContainer = document.getElementById(containerId);
        if (!tagsContainer) return;

        const tags = type === 'image' ? currentImageTags : currentFanficTags;
        tagsContainer.innerHTML = '';
        tags.forEach(tagText => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'editable-tag';
            tagSpan.dataset.tag = tagText; // Para facilitar la eliminación
            tagSpan.innerHTML = `${sanitizeHTML(tagText)} <button class="remove-tag-btn" data-tag="${tagText}"><i class="fas fa-times"></i></button>`;
            tagsContainer.appendChild(tagSpan);
            tagSpan.querySelector('.remove-tag-btn').addEventListener('click', () => removeTag(tagText, type));
        });
    }

    function toggleSuggestedTag(tagText) {
        const isSelected = currentImageTags.includes(tagText);
        if (isSelected) {
            removeTag(tagText, 'image');
        } else {
            addTag(tagText, 'image');
        }
        // Actualizar el estado visual de la etiqueta sugerida
        const suggestedTagElement = document.querySelector(`#suggested-tags-container .suggested-tag[data-tag="${tagText}"]`);
        if (suggestedTagElement) {
            suggestedTagElement.classList.toggle('selected', !isSelected);
        }
    }

    // --- Comments Logic (for both images and fanfics) ---
    function renderCommentsForImage(imageId) {
        const imagen = JSON.parse(localStorage.getItem('imagenesGaleria') || '[]').find(img => img.id === imageId);
        const commentsList = document.getElementById('image-comments-list'); // Asume que tienes este ID en tu HTML para los comentarios de la imagen
        const commentForm = document.getElementById('image-comment-form');
        const currentUser = localStorage.getItem('usuarioActivo');
        const usersData = JSON.parse(localStorage.getItem('usersData') || '{}');

        if (!imagen || !commentsList || !commentForm) return;

        commentsList.innerHTML = '';
        if (imagen.comentarios && imagen.comentarios.length > 0) {
            imagen.comentarios.sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).forEach(comment => {
                const commentUser = usersData[comment.autor] || {};
                const userAvatarUrl = commentUser.avatar;
                const userInitial = comment.autor.charAt(0).toUpperCase();

                const commentItem = document.createElement('div');
                commentItem.className = 'comment-item';
                commentItem.dataset.commentId = comment.id; // Para futuras acciones de edición/eliminación

                // Condicionalmente agrega la imagen o el data-initial para el fallback de CSS/JS
                const avatarHtml = userAvatarUrl 
                    ? `<img src="${userAvatarUrl}" alt="Avatar de ${sanitizeHTML(comment.autor)}">`
                    : '';

                commentItem.innerHTML = `
                    <div class="comment-avatar" ${!userAvatarUrl ? `data-initial="${userInitial}"` : ''}>
                        ${avatarHtml}
                    </div>
                    <div class="comment-content-wrapper">
                        <div class="comment-header">
                            <div class="comment-author-info">
                                <strong>${sanitizeHTML(comment.autor)}</strong>
                                <small>${new Date(comment.fecha).toLocaleString()}</small>
                            </div>
                            <div class="comment-actions">
                                ${comment.autor === currentUser ? `<button class="action-btn delete-btn" data-id="${comment.id}"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        </div>
                        <p>${sanitizeHTML(comment.texto)}</p>
                    </div>
                `;
                commentsList.appendChild(commentItem);
            });

            // Agrega listeners para botones de eliminar
            commentsList.querySelectorAll('.comment-actions .delete-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const commentIdToDelete = e.currentTarget.dataset.id;
                    showConfirmationModal(
                        'Eliminar comentario',
                        '¿Estás seguro de que quieres eliminar este comentario? Esta acción es irreversible.',
                        () => deleteComment('image', imageId, commentIdToDelete)
                    );
                });
            });

        } else {
            commentsList.innerHTML = '<p class="no-comments-message">Sé el primero en comentar.</p>';
        }

        // Configurar el formulario de comentarios
        commentForm.dataset.parentId = imageId;
        commentForm.dataset.parentType = 'image';
        commentForm.onsubmit = submitComment;

        // Establecer el avatar del usuario actual en el formulario de comentarios
        const currentUserAvatarContainer = commentForm.querySelector('.comment-input-area .comment-avatar');
        if (currentUserAvatarContainer) {
            const user = usersData[currentUser] || {};
            const avatarUrl = user.avatar;
            if (avatarUrl) {
                currentUserAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Tu avatar">`;
                currentUserAvatarContainer.removeAttribute('data-initial');
            } else {
                currentUserAvatarContainer.innerHTML = '';
                currentUserAvatarContainer.setAttribute('data-initial', currentUser.charAt(0).toUpperCase());
            }
        }
    }

    // Nuevo: Función para renderizar comentarios de fanfics (similar a imágenes)
    function renderCommentsForFanfic(fanficId) {
        const fanfic = JSON.parse(localStorage.getItem('fanfics') || '[]').find(f => f.id === fanficId);
        const commentsList = document.getElementById('fanfic-comments-list'); // Asume este ID para comentarios de fanfics
        const commentForm = document.getElementById('fanfic-comment-form'); // Asume este ID para el formulario de fanfics
        const currentUser = localStorage.getItem('usuarioActivo');
        const usersData = JSON.parse(localStorage.getItem('usersData') || '{}');

        if (!fanfic || !commentsList || !commentForm) return;

        commentsList.innerHTML = '';
        if (fanfic.comentarios && fanfic.comentarios.length > 0) {
            fanfic.comentarios.sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).forEach(comment => {
                const commentUser = usersData[comment.autor] || {};
                const userAvatarUrl = commentUser.avatar;
                const userInitial = comment.autor.charAt(0).toUpperCase();

                const commentItem = document.createElement('div');
                commentItem.className = 'comment-item';
                commentItem.dataset.commentId = comment.id;

                const avatarHtml = userAvatarUrl 
                    ? `<img src="${userAvatarUrl}" alt="Avatar de ${sanitizeHTML(comment.autor)}">`
                    : '';

                commentItem.innerHTML = `
                    <div class="comment-avatar" ${!userAvatarUrl ? `data-initial="${userInitial}"` : ''}>
                        ${avatarHtml}
                    </div>
                    <div class="comment-content-wrapper">
                        <div class="comment-header">
                            <div class="comment-author-info">
                                <strong>${sanitizeHTML(comment.autor)}</strong>
                                <small>${new Date(comment.fecha).toLocaleString()}</small>
                            </div>
                            <div class="comment-actions">
                                ${comment.autor === currentUser ? `<button class="action-btn delete-btn" data-id="${comment.id}"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        </div>
                        <p>${sanitizeHTML(comment.texto)}</p>
                    </div>
                `;
                commentsList.appendChild(commentItem);
            });

            commentsList.querySelectorAll('.comment-actions .delete-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const commentIdToDelete = e.currentTarget.dataset.id;
                    showConfirmationModal(
                        'Eliminar comentario',
                        '¿Estás seguro de que quieres eliminar este comentario? Esta acción es irreversible.',
                        () => deleteComment('fanfic', fanficId, commentIdToDelete)
                    );
                });
            });

        } else {
            commentsList.innerHTML = '<p class="no-comments-message">Sé el primero en comentar.</p>';
        }

        commentForm.dataset.parentId = fanficId;
        commentForm.dataset.parentType = 'fanfic';
        commentForm.onsubmit = submitComment;

        // Establecer el avatar del usuario actual en el formulario de comentarios
        const currentUserAvatarContainer = commentForm.querySelector('.comment-input-area .comment-avatar');
        if (currentUserAvatarContainer) {
            const user = usersData[currentUser] || {};
            const avatarUrl = user.avatar;
            if (avatarUrl) {
                currentUserAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Tu avatar">`;
                currentUserAvatarContainer.removeAttribute('data-initial');
            } else {
                currentUserAvatarContainer.innerHTML = '';
                currentUserAvatarContainer.setAttribute('data-initial', currentUser.charAt(0).toUpperCase());
            }
        }
    }


    function submitComment(e) {
        e.preventDefault();
        const parentId = e.currentTarget.dataset.parentId;
        const parentType = e.currentTarget.dataset.parentType;
        const commentTextarea = e.currentTarget.querySelector('textarea');
        const commentText = commentTextarea.value.trim();
        const currentUser = localStorage.getItem('usuarioActivo');

        if (!commentText) {
            showNotification('El comentario no puede estar vacío.', 'error');
            return;
        }

        const newComment = {
            id: Date.now().toString(),
            autor: currentUser,
            fecha: new Date().toISOString(),
            texto: commentText
        };

        let data = JSON.parse(localStorage.getItem(parentType === 'image' ? 'imagenesGaleria' : 'fanfics') || '[]');
        const parentItem = data.find(item => item.id === parentId);

        if (parentItem) {
            parentItem.comentarios = parentItem.comentarios || [];
            parentItem.comentarios.push(newComment);
            if (safeSetLocalStorage(parentType === 'image' ? 'imagenesGaleria' : 'fanfics', JSON.stringify(data))) {
                showNotification('Comentario añadido.', 'success');
                commentTextarea.value = ''; // Limpiar el textarea
                if (parentType === 'image') {
                    renderCommentsForImage(parentId); // Volver a renderizar comentarios de la imagen
                } else {
                    renderCommentsForFanfic(parentId); // Volver a renderizar comentarios del fanfic
                }
                processCommentAvatars(); // Re-procesar avatares después de añadir un nuevo comentario
            }
        } else {
            showNotification('Error: No se encontró el elemento para comentar.', 'error');
        }
    }

    function deleteComment(parentType, parentId, commentIdToDelete) {
        let data = JSON.parse(localStorage.getItem(parentType === 'image' ? 'imagenesGaleria' : 'fanfics') || '[]');
        const parentItem = data.find(item => item.id === parentId);

        if (parentItem) {
            parentItem.comentarios = parentItem.comentarios.filter(comment => comment.id !== commentIdToDelete);
            if (safeSetLocalStorage(parentType === 'image' ? 'imagenesGaleria' : 'fanfics', JSON.stringify(data))) {
                showNotification('Comentario eliminado.', 'success');
                if (parentType === 'image') {
                    renderCommentsForImage(parentId);
                } else {
                    renderCommentsForFanfic(parentId);
                }
                processCommentAvatars(); // Re-procesar avatares después de eliminar un comentario
            }
        } else {
            showNotification('Error: No se encontró el elemento para eliminar el comentario.', 'error');
        }
    }

    // --- User management for admin panel ---
    function loadRegisteredUsers() {
        const users = JSON.parse(localStorage.getItem('usuarios') || '{}');
        const usersData = JSON.parse(localStorage.getItem('usersData') || '{}');
        const userList = document.getElementById('registered-users-list');
        if (!userList) return;

        userList.innerHTML = '';
        const currentUser = localStorage.getItem('usuarioActivo');

        for (const username in users) {
            const userData = usersData[username] || {};
            const userRole = users[username].role || 'user';
            const userAvatarUrl = userData.avatar;
            const userInitial = username.charAt(0).toUpperCase();

            const userItem = document.createElement('li');
            userItem.className = 'user-list-item';
            userItem.innerHTML = `
                <div class="user-info">
                    <div class="comment-avatar" ${!userAvatarUrl ? `data-initial="${userInitial}"` : ''}>
                        ${userAvatarUrl ? `<img src="${userAvatarUrl}" alt="Avatar de ${sanitizeHTML(username)}">` : ''}
                    </div>
                    <span>${sanitizeHTML(username)} (${userRole})</span>
                </div>
                <div class="user-actions">
                    ${username !== currentUser ? `
                        <button class="btn-secondary toggle-role-btn" data-username="${username}" data-role="${userRole}">
                            ${userRole === 'admin' ? 'Degradar a Usuario' : 'Ascender a Admin'}
                        </button>
                        <button class="btn-danger delete-user-btn" data-username="${username}">Eliminar</button>
                    ` : ''}
                </div>
            `;
            userList.appendChild(userItem);
        }

        // Procesar avatares después de renderizar la lista de usuarios
        processCommentAvatars(); 

        userList.querySelectorAll('.toggle-role-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const username = e.target.dataset.username;
                const currentRole = e.target.dataset.role;
                const newRole = currentRole === 'admin' ? 'user' : 'admin';
                showConfirmationModal(
                    `Cambiar rol de ${username}`,
                    `¿Estás seguro de que quieres ${newRole === 'admin' ? 'ascender' : 'degradar'} a ${username} a ${newRole}?`,
                    () => updateUserRole(username, newRole)
                );
            });
        });

        userList.querySelectorAll('.delete-user-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const username = e.target.dataset.username;
                showConfirmationModal(
                    `Eliminar usuario ${username}`,
                    `Esta acción eliminará a ${username} y todos sus contenidos. ¿Estás seguro?`,
                    () => deleteUser(username)
                );
            });
        });
    }

    function updateUserRole(username, newRole) {
        let users = JSON.parse(localStorage.getItem('usuarios') || '{}');
        if (users[username]) {
            users[username].role = newRole;
            if(safeSetLocalStorage('usuarios', JSON.stringify(users))) {
                showNotification(`Rol de ${username} actualizado a ${newRole}.`, 'success');
                loadRegisteredUsers(); // Recargar la lista
            }
        }
    }

    function deleteUser(usernameToDelete) {
        let users = JSON.parse(localStorage.getItem('usuarios') || '{}');
        let usersData = JSON.parse(localStorage.getItem('usersData') || '{}');
        let fanfics = JSON.parse(localStorage.getItem('fanfics') || '[]');
        let imagenes = JSON.parse(localStorage.getItem('imagenesGaleria') || '[]');

        delete users[usernameToDelete];
        delete usersData[usernameToDelete];

        const remainingFanfics = fanfics.filter(f => f.autor !== usernameToDelete);
        const remainingImages = imagenes.filter(i => i.autor !== usernameToDelete);

        remainingImages.forEach(img => {
            img.likes = img.likes.filter(like => like !== usernameToDelete);
            img.comentarios = img.comentarios.filter(comment => comment.autor !== usernameToDelete);
        });
        remainingFanfics.forEach(fanfic => {
            fanfic.likes = fanfic.likes.filter(like => like !== usernameToDelete);
            fanfic.comentarios = fanfic.comentarios.filter(comment => comment.autor !== usernameToDelete);
        });

        safeSetLocalStorage('usuarios', JSON.stringify(users));
        safeSetLocalStorage('usersData', JSON.stringify(usersData));
        safeSetLocalStorage('fanfics', JSON.stringify(remainingFanfics));
        safeSetLocalStorage('imagenesGaleria', JSON.stringify(remainingImages));

        showNotification(`Usuario ${usernameToDelete} y sus contenidos eliminados.`, 'success');
        loadRegisteredUsers(); // Recargar la lista de usuarios
        // Si el usuario actual es el eliminado, redirigir a login
        if (localStorage.getItem('usuarioActivo') === usernameToDelete) {
            localStorage.removeItem('usuarioActivo');
            localStorage.removeItem('rolActivo');
            setTimeout(() => { window.location.href = 'login.html'; }, 1000);
        }
    }


    // --- Initial call to start the application ---
    initialize();

});