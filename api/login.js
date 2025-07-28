// login.js
document.addEventListener('DOMContentLoaded', () => {
    let modoRegistro = false;
    const formTitle = document.getElementById('form-title');
    const authButton = document.getElementById('auth-button');
    const toggleLink = document.getElementById('toggle-mode');
    const nombreInput = document.getElementById('nombre');
    const claveInput = document.getElementById('clave');
    const notification = document.getElementById('notification-login');

    function showNotification(message, type = 'error') {
        if (!notification) return;
        notification.textContent = message;
        notification.className = `show ${type}`;
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }

    function alternarModo() {
        modoRegistro = !modoRegistro;
        formTitle.innerText = modoRegistro ? 'Registrarse' : 'Iniciar Sesión';
        authButton.innerText = modoRegistro ? 'Registrarse' : 'Entrar';
        toggleLink.innerText = modoRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate';
    }

    async function autenticar() {
        const nombre = nombreInput.value.trim();
        const clave = claveInput.value;

        if (!nombre || !clave) {
            showNotification('Por favor, completa todos los campos.');
            return;
        }

        if (modoRegistro) {
            // --- LÓGICA DE REGISTRO MODIFICADA ---
            authButton.disabled = true;
            authButton.innerText = 'Registrando...';

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: nombre,
                        password: clave,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    // Si el servidor responde con un error (ej: usuario ya existe)
                    throw new Error(data.message || 'Algo salió mal al registrar.');
                }

                showNotification('¡Usuario registrado! Ahora inicia sesión.', 'success');
                alternarModo(); // Cambia al modo de inicio de sesión

            } catch (error) {
                showNotification(error.message);
            } finally {
                authButton.disabled = false;
                authButton.innerText = 'Registrarse';
            }

        } else {
            // --- LÓGICA DE INICIO DE SESIÓN (A MODIFICAR EN EL SIGUIENTE PASO) ---
            showNotification('La lógica de inicio de sesión aún no está conectada a la base de datos.');
            // Aquí iría la llamada a /api/login
            // Por ahora, para probar, te redirigiremos si eres admin (ejemplo temporal)
            if (nombre === 'admin' && clave === 'admin') {
                 localStorage.setItem('usuarioActivo', nombre);
                 localStorage.setItem('rolActivo', 'admin');
                 window.location.href = 'index.html';
            }
        }
    }

    authButton.addEventListener('click', autenticar);
    toggleLink.addEventListener('click', alternarModo);
    claveInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') autenticar();
    });
});