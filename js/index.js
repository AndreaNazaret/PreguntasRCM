// Lógica del Sonido
function toggleSound() {
    const video = document.getElementById("bg-video");
    const iconMute = document.getElementById("iconMute");
    const iconSound = document.getElementById("iconSound");

    if (video.muted) {
        video.muted = false;
        iconMute.classList.add("hidden");
        iconSound.classList.remove("hidden");
        video.volume = 1.0;
    } else {
        video.muted = true;
        iconMute.classList.remove("hidden");
        iconSound.classList.add("hidden");
    }
}

// Lógica del Menú Desplegable
const menuOverlay = document.getElementById('menu-overlay');
const menuCard = document.getElementById('menu-card');
const mainScreen = document.getElementById('main-screen');

// Expose functions to global scope for inline onclick
window.openMenu = function () {
    menuOverlay.classList.remove('hidden');
    // Pequeño delay para permitir que el navegador procese el 'display:block' antes de animar opacidad
    setTimeout(() => {
        menuOverlay.classList.remove('opacity-0');
        menuCard.classList.remove('scale-95');
        menuCard.classList.add('scale-100');
        mainScreen.classList.add('blur-sm'); // Difumina el texto de fondo
    }, 10);
};

window.closeMenu = function () {
    menuOverlay.classList.add('opacity-0');
    menuCard.classList.remove('scale-100');
    menuCard.classList.add('scale-95');
    mainScreen.classList.remove('blur-sm');

    // Esperar a que termine la transición para ocultar
    setTimeout(() => {
        menuOverlay.classList.add('hidden');
    }, 300);
};

// Cerrar menú si clickas fuera de la tarjeta
menuOverlay.addEventListener('click', function (e) {
    if (e.target === menuOverlay) {
        window.closeMenu();
    }
});
