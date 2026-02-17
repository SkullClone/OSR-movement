const M_ID = "com.osr_movement.data";
let isGM = false, isLightOn = false, turns = 1, torch = 6;

OBR.onReady(async () => {
    isGM = (await OBR.player.getRole()) === "GM";
    
    const lightBtn = document.getElementById('lightBtn');
    lightBtn.onclick = () => {
        isLightOn = !isLightOn;
        lightBtn.innerText = isLightOn ? "LUZ: ENCENDIDA" : "LUZ: APAGADA";
        lightBtn.style.background = isLightOn ? "#430" : "#222";
    };

    // BLOQUEO DE MOVIMIENTO: Se activa cada vez que algo cambia en la escena
    OBR.scene.items.onChange(async (items) => {
        const limit = parseInt(document.getElementById('limit').value);
        const restrictGM = document.getElementById('restrictGM').checked;
        const grid = await OBR.scene.grid.getScale();
        const updates = [];

        for (const item of items) {
            if (item.layer === "CHARACTER") {
                // Si el item no tiene metadatos de inicio, se los ponemos (posición actual)
                const data = item.metadata[M_ID] || { x: item.position.x, y: item.position.y };
                
                // Solo bloqueamos si no es GM, o si es GM y la casilla está marcada
                if (!isGM || restrictGM) {
                    const dist = Math.sqrt(Math.pow(item.position.x - data.x, 2) + Math.pow(item.position.y - data.y, 2));
                    const feet = (dist / grid.dpi) * grid.number;

                    if (feet > limit + 1) { // Margen de error de 1 pie
                        updates.push({ id: item.id, position: { x: data.x, y: data.y } });
                        OBR.notification.show("Límite de movimiento de turno alcanzado.");
                    }
                }
                
                if (!item.metadata[M_ID]) {
                    updates.push({ id: item.id, metadata: { [M_ID]: data } });
                }
            }
        }
        
        if (updates.length > 0) {
            await OBR.scene.items.updateItems(updates.map(u => u.id), (items) => {
                updates.forEach(u => {
                    const f = items.find(i => i.id === u.id);
                    if (u.position) f.position = u.position;
                    if (u.metadata) f.metadata[M_ID] = u.metadata[M_ID];
                });
            });
        }
    });
});

// SIGUIENTE TURNO: Resetea el punto de origen del movimiento
document.getElementById('nextTurn').onclick = async () => {
    turns++;
    if (isLightOn && torch > 0) torch--;

    const freq = parseInt(document.getElementById('encFreq').value);
    document.getElementById('turnVal').innerText = turns;
    document.getElementById('torchVal').innerText = isLightOn ? torch : `${torch} (Pausado)`;
    document.getElementById('encVal').innerText = freq - (turns % freq);

    if (turns % freq === 0) OBR.notification.show("¡TIRADA DE ENCUENTRO!", "WARNING");
    if (isLightOn && torch === 0) OBR.notification.show("¡LA LUZ SE HA AGOTADO!", "ERROR");

    // Actualizar el punto de inicio de todos los personajes a su posición actual
    const chars = await OBR.scene.items.getItems(i => i.layer === "CHARACTER");
    await OBR.scene.items.updateItems(chars.map(c => c.id), (items) => {
        items.forEach(i => {
            i.metadata[M_ID] = { x: i.position.x, y: i.position.y };
        });
    });
};
