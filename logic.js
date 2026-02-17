// === VARIABLES DE ESTADO ===
let movimientoMaximo = 30;
let movimientoGastado = 0;
let minutosAntorcha = 60;
let extensionActiva = false;

// === ELEMENTOS DEL DOM ===
const totalSpan = document.getElementById('totalMovement');
const currentSpan = document.getElementById('currentMovement');
const antorchaDiv = document.getElementById('antorcha-info');
const bloqueoDiv = document.getElementById('bloqueo-info');
const btnTorch = document.getElementById('btnTorch');
const btnTurn = document.getElementById('btnTurn');
const btnLock = document.getElementById('btnLock');
const btnUnlock = document.getElementById('btnUnlock');

// === FUNCIONES DE ACTUALIZACIÓN DE UI ===
function actualizarUI() {
    if (totalSpan) totalSpan.textContent = movimientoMaximo;
    if (currentSpan) currentSpan.textContent = movimientoGastado;
    
    if (antorchaDiv) {
        if (minutosAntorcha <= 0) {
            antorchaDiv.innerHTML = '🔴 Antorcha Apagada';
        } else {
            antorchaDiv.innerHTML = `🔥 Antorcha: ${minutosAntorcha} min`;
        }
    }
    
    if (bloqueoDiv) {
        bloqueoDiv.innerHTML = extensionActiva ? '🔒 Bloqueado' : '🔓 Extensión Activa';
    }
}

// === FUNCIONES PRINCIPALES ===
function gastarMovimiento(cantidad) {
    if (extensionActiva) {
        alert('🔒 Movimiento bloqueado. Usa "Siguiente Turno".');
        return false;
    }
    
    let nuevoGasto = movimientoGastado + cantidad;
    if (nuevoGasto <= movimientoMaximo) {
        movimientoGastado = nuevoGasto;
        actualizarUI();
        return true;
    } else {
        alert(`❌ Solo puedes mover ${movimientoMaximo - movimientoGastado} m más.`);
        return false;
    }
}

function siguienteTurno() {
    // 1. Resetear el movimiento gastado
    movimientoGastado = 0;
    
    // 2. Consumir antorcha (10 minutos por turno)
    if (minutosAntorcha > 0) {
        minutosAntorcha -= 10;
        if (minutosAntorcha < 0) minutosAntorcha = 0;
    }
    
    // 3. Comprobar Encuentro Errante (1/6)
    let tirada = Math.floor(Math.random() * 6) + 1;
    if (tirada === 1) {
        alert('⚔️ ¡AVISO! ENCUENTRO ERRANTE.');
    }
    
    // 4. Actualizar interfaz
    actualizarUI();
    
    // 5. Desbloquear automáticamente si estaba bloqueado
    if (extensionActiva) {
        desbloquearUso();
    }
}

function encenderAntorcha() {
    minutosAntorcha = 60;
    actualizarUI();
    alert('🔥 Antorcha encendida (60 minutos).');
}

function bloquearUso() {
    extensionActiva = true;
    actualizarUI();
}

function desbloquearUso() {
    extensionActiva = false;
    actualizarUI();
}

// === CONFIGURACIÓN INICIAL Y EVENTOS ===
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎲 OSR Movement Controller v0.1 Cargado');
    
    // Botones de movimiento
    const btn5 = document.getElementById('btn5');
    const btn10 = document.getElementById('btn10');
    const btn30 = document.getElementById('btn30');
    
    if (btn5) btn5.addEventListener('click', () => gastarMovimiento(5));
    if (btn10) btn10.addEventListener('click', () => gastarMovimiento(10));
    if (btn30) btn30.addEventListener('click', () => gastarMovimiento(30));
    
    // Botones de control
    if (btnTorch) btnTorch.addEventListener('click', encenderAntorcha);
    if (btnTurn) btnTurn.addEventListener('click', siguienteTurno);
    if (btnLock) btnLock.addEventListener('click', bloquearUso);
    if (btnUnlock) btnUnlock.addEventListener('click', desbloquearUso);
    
    // Inicializar UI
    actualizarUI();
});
