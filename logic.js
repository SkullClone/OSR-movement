const M_KEY = "com.skullclone.osr_move";

OBR.onReady(async () => {
    let state = { turn: 1, lightOn: false, torch: 6, limit: 120, freq: 2 };

    const turnDisp = document.getElementById('turnCounter');
    const lightDisp = document.getElementById('lightCounter');
    const lightBtn = document.getElementById('lightToggle');

    const load = async () => {
        const meta = await OBR.scene.getMetadata();
        if (meta[M_KEY]) state = { ...state, ...meta[M_KEY] };
        turnDisp.innerText = state.turn;
        lightDisp.innerText = state.lightOn ? state.torch : "OFF";
    };

    // Bloqueo de Movimiento
    OBR.scene.items.onChange(async (items) => {
        const isGM = (await OBR.player.getRole()) === "GM";
        const restrictGM = document.getElementById('restrictGM').checked;
        const limit = parseInt(document.getElementById('moveLimit').value);
        const grid = await OBR.scene.grid.getScale();
        
        const updates = [];
        const tokens = items.filter(i => i.layer === "CHARACTER");

        for (const token of tokens) {
            let start = token.metadata[M_KEY];
            // Si no tiene posición de inicio o es de otro turno, inicializar
            if (!start || start.turn !== state.turn) {
                updates.push({ 
                    id: token.id, 
                    metadata: { ...token.metadata, [M_KEY]: { x: token.position.x, y: token.position.y, turn: state.turn } } 
                });
                continue;
            }

            if (isGM && !restrictGM) continue;

            // Calcular distancia usando la API
            const dist = await OBR.scene.grid.distanceBetween({ x: start.x, y: start.y }, token.position);
            
            if (dist > limit + 0.5) {
                updates.push({ id: token.id, position: { x: start.x, y: start.y } });
                OBR.notification.show("Límite de movimiento alcanzado");
            }
        }

        if (updates.length > 0) {
            await OBR.scene.items.updateItems(updates.map(u => u.id), (items) => {
                updates.forEach(u => {
                    const item = items.find(i => i.id === u.id);
                    if (u.position) item.position = u.position;
                    if (u.metadata) item.metadata = u.metadata;
                });
            });
        }
    });

    document.getElementById('nextTurnBtn').onclick = async () => {
        state.turn++;
        if (state.lightOn && state.torch > 0) state.torch--;
        
        const freq = parseInt(document.getElementById('encounterFreq').value);
        if (state.turn % freq === 0) OBR.notification.show("¡Tirada de Encuentro!", "WARNING");

        await OBR.scene.setMetadata({ [M_KEY]: state });
        
        // Resetear todos los tokens
        const tokens = await OBR.scene.items.getItems(i => i.layer === "CHARACTER");
        await OBR.scene.items.updateItems(tokens.map(t => t.id), (items) => {
            items.forEach(item => {
                item.metadata[M_KEY] = { x: item.position.x, y: item.position.y, turn: state.turn };
            });
        });
        load();
    };

    lightBtn.onclick = () => {
        state.lightOn = !state.lightOn;
        if (state.lightOn && state.torch === 0) state.torch = 6;
        save();
    };

    const save = async () => {
        await OBR.scene.setMetadata({ [M_KEY]: state });
        load();
    };

    await load();
});
