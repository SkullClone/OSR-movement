const M_ID = "com.skullclone.osrmovement";
let isGM = false;
let isLightOn = false;
let turns = 1;
let torch = 6;

OBR.onReady(async () => {
    // Determinar si el usuario es GM
    const role = await OBR.player.getRole();
    isGM = role === "GM";

    // Inicializar interfaz de Luz
    const lightBtn = document.getElementById('lightBtn');
    lightBtn.onclick = () => {
        isLightOn = !isLightOn;
        lightBtn.innerText = isLightOn ? "LUZ: ENCENDIDA" : "LUZ: APAGADA";
        lightBtn.style.background = isLightOn ? "#430" : "#222";
        lightBtn.style.borderColor = isLightOn ? "#ffca28" : "#555";
    };

    // --- LÓGICA DE BLOQUEO DE MOVIMIENTO ---
    OBR.scene.items.onChange(async (items) => {
        const limitFeet = parseInt(document.getElementById('limit').value) || 120;
        const restrictGM = document.getElementById('restrictGM').checked;
        const grid = await OBR.scene.grid.getScale();

        const updates = [];

        for (const item of items) {
            // Solo actuar sobre personajes (Tokens)
            if (item.layer === "CHARACTER") {
                const data = item.metadata[M_ID] || { x: item.position.x, y: item.position.y };

                // Si no es el GM, o si es el GM y la casilla de restricción está marcada
                if (!isGM || restrictGM) {
                    const dx = item.position.x - data.x;
                    const dy = item.position.y - data.y;
                    const distPx = Math.sqrt(dx * dx + dy * dy);
                    
                    // Convertir píxeles a pies según la escala del mapa
                    const distFeet = (distPx / grid.dpi) * grid.number;

                    // Bloquear si supera el límite (+2 pies de margen para evitar errores de redondeo)
                    if (distFeet > limitFeet + 2) {
                        updates.push({
                            id: item.id,
                            position: { x: data.x, y: data.y }
                        });
                        OBR.notification.show("¡Límite de movimiento alcanzado!");
                    }
                }

                // Si el item es nuevo y no tiene metadatos, se los asignamos
                if (!item.metadata[M_ID]) {
                    updates.push({
                        id: item.id,
                        metadata: { [M_ID]: { x: item.position.x, y: item.position.y } }
                    });
                }
            }
        }

        // Aplicar los cambios de posición o metadatos
        if (updates.length > 0) {
            await OBR.scene.items.updateItems(updates.map(u => u.id), (items) => {
                updates.forEach(u => {
                    const found = items.find(i => i.id === u.id);
                    if (u.position) found.position = u.position;
                    if (u.metadata) found.metadata[M_ID] = u.metadata[M_ID];
                });
            });
        }
    });
});

// --- LÓGICA DE SIGUIENTE TURNO ---
document.getElementById('nextTurn').onclick = async () => {
    // 1. Avanzar Turno
    turns++;
    
    // 2. Consumir luz solo si está encendida
    if (isLightOn && torch > 0) {
        torch--;
    }

    // 3. Calcular Encuentros
    const freq = parseInt(document.getElementById('encFreq').value) || 2;
    const nextEnc = freq - (turns % freq);

    // 4. Actualizar UI
    document.getElementById('turnVal').innerText = turns;
    document.getElementById('torchVal').innerText = isLightOn ? torch : `${torch} (Off)`;
    document.getElementById('encVal').innerText = (nextEnc === freq ? 0 : nextEnc) + " turnos";

    // 5. Notificaciones
    if (turns % freq === 0) {
        OBR.notification.show("¡TIRADA DE ENCUENTRO ALEATORIO!", "WARNING");
    }
    if (isLightOn && torch === 0) {
        OBR.notification.show("¡LA ANTORCHA SE HA AGOTADO!", "ERROR");
    }

    // 6. RESETEAR ORIGEN DE MOVIMIENTO
    // Al pulsar siguiente turno, la posición actual se convierte en el nuevo "punto de partida"
    const characters = await OBR.scene.items.getItems((i) => i.layer === "CHARACTER");
    await OBR.scene.items.updateItems(characters.map(c => c.id), (items) => {
        items.forEach(item => {
            item.metadata[M_ID] = { x: item.position.x, y: item.position.y };
        });
    });

    OBR.notification.show("Nuevo turno: Movimiento reiniciado.");
};
